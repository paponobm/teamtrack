import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/notifications - get current user's notifications
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [auth.employee.id]
    )

    const unread_count = rows.filter(n => !n.is_read).length

    return NextResponse.json({ notifications: rows, unread_count })
}

// PUT /api/notifications - mark as read
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()

    if (body.mark_all_read) {
        // Mark all as read for an employee
        await db.query(
            `UPDATE notifications SET is_read = true WHERE recipient_id = $1 AND is_read = false`,
            [auth.employee.id]
        )
        return NextResponse.json({ success: true })
    }

    if (body.id) {
        await db.query(
            `UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2`, // ONLY allow marking own notification (prevent IDOR)
            [body.id, auth.employee.id]
        )
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
}

// DELETE /api/notifications - clear all read notifications for current user
export async function DELETE() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    await auth.db.query(
        `DELETE FROM notifications WHERE recipient_id = $1 AND is_read = true`,
        [auth.employee.id]
    )

    return NextResponse.json({ success: true })
}
