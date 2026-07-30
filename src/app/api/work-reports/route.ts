import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function getWeekStart(d: Date) {
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
    return start
}

// GET /api/work-reports?start_date&end_date&employee_id&department_id&status&search&page&limit
// Members see only their own reports; admins see everyone's, with employee/department filters.
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const isAdmin = auth.employee.roleLevel <= 3
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const employeeId = searchParams.get('employee_id') || ''
    const departmentId = searchParams.get('department_id') || ''
    const status = searchParams.get('status') || ''
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '20')))

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
    }

    let query = supabase
        .from('work_reports')
        .select(`
            id, date, project, description, hours, progress, status, attachment_url, notes, created_at,
            employee:employees(id, name, employee_id, avatar_url, department:departments(id, name))
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (isAdmin) {
        if (employeeId) query = query.eq('employee_id', employeeId)
    } else {
        query = query.eq('employee_id', auth.employee.id)
    }
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows = (data || []) as any[]

    // Filtering a joined column (employee.department_id) isn't reliable via PostgREST without
    // an !inner join, so apply the department filter in JS instead.
    if (isAdmin && departmentId) {
        rows = rows.filter(r => r.employee?.department?.id === departmentId)
    }

    if (search) {
        rows = rows.filter(r =>
            r.project?.toLowerCase().includes(search) ||
            r.description?.toLowerCase().includes(search) ||
            r.employee?.name?.toLowerCase().includes(search) ||
            r.employee?.employee_id?.toLowerCase().includes(search))
    }

    const total = rows.length
    const offset = (page - 1) * limit
    const pageRows = rows.slice(offset, offset + limit)

    // Attach the admin's Work Comparison evaluation (if any) so the submitter can see
    // that their report was reviewed, and what points/feedback it got.
    const reportIds = pageRows.map(r => r.id)
    const evaluationByReport: Record<string, { points: number; note: string | null; evaluated_at: string }> = {}
    if (reportIds.length > 0) {
        const { data: evalItems } = await supabase
            .from('work_evaluation_items')
            .select('work_report_id, points, created_at, evaluation:work_evaluations(note, evaluated_at)')
            .in('work_report_id', reportIds)
            .order('created_at', { ascending: false })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ; (evalItems || []).forEach((it: any) => {
            if (!evaluationByReport[it.work_report_id]) {
                evaluationByReport[it.work_report_id] = {
                    points: it.points,
                    note: it.evaluation?.note || null,
                    evaluated_at: it.evaluation?.evaluated_at || it.created_at,
                }
            }
        })
    }

    const entries = pageRows.map(r => ({
        id: r.id,
        date: r.date,
        project: r.project,
        description: r.description,
        hours: r.hours,
        progress: r.progress,
        status: r.status,
        attachment_url: r.attachment_url,
        notes: r.notes,
        created_at: r.created_at,
        employee: {
            id: r.employee?.id,
            name: r.employee?.name,
            employee_id: r.employee?.employee_id,
            avatar_url: r.employee?.avatar_url,
            department: r.employee?.department?.name || null,
        },
        evaluation: evaluationByReport[r.id] || null,
    }))

    // Dashboard cards reflect fixed periods (today/this week/this month), independent of
    // whatever range the table itself is currently filtered to.
    const now = new Date()
    const today = fmtLocalDate(now)
    const weekStart = fmtLocalDate(getWeekStart(now))
    const monthStart = fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))

    let summary: Record<string, number>
    if (isAdmin) {
        const [{ count: reportsToday }, { data: todayRows }, { count: activeEmployees }] = await Promise.all([
            supabase.from('work_reports').select('*', { count: 'exact', head: true }).eq('date', today),
            supabase.from('work_reports').select('employee_id').eq('date', today),
            supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true),
        ])
        const submittedToday = new Set((todayRows || []).map(r => r.employee_id)).size
        summary = {
            totalReports: total,
            reportsToday: reportsToday || 0,
            employeesSubmitted: submittedToday,
            pendingEmployees: Math.max(0, (activeEmployees || 0) - submittedToday),
        }
    } else {
        const empId = auth.employee.id
        const [{ count: todayCount }, { count: weekCount }, { count: monthCount }, { count: totalCount }] = await Promise.all([
            supabase.from('work_reports').select('*', { count: 'exact', head: true }).eq('employee_id', empId).eq('date', today),
            supabase.from('work_reports').select('*', { count: 'exact', head: true }).eq('employee_id', empId).gte('date', weekStart),
            supabase.from('work_reports').select('*', { count: 'exact', head: true }).eq('employee_id', empId).gte('date', monthStart),
            supabase.from('work_reports').select('*', { count: 'exact', head: true }).eq('employee_id', empId),
        ])
        summary = {
            todayReports: todayCount || 0,
            weekReports: weekCount || 0,
            monthReports: monthCount || 0,
            totalReports: totalCount || 0,
        }
    }

    return NextResponse.json({ entries, total, page, limit, summary })
}

// POST /api/work-reports - create a daily work report for the current employee
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const { date, project, description, hours, progress, status, attachment_url, notes } = body

    if (!project || typeof project !== 'string' || !project.trim()) {
        return NextResponse.json({ error: 'Project/Task is required' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
        .from('work_reports')
        .insert({
            employee_id: auth.employee.id,
            date: date || new Date().toISOString().split('T')[0],
            project: project.trim(),
            description: description || null,
            hours: typeof hours === 'number' ? hours : 0,
            progress: typeof progress === 'number' ? progress : 0,
            status: status || 'in_progress',
            attachment_url: attachment_url || null,
            notes: notes || null,
        })
        .select(`
            id, date, project, description, hours, progress, status, attachment_url, notes, created_at,
            employee:employees(id, name, employee_id, avatar_url, department:departments(id, name))
        `)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(auth.employee.id, `Submitted a daily work report for ${data.project}`, 'work_reports', data.id)

    return NextResponse.json(data, { status: 201 })
}
