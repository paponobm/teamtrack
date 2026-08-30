import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/attendance/me - get today's attendance & breaks for the logged-in user
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // 1. Get attendance record for today
    const { rows: [attendance] } = await db.query(
        `SELECT * FROM attendance WHERE employee_id = $1 AND date = $2`,
        [auth.employee.id, date]
    )

    if (!attendance) {
        return NextResponse.json({ record: null, breaks: [] })
    }

    // 2. Get breaks for this attendance record
    const { rows: breaks } = await db.query(
        `SELECT * FROM attendance_breaks WHERE attendance_id = $1 ORDER BY start_time ASC`,
        [attendance.id]
    )

    return NextResponse.json({ record: attendance, breaks })
}

// POST /api/attendance/me - clock_in, clock_out, start_break, end_break
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { action, date } = body // action: 'clock_in', 'clock_out', 'start_break', 'end_break'

    if (!action || !date) {
        return NextResponse.json({ error: 'Action and date are required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Ensure attendance record exists
    let { rows: [attendance] } = await db.query(
        `SELECT * FROM attendance WHERE employee_id = $1 AND date = $2`,
        [auth.employee.id, date]
    )

    if (action === 'clock_in') {
        // Late if clocking in more than 15 minutes after the employee's duty start time
        // (falls back to 09:00 if not set, matching the threshold used in /api/attendance/absent).
        const { rows: [empRow] } = await db.query(`SELECT duty_start_time FROM employees WHERE id = $1`, [auth.employee.id])

        const startTime = empRow?.duty_start_time || '09:00:00'
        const [dutyH, dutyM] = startTime.split(':').map(Number)
        const shiftStart = new Date(`${date}T00:00:00`)
        shiftStart.setHours(dutyH, dutyM, 0, 0)
        const LATE_GRACE_MS = 15 * 60 * 1000
        const clockInStatus = Date.now() - shiftStart.getTime() > LATE_GRACE_MS ? 'late' : 'present'

        if (!attendance) {
            const { rows: [newAtt] } = await db.query(
                `INSERT INTO attendance (employee_id, date, clock_in, status) VALUES ($1, $2, $3, $4) RETURNING *`,
                [auth.employee.id, date, now, clockInStatus]
            )
            attendance = newAtt
        } else if (!attendance.clock_in) {
            const { rows: [updAtt] } = await db.query(
                `UPDATE attendance SET clock_in = $1, status = $2 WHERE id = $3 RETURNING *`,
                [now, clockInStatus, attendance.id]
            )
            attendance = updAtt
        }
    } else if (action === 'clock_out') {
        if (!attendance) return NextResponse.json({ error: 'Must clock in first' }, { status: 400 })
        const { rows: [updAtt] } = await db.query(
            `UPDATE attendance SET clock_out = $1 WHERE id = $2 RETURNING *`,
            [now, attendance.id]
        )
        attendance = updAtt
    } else if (action === 'start_break') {
        if (!attendance) return NextResponse.json({ error: 'Must clock in first' }, { status: 400 })
        // Guard against double-tap: don't open a second break while one is already open
        // (orphan open breaks corrupt the day's net-hours math).
        const { rows: openBreaks } = await db.query(
            `SELECT id FROM attendance_breaks WHERE attendance_id = $1 AND end_time IS NULL LIMIT 1`,
            [attendance.id]
        )
        if (openBreaks.length > 0) {
            return NextResponse.json({ error: 'A break is already in progress' }, { status: 400 })
        }
        await db.query(`INSERT INTO attendance_breaks (attendance_id, start_time) VALUES ($1, $2)`, [attendance.id, now])
    } else if (action === 'end_break') {
        if (!attendance) return NextResponse.json({ error: 'No active attendance' }, { status: 400 })

        // Find active break
        const { rows: activeBreaks } = await db.query(
            `SELECT * FROM attendance_breaks WHERE attendance_id = $1 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1`,
            [attendance.id]
        )

        if (activeBreaks.length > 0) {
            await db.query(`UPDATE attendance_breaks SET end_time = $1 WHERE id = $2`, [now, activeBreaks[0].id])
        } else {
            return NextResponse.json({ error: 'No active break found' }, { status: 400 })
        }
    } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Fetch fresh breaks to return
    let breaks: unknown[] = []
    if (attendance) {
        const { rows: freshBreaks } = await db.query(
            `SELECT * FROM attendance_breaks WHERE attendance_id = $1 ORDER BY start_time ASC`,
            [attendance.id]
        )
        breaks = freshBreaks
    }

    return NextResponse.json({ record: attendance, breaks })
}
