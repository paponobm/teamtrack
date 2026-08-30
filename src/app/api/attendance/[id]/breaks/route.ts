import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/attendance/[id]/breaks - list breaks for an attendance record (admin only)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const { rows } = await auth.db.query(
        `SELECT id, start_time, end_time FROM attendance_breaks WHERE attendance_id = $1 ORDER BY start_time ASC`,
        [id]
    )
    return NextResponse.json(rows)
}

// POST /api/attendance/[id]/breaks - add a break to an attendance record (admin only)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const start_time = body.start_time || new Date().toISOString()
    const end_time = body.end_time || null

    const { rows: [data] } = await db.query(
        `INSERT INTO attendance_breaks (attendance_id, start_time, end_time) VALUES ($1, $2, $3) RETURNING id, start_time, end_time`,
        [id, start_time, end_time]
    )

    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, details)
         VALUES ($1, 'attendance', 'Added a break', $2, $3)`,
        [auth.employee.id, id, JSON.stringify({ actor_name: auth.employee.name })]
    )

    return NextResponse.json(data, { status: 201 })
}
