import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Tasks store per-line points as a trailing "[Npt]" marker (same convention the
// Create/Edit Task modal writes into the description string).
function parseTaskDescription(description: string | null): { items: { text: string; points: number | null }[]; total: number } {
    if (!description) return { items: [], total: 0 }
    let total = 0
    const items = description.split('\n').filter(l => l.trim()).map(line => {
        const withPoints = line.match(/^\d+\.\s*(.*?)\s*\[(\d+)pt\]\s*$/)
        if (withPoints) {
            const pts = parseInt(withPoints[2], 10)
            total += pts
            return { text: withPoints[1], points: pts }
        }
        const plain = line.match(/^\d+\.\s*(.*)$/)
        return { text: plain ? plain[1] : line, points: null }
    })
    return { items, total }
}

// GET /api/work-comparison?employee_id&start_date&end_date (admin only)
// Returns the employee's assigned tasks (with parsed points) and daily work reports
// for the same period, so the admin can compare and score them side by side.
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!employeeId || !startDate || !endDate) {
        return NextResponse.json({ error: 'employee_id, start_date and end_date are required' }, { status: 400 })
    }

    // 1. Tasks assigned to this employee, due within the period.
    const { data: assignments, error: assignErr } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('employee_id', employeeId)
    if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 })

    const taskIds = (assignments || []).map(a => a.task_id)
    let tasks: { id: string; title: string; task_no: string | null; description: string | null; status: string; priority: string; due_date: string | null }[] = []
    if (taskIds.length > 0) {
        const { data, error } = await supabase
            .from('tasks')
            .select('id, title, task_no, description, status, priority, due_date')
            .in('id', taskIds)
            .gte('due_date', startDate)
            .lte('due_date', endDate)
            .order('due_date', { ascending: true })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        tasks = data || []
    }

    let totalAssignedPoints = 0
    const taskEntries = tasks.map(t => {
        const parsed = parseTaskDescription(t.description)
        totalAssignedPoints += parsed.total
        return {
            id: t.id,
            title: t.title,
            task_no: t.task_no,
            status: t.status,
            priority: t.priority,
            due_date: t.due_date,
            description: t.description,
            items: parsed.items,
            totalPoints: parsed.total,
        }
    })

    // 2. Daily work reports submitted by this employee in the same period.
    const { data: reports, error: reportsErr } = await supabase
        .from('work_reports')
        .select('id, date, project, description, hours, progress, status, attachment_url, notes, created_at')
        .eq('employee_id', employeeId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
    if (reportsErr) return NextResponse.json({ error: reportsErr.message }, { status: 500 })

    // 3. Most recent prior score (if any) already given to each report, so the admin
    // sees what was previously awarded instead of a blank input.
    const reportIds = (reports || []).map(r => r.id)
    const existingPointsByReport: Record<string, number> = {}
    if (reportIds.length > 0) {
        const { data: items } = await supabase
            .from('work_evaluation_items')
            .select('work_report_id, points, created_at')
            .in('work_report_id', reportIds)
            .order('created_at', { ascending: false })
        ; (items || []).forEach(it => {
            if (existingPointsByReport[it.work_report_id] === undefined) {
                existingPointsByReport[it.work_report_id] = it.points
            }
        })
    }

    const workReports = (reports || []).map(r => ({
        ...r,
        existingPoints: existingPointsByReport[r.id] ?? null,
    }))

    return NextResponse.json({ tasks: taskEntries, totalAssignedPoints, workReports })
}
