import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { canViewAllWorkReports, getWorkReportAccessTargets } from '@/lib/workReports'
import { NextResponse } from 'next/server'

const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function getWeekStart(d: Date) {
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
    return start
}

// GET /api/work-reports?start_date&end_date&employee_id&department_id&status&search&page&limit
// Visibility is NOT based on role/hierarchy — a Member, Manager, or Admin all see only their own
// reports by default, regardless of rank. Seeing anyone else's report requires an explicit grant
// from a Super Admin/Owner (who always sees everyone's): either the blanket "Daily Work Report
// (View All)" feature permission (canViewAllWorkReports — Members → Edit Member → Access → Work),
// or a targeted work_report_access grant naming that specific person (getWorkReportAccessTargets
// — the "Report Access" tab). The employee/department filter dropdowns remain an Admin+ (or
// canViewAll)-only convenience.
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const isAdmin = auth.employee.roleLevel <= 3
    const canViewAll = await canViewAllWorkReports(db, auth.employee.id, auth.employee.roleLevel)
    // Granular, per-target grants (see work_report_access) additive to the hierarchy/canViewAll
    // rules below — lets a Super Admin give one employee visibility into one or more specific
    // OTHER employees' reports without unlocking everyone's. Skipped entirely once canViewAll is
    // already true since it would add nothing.
    const grantedTargetIds = canViewAll ? [] : await getWorkReportAccessTargets(db, auth.employee.id)
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

    // Own reports are always visible, plus anyone specifically granted (see grantedTargetIds
    // above). Super Admin/Owner (or anyone granted "Daily Work Report (View All)") skip this
    // filter entirely and see every report. Role/rank plays no part in this on its own.
    if (!canViewAll) {
        params.push(auth.employee.id, grantedTargetIds)
        conditions.push(`(wr.employee_id = $${params.length - 1} OR wr.employee_id = ANY($${params.length}::uuid[]))`)
    }
    if ((isAdmin || canViewAll) && employeeId) { params.push(employeeId); conditions.push(`wr.employee_id = $${params.length}`) }
    if (status) { params.push(status); conditions.push(`wr.status = $${params.length}`) }

    const { rows: data } = await db.query(
        `SELECT wr.id, wr.employee_id, wr.date, wr.project, wr.description, wr.hours, wr.progress, wr.status, wr.attachment_url, wr.notes, wr.created_at,
            wr.management_check, wr.checked_at, wr.checked_note,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url,
                'department', json_build_object('id', d.id, 'name', d.name)) AS employee,
            CASE WHEN checker.id IS NOT NULL THEN json_build_object('id', checker.id, 'name', checker.name, 'designation', checker.designation) END AS checked_by
         FROM work_reports wr
         LEFT JOIN employees e ON e.id = wr.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN employees checker ON checker.id = wr.checked_by
         WHERE ${conditions.join(' AND ')}
         ORDER BY wr.date DESC, wr.created_at DESC`,
        params
    )

    let rows = data

    // Filtering a joined column (employee.department_id) is done in JS to keep the SQL simple.
    if ((isAdmin || canViewAll) && departmentId) {
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
        // Same visibility rule as above — a viewer can verify a report if it isn't their own and
        // they've been granted access to it (Super Admin/Owner, or anyone granted "Daily Work
        // Report (View All)", can verify anyone's). Once a decision is recorded it's final, so an
        // already-checked report never offers Yes/No again, even to someone who could otherwise
        // verify it.
        can_verify: !r.management_check && r.employee_id !== auth.employee.id
            && (canViewAll || grantedTargetIds.includes(r.employee_id)),
    }))

    // Dashboard cards reflect fixed periods (today/this week/this month), independent of
    // whatever range the table itself is currently filtered to.
    const now = new Date()
    const today = fmtLocalDate(now)
    const weekStart = fmtLocalDate(getWeekStart(now))
    const monthStart = fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))

    let summary: Record<string, number>
    if (isAdmin || canViewAll || grantedTargetIds.length > 0) {
        // Same scope as the list above (Super Admin/Owner, or anyone granted "Daily Work Report
        // (View All)": unrestricted; anyone else: self + whatever specific people they've been
        // granted) — otherwise these cards would show totals wider than what the list beneath
        // actually shows, which would just be confusing.
        const scopeSql = canViewAll ? '' : `AND (wr.employee_id = $2 OR wr.employee_id = ANY($3::uuid[]))`
        const scopeParams = canViewAll ? [] : [auth.employee.id, grantedTargetIds]
        const activeEmployeesSql = canViewAll
            ? `SELECT COUNT(*)::int AS count FROM employees WHERE is_active = true`
            : `SELECT COUNT(*)::int AS count FROM employees e WHERE e.is_active = true AND (e.id = $1 OR e.id = ANY($2::uuid[]))`
        const activeEmployeesParams = canViewAll ? [] : [auth.employee.id, grantedTargetIds]

        const [{ rows: [{ count: reportsToday }] }, { rows: todayRows }, { rows: [{ count: activeEmployees }] }] = await Promise.all([
            db.query(
                `SELECT COUNT(*)::int AS count FROM work_reports wr
                 WHERE wr.date = $1 ${scopeSql}`,
                [today, ...scopeParams]
            ),
            db.query(
                `SELECT wr.employee_id FROM work_reports wr
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

    const reportDate = date || new Date().toISOString().split('T')[0]

    // One report per employee per day — editing the existing one is the only way to change
    // that day's report once submitted.
    const { rows: [existing] } = await db.query(
        `SELECT id FROM work_reports WHERE employee_id = $1 AND date = $2`,
        [auth.employee.id, reportDate]
    )
    if (existing) {
        return NextResponse.json({ error: 'You have already submitted a work report for this date. Edit your existing report instead.' }, { status: 409 })
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
            auth.employee.id, reportDate, project.trim(),
            description || null, typeof hours === 'number' ? hours : 0, typeof progress === 'number' ? progress : 0,
            status || 'in_progress', attachment_url || null, notes || null,
        ]
    )

    await logAudit(auth.employee.id, `Submitted a daily work report for ${data.project}`, 'work_reports', data.id)

    return NextResponse.json(data, { status: 201 })
}
