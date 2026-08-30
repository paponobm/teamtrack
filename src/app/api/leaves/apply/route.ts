import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { startDate, endDate, reason } = body

    if (!startDate || !endDate || !reason) {
        return NextResponse.json({ error: 'Start date, end date, and reason are required' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Calculate difference in days (inclusive)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    if (diffDays > 3) {
        return NextResponse.json({ error: 'You can only apply for a maximum of 3 days at a time' }, { status: 400 })
    }
    if (diffDays < 1 || start > end) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    // Generate array of dates
    const dates: string[] = []
    for (let i = 0; i < diffDays; i++) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        dates.push(d.toISOString().split('T')[0])
    }

    await auth.db.query(
        `INSERT INTO leave_records (employee_id, leave_date, reason, status)
         SELECT $1, d, $2, 'pending' FROM UNNEST($3::date[]) AS d
         ON CONFLICT (employee_id, leave_date) DO UPDATE SET reason = EXCLUDED.reason, status = EXCLUDED.status`,
        [auth.employee.id, reason, dates]
    )

    return NextResponse.json({ success: true, count: dates.length })
}

export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT * FROM leave_records WHERE employee_id = $1 ORDER BY leave_date DESC`,
        [auth.employee.id]
    )

    return NextResponse.json({ records: rows })
}

export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const idsStr = searchParams.get('ids')

    if (!idsStr) {
        return NextResponse.json({ error: 'ids parameter is required' }, { status: 400 })
    }

    const ids = idsStr.split(',')

    // Make sure we only delete our own pending records
    await auth.db.query(
        `DELETE FROM leave_records WHERE id = ANY($1) AND employee_id = $2 AND status = 'pending'`,
        [ids, auth.employee.id]
    )

    return NextResponse.json({ success: true })
}
