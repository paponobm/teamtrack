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
// Visibility follows the same role-hierarchy chain as verification (see the Management Check
// comment on work_reports in schema.prisma): a Member sees only their own reports; a Manager
// also sees Members'; an Admin also sees Managers' and Members'; a Super Admin/Owner sees
// everyone's. The employee/department filter dropdowns remain an Admin+-only convenience.
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const isAdmin = auth.employee.roleLevel <= 3
    const isSuperAdmin = auth.employee.roleLevel <= 2
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

    const conditions = [`wr.date >= $1`, `wr.date <= $2`]
    const params: unknown[] = [startDate, endDate]

    // Own reports are always visible; anyone whose role sits strictly below the viewer's in the
    // hierarchy (higher `level` number = lower rank) is visible too. Super Admin/Owner skip this
    // filter entirely and see every report, matching "super admin can see all".
    if (!isSuperAdmin) {
        params.push(auth.employee.id, auth.employee.roleLevel)
        conditions.push(`(wr.employee_id = $${params.length - 1} OR er.level > $${params.length})`)
    }
    if (isAdmin && employeeId) { params.push(employeeId); conditions.push(`wr.employee_id = $${params.length}`) }
    if (status) { params.push(status); conditions.push(`wr.status = $${params.length}`) }

    const { rows: data } = await db.query(
        `SELECT wr.id, wr.employee_id, wr.date, wr.project, wr.description, wr.hours, wr.progress, wr.status, wr.attachment_url, wr.notes, wr.created_at,
            wr.management_check, wr.checked_at, wr.checked_note, er.level AS employee_role_level,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url,
                'department', json_build_object('id', d.id, 'name', d.name)) AS employee,
            CASE WHEN checker.id IS NOT NULL THEN json_build_object('id', checker.id, 'name', checker.name, 'designation', checker.designation) END AS checked_by
         FROM work_reports wr
         LEFT JOIN employees e ON e.id = wr.employee_id
         LEFT JOIN roles er ON er.id = e.role_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN employees checker ON checker.id = wr.checked_by
         WHERE ${conditions.join(' AND ')}
         ORDER BY wr.date DESC, wr.created_at DESC`,
        params
    )

    let rows = data

    // Filtering a joined column (employee.department_id) is done in JS to keep the SQL simple.
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
        const { rows: evalItems } = await db.query(
            `SELECT wei.work_report_id, wei.points, wei.created_at, we.note, we.evaluated_at
             FROM work_evaluation_items wei
             LEFT JOIN work_evaluations we ON we.id = wei.evaluation_id
             WHERE wei.work_report_id = ANY($1)
             ORDER BY wei.created_at DESC`,
            [reportIds]
        )
        evalItems.forEach(it => {
            if (!evaluationByReport[it.work_report_id]) {
                evaluationByReport[it.work_report_id] = {
                    points: it.points,
                    note: it.note || null,
                    evaluated_at: it.evaluated_at || it.created_at,
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
        management_check: r.management_check || null,
        checked_by: r.checked_by || null,
        checked_at: r.checked_at || null,
        checked_note: r.checked_note || null,
        // Same role-hierarchy rule as the visibility filter above — a viewer can verify a report
        // if it isn't their own and the owner's role sits strictly below theirs (Super Admin/
        // Owner can verify anyone's). Once a decision is recorded it's final, so an already-
        // checked report never offers Yes/No again, even to someone who could otherwise verify it.
        can_verify: !r.management_check && r.employee_id !== auth.employee.id
            && (isSuperAdmin || (r.employee_role_level != null && r.employee_role_level > auth.employee.roleLevel)),
    }))

    // Dashboard cards reflect fixed periods (today/this week/this month), independent of
    // whatever range the table itself is currently filtered to.
    const now = new Date()
    const today = fmtLocalDate(now)
    const weekStart = fmtLocalDate(getWeekStart(now))
    const monthStart = fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))

    let summary: Record<string, number>
    if (isAdmin) {
        // Same hierarchy scope as the list above (Admin: self + Manager/Member; Super Admin/
        // Owner: unrestricted) — otherwise these cards would show system-wide totals while the
        // list beneath only shows what's actually visible, which would just be confusing.
        const scopeSql = isSuperAdmin ? '' : `AND (wr.employee_id = $2 OR er.level > $3)`
        const scopeParams = isSuperAdmin ? [] : [auth.employee.id, auth.employee.roleLevel]
        const activeEmployeesSql = isSuperAdmin
            ? `SELECT COUNT(*)::int AS count FROM employees WHERE is_active = true`
            : `SELECT COUNT(*)::int AS count FROM employees e LEFT JOIN roles er ON er.id = e.role_id WHERE e.is_active = true AND (e.id = $1 OR er.level > $2)`
        const activeEmployeesParams = isSuperAdmin ? [] : [auth.employee.id, auth.employee.roleLevel]

        const [{ rows: [{ count: reportsToday }] }, { rows: todayRows }, { rows: [{ count: activeEmployees }] }] = await Promise.all([
            db.query(
                `SELECT COUNT(*)::int AS count FROM work_reports wr
                 LEFT JOIN employees e ON e.id = wr.employee_id LEFT JOIN roles er ON er.id = e.role_id
                 WHERE wr.date = $1 ${scopeSql}`,
                [today, ...scopeParams]
            ),
            db.query(
                `SELECT wr.employee_id FROM work_reports wr
                 LEFT JOIN employees e ON e.id = wr.employee_id LEFT JOIN roles er ON er.id = e.role_id
                 WHERE wr.date = $1 ${scopeSql}`,
                [today, ...scopeParams]
            ),
            db.query(activeEmployeesSql, activeEmployeesParams),
        ])
        const submittedToday = new Set(todayRows.map(r => r.employee_id)).size
        summary = {
            totalReports: total,
            reportsToday: reportsToday || 0,
            employeesSubmitted: submittedToday,
            pendingEmployees: Math.max(0, (activeEmployees || 0) - submittedToday),
        }
    } else {
        const empId = auth.employee.id
        const [{ rows: [{ count: todayCount }] }, { rows: [{ count: weekCount }] }, { rows: [{ count: monthCount }] }, { rows: [{ count: totalCount }] }] = await Promise.all([
            db.query(`SELECT COUNT(*)::int AS count FROM work_reports WHERE employee_id = $1 AND date = $2`, [empId, today]),
            db.query(`SELECT COUNT(*)::int AS count FROM work_reports WHERE employee_id = $1 AND date >= $2`, [empId, weekStart]),
            db.query(`SELECT COUNT(*)::int AS count FROM work_reports WHERE employee_id = $1 AND date >= $2`, [empId, monthStart]),
            db.query(`SELECT COUNT(*)::int AS count FROM work_reports WHERE employee_id = $1`, [empId]),
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
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const { date, project, description, hours, progress, status, attachment_url, notes } = body

    if (!project || typeof project !== 'string' || !project.trim()) {
        return NextResponse.json({ error: 'Project/Task is required' }, { status: 400 })
    }

    const { rows: [data] } = await db.query(
        `WITH ins AS (
            INSERT INTO work_reports (employee_id, date, project, description, hours, progress, status, attachment_url, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
         )
         SELECT wr.id, wr.date, wr.project, wr.description, wr.hours, wr.progress, wr.status, wr.attachment_url, wr.notes, wr.created_at,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url,
                'department', json_build_object('id', d.id, 'name', d.name)) AS employee
         FROM ins wr LEFT JOIN employees e ON e.id = wr.employee_id LEFT JOIN departments d ON d.id = e.department_id`,
        [
            auth.employee.id, date || new Date().toISOString().split('T')[0], project.trim(),
            description || null, typeof hours === 'number' ? hours : 0, typeof progress === 'number' ? progress : 0,
            status || 'in_progress', attachment_url || null, notes || null,
        ]
    )

    await logAudit(auth.employee.id, `Submitted a daily work report for ${data.project}`, 'work_reports', data.id)

    return NextResponse.json(data, { status: 201 })
}
