import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/attendance/me/history - get attendance & breaks for the logged-in user in a given month
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)

    const now = new Date()
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()))

    // Build start and end dates for the month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    // 1. Get attendance records for this month
    const { rows: attendanceRecords } = await db.query(
        `SELECT * FROM attendance WHERE employee_id = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
        [auth.employee.id, startDate, endDate]
    )

    if (attendanceRecords.length === 0) {
        return NextResponse.json({ records: [], breaks: [] })
    }

    const attendanceIds = attendanceRecords.map(r => r.id)

    // 2. Get breaks for these attendance records
    const { rows: breaks } = await db.query(
        `SELECT * FROM attendance_breaks WHERE attendance_id = ANY($1) ORDER BY start_time ASC`,
        [attendanceIds]
    )

    return NextResponse.json({ records: attendanceRecords, breaks })
}
