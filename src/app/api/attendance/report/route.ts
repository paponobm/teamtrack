import { requireAuth, isAuthed } from '@/lib/auth'
import { backfillAbsences } from '@/lib/attendanceBackfill'
import { NextResponse } from 'next/server'

// No configurable shift-length exists anywhere in the schema (only a per-employee
// duty_start_time, no duty_end_time) — 8h is the assumed standard workday for Overtime.
const STANDARD_SHIFT_MS = 8 * 60 * 60 * 1000

// GET /api/attendance/report?start_date&end_date&employee_id&status&search&page&limit
// Cross-employee attendance report for Daily/Weekly/Monthly/Custom ranges (admin only).
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only — this reports on all employees
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const employeeId = searchParams.get('employee_id') || ''
    const status = searchParams.get('status') || ''
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '20')))
    const groupBy = searchParams.get('group_by') || ''

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
    }

    // Lazily create 'absent' rows for anyone 2+ hours past their reporting time with no record
    // for a given day in this range, so the totals below (and the daily rows) actually count
    // unexcused no-shows instead of silently skipping days with no attendance row at all.
    await backfillAbsences(db, startDate, endDate)

    // group_by=employee - one row per employee, totals for the whole range instead of one row
    // per daily record. Used by the Attendance Report's monthly summary view; the per-record
    // shape below is untouched and still serves whatever else calls this endpoint plain.
    if (groupBy === 'employee') {
        // Same "not configured yet = hidden" rule as the Daily Attendance list and the backfill
        // itself (see src/lib/attendanceBackfill.ts) — an employee with no Duty Schedule set has
        // no real reporting time to compute Present/Late/Absent against.
        const empConditions = [`e.is_active = true`, `e.duty_start_time IS NOT NULL`, `e.duty_end_time IS NOT NULL`]
        const empParams: unknown[] = []
        if (employeeId) { empParams.push(employeeId); empConditions.push(`e.id = $${empParams.length}`) }
        if (search) { empParams.push(`%${search}%`); empConditions.push(`LOWER(e.name) LIKE $${empParams.length}`) }
        empParams.push(startDate)
        const startIdx = empParams.length
        empParams.push(endDate)
        const endIdx = empParams.length
        // Someone who joined after this report's own end date wasn't employed at all during the
        // selected month — leave them off entirely, same "not employed yet = hidden" rule the
        // Payroll Sheet already applies via basic_salary_effective_month.
        empConditions.push(`(e.joining_date IS NULL OR e.joining_date <= $${endIdx})`)

        let having = ''
        if (status === 'present') having = `HAVING COUNT(*) FILTER (WHERE a.status IN ('present','late')) > 0`
        else if (status === 'late') having = `HAVING COUNT(*) FILTER (WHERE a.status = 'late') > 0`
        else if (status === 'absent') having = `HAVING COUNT(*) FILTER (WHERE a.status = 'absent') > 0`
        else if (status === 'leave') having = `HAVING COUNT(*) FILTER (WHERE a.status IN ('leave','half_day','on_duty')) > 0`

        const { rows } = await db.query(
            `SELECT e.id, e.name, e.employee_id, e.avatar_url, e.duty_start_time, d.name AS department_name,
                COUNT(*) FILTER (WHERE a.status IN ('present','late')) AS total_attendance,
                COUNT(*) FILTER (WHERE a.status = 'late') AS total_late,
                COUNT(*) FILTER (WHERE a.status = 'absent') AS total_absent,
                COUNT(*) FILTER (WHERE a.status IN ('leave','half_day','on_duty')) AS total_leave,
                COALESCE(SUM(
                    CASE WHEN a.clock_in IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (COALESCE(a.clock_out, NOW()) - a.clock_in)) * 1000
                        ELSE 0 END
                ), 0) AS total_gross_ms
             FROM employees e
             LEFT JOIN departments d ON d.id = e.department_id
             LEFT JOIN attendance a ON a.employee_id = e.id AND a.date >= $${startIdx} AND a.date <= $${endIdx}
                AND (e.joining_date IS NULL OR a.date >= e.joining_date)
             WHERE ${empConditions.join(' AND ')}
             GROUP BY e.id, d.name
             ${having}
             ORDER BY e.sort_order ASC NULLS LAST, e.created_at DESC`,
            empParams
        )

        const employeeIds = rows.map(r => r.id)
        const breakTotals: Record<string, number> = {}
        if (employeeIds.length > 0) {
            const { rows: breakRows } = await db.query(
                `SELECT a.employee_id,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ab.end_time, NOW()) - ab.start_time)) * 1000), 0) AS total_break_ms
                 FROM attendance a
                 JOIN attendance_breaks ab ON ab.attendance_id = a.id
                 WHERE a.employee_id = ANY($1) AND a.date >= $2 AND a.date <= $3
                 GROUP BY a.employee_id`,
                [employeeIds, startDate, endDate]
            )
            breakRows.forEach(b => { breakTotals[b.employee_id] = Number(b.total_break_ms) })
        }

        const employeesOut = rows.map(r => {
            const totalBreakMs = breakTotals[r.id] || 0
            const totalGrossMs = Number(r.total_gross_ms) || 0
            return {
                id: r.id,
                name: r.name,
                employee_id: r.employee_id,
                avatar_url: r.avatar_url,
                duty_start_time: r.duty_start_time,
                department: r.department_name,
                total_attendance: Number(r.total_attendance),
                total_late: Number(r.total_late),
                total_absent: Number(r.total_absent),
                total_leave: Number(r.total_leave),
                total_working_ms: Math.max(0, totalGrossMs - totalBreakMs),
                total_break_ms: totalBreakMs,
            }
        })

        const counts = employeesOut.reduce((acc, e) => {
            acc.present += e.total_attendance
            acc.late += e.total_late
            acc.absent += e.total_absent
            acc.leave += e.total_leave
            return acc
        }, { present: 0, late: 0, absent: 0, leave: 0 })

        return NextResponse.json({ employees: employeesOut, counts })
    }

    const conditions = [`a.date >= $1`, `a.date <= $2`, `(e.joining_date IS NULL OR a.date >= e.joining_date)`]
    const params: unknown[] = [startDate, endDate]
    if (employeeId) { params.push(employeeId); conditions.push(`a.employee_id = $${params.length}`) }
    if (status) { params.push(status); conditions.push(`a.status = $${params.length}`) }

    const { rows: data } = await db.query(
        `SELECT a.id, a.date, a.clock_in, a.clock_out, a.status, a.notes,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url,
                'duty_start_time', e.duty_start_time, 'department', json_build_object('id', d.id, 'name', d.name)) AS employee
         FROM attendance a
         LEFT JOIN employees e ON e.id = a.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.date DESC, a.clock_in ASC NULLS LAST`,
        params
    )

    let rows = data

    if (search) {
        rows = rows.filter(r =>
            r.employee?.name?.toLowerCase().includes(search) ||
            r.employee?.employee_id?.toLowerCase().includes(search))
    }

    // Summary counts reflect the whole filtered range, not just the current page.
    // "late" also counts toward "present" (they did show up) — same convention already
    // used elsewhere (attendance/absent, dashboard, reports/monthly, reports/commission
    // all treat status === 'present' || 'late' as a present day).
    const counts = { present: 0, late: 0, absent: 0, leave: 0 }
    rows.forEach(r => {
        if (r.status === 'present') counts.present++
        else if (r.status === 'late') { counts.present++; counts.late++ }
        else if (r.status === 'absent') counts.absent++
        else if (r.status === 'leave') counts.leave++
    })

    const total = rows.length
    const offset = (page - 1) * limit
    const pageRows = rows.slice(offset, offset + limit)

    // Break time only needs computing for the rows actually being returned this page.
    const attendanceIds = pageRows.map(r => r.id)
    const breaksByAttendance: Record<string, number> = {}
    if (attendanceIds.length > 0) {
        const { rows: breaks } = await db.query(
            `SELECT attendance_id, start_time, end_time FROM attendance_breaks WHERE attendance_id = ANY($1)`,
            [attendanceIds]
        )
        breaks.forEach(b => {
            const start = new Date(b.start_time).getTime()
            const end = b.end_time ? new Date(b.end_time).getTime() : Date.now()
            breaksByAttendance[b.attendance_id] = (breaksByAttendance[b.attendance_id] || 0) + Math.max(0, end - start)
        })
    }

    const entries = pageRows.map(r => {
        let grossMs = 0
        if (r.clock_in) {
            const start = new Date(r.clock_in).getTime()
            const end = r.clock_out ? new Date(r.clock_out).getTime() : Date.now()
            grossMs = Math.max(0, end - start)
        }
        const breakMs = breaksByAttendance[r.id] || 0
        const workingMs = Math.max(0, grossMs - breakMs)
        const overtimeMs = Math.max(0, workingMs - STANDARD_SHIFT_MS)

        return {
            id: r.id,
            date: r.date,
            clock_in: r.clock_in,
            clock_out: r.clock_out,
            status: r.status,
            notes: r.notes,
            employee: {
                id: r.employee?.id,
                name: r.employee?.name,
                employee_id: r.employee?.employee_id,
                avatar_url: r.employee?.avatar_url,
                duty_start_time: r.employee?.duty_start_time || null,
                department: r.employee?.department?.name || null,
            },
            workingMs,
            breakMs,
            overtimeMs,
        }
    })

    return NextResponse.json({ entries, total, counts, page, limit })
}
