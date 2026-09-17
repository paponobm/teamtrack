import { requireAuth, isAuthed } from '@/lib/auth'
import { backfillAbsences } from '@/lib/attendanceBackfill'
import { NextResponse } from 'next/server'

const EMPLOYEE_JOIN = `
    json_build_object(
        'id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'designation', e.designation,
        'avatar_url', e.avatar_url, 'duty_start_time', e.duty_start_time, 'duty_end_time', e.duty_end_time,
        'is_active', e.is_active,
        'department', json_build_object('id', d.id, 'name', d.name)
    ) AS employee
`

// GET /api/attendance - list attendance records (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3

    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const employeeId = searchParams.get('employee_id') || ''

    // Lazily create 'absent' rows for anyone who's now 2+ hours past their reporting time with
    // no attendance record for this date, so they actually show up in the list below.
    if (isAdmin) await backfillAbsences(db, date, date)

    const conditions = ['a.date = $1']
    const params: unknown[] = [date]

    if (!isAdmin) {
        params.push(auth.employee.id)
        conditions.push(`a.employee_id = $${params.length}`)
    } else {
        // An employee whose Duty Schedule (Start Time / End Time) was never configured has no
        // real reporting time to judge Present/Late/Absent against — exclude them from the
        // admin's Daily Attendance list entirely until it's set (Members → Edit Member → Duty
        // Schedule), same "not configured yet = hidden" rule the backfill above now follows.
        conditions.push(`e.duty_start_time IS NOT NULL AND e.duty_end_time IS NOT NULL`)
        // Someone who joined on the 15th has no attendance obligation on the 14th or earlier —
        // don't show them on a date before they actually joined, even if a stray record exists.
        conditions.push(`(e.joining_date IS NULL OR e.joining_date <= a.date)`)
        // Mirror at the other end of employment: a date after their own Termination Date (Members
        // → Deactivate) is never shown either, even if a stray record exists for it.
        conditions.push(`(e.termination_date IS NULL OR e.termination_date >= a.date)`)
        if (employeeId) {
            params.push(employeeId)
            conditions.push(`a.employee_id = $${params.length}`)
        }
    }

    const { rows } = await db.query(
        `SELECT a.*, ${EMPLOYEE_JOIN}
         FROM attendance a
         LEFT JOIN employees e ON e.id = a.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.clock_in ASC NULLS LAST`,
        params
    )

    // Total Break Time per record — same live-computed-from-attendance_breaks approach the
    // Attendance Report tab already uses (see the legacy branch of /api/attendance/report),
    // just added here too so the Daily Attendance list can show it per row.
    const attendanceIds = rows.map(r => r.id)
    const breakMsByAttendance: Record<string, number> = {}
    if (attendanceIds.length > 0) {
        const { rows: breaks } = await db.query(
            `SELECT attendance_id, start_time, end_time FROM attendance_breaks WHERE attendance_id = ANY($1)`,
            [attendanceIds]
        )
        breaks.forEach(b => {
            const start = new Date(b.start_time).getTime()
            const end = b.end_time ? new Date(b.end_time).getTime() : Date.now()
            breakMsByAttendance[b.attendance_id] = (breakMsByAttendance[b.attendance_id] || 0) + Math.max(0, end - start)
        })
    }
    const rowsWithBreaks = rows.map(r => ({ ...r, breakMs: breakMsByAttendance[r.id] || 0 }))

    return NextResponse.json(rowsWithBreaks)
}

// POST /api/attendance - mark attendance (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ to mark attendance
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { employee_id, date, clock_in, status, notes } = body

    if (!employee_id || !date) {
        return NextResponse.json(
            { error: 'employee_id and date are required' },
            { status: 400 }
        )
    }

    // Safety guard: Admins cannot override their own attendance manually
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin && employee_id === auth.employee.id) {
        return NextResponse.json({ error: 'Admins cannot manually override their own attendance records' }, { status: 403 })
    }

    const { rows: [data] } = await db.query(
        `WITH ups AS (
            INSERT INTO attendance (employee_id, date, clock_in, status, notes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (employee_id, date) DO UPDATE SET
                clock_in = EXCLUDED.clock_in, status = EXCLUDED.status, notes = EXCLUDED.notes
            RETURNING *
         )
         SELECT a.*, ${EMPLOYEE_JOIN}
         FROM ups a LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN departments d ON d.id = e.department_id`,
        [employee_id, date, clock_in || null, status || 'present', notes || null]
    )

    return NextResponse.json(data, { status: 201 })
}
