import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/notifications - get current user's notifications
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { data, error } = await auth.supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', auth.employee.id)
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const notifications = data || []
    const unread_count = notifications.filter(n => !n.is_read).length

    return NextResponse.json({ notifications, unread_count })
}

// PUT /api/notifications - mark as read
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()

    if (body.mark_all_read) {
        // Mark all as read for an employee
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('recipient_id', auth.employee.id) // ONLY allow marking own notifications
            .eq('is_read', false)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    if (body.id) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', body.id)
            .eq('recipient_id', auth.employee.id) // ONLY allow marking own notification (prevent IDOR)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
}

// DELETE /api/notifications - clear all read notifications for current user
export async function DELETE() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { error } = await auth.supabase
        .from('notifications')
        .delete()
        .eq('recipient_id', auth.employee.id)
        .eq('is_read', true)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
