import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/attendance/[id]/breaks/[breakId] - edit a break's start/end time (admin only)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; breakId: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id, breakId } = await params
    const body = await request.json().catch(() => ({}))

    const updateFields: Record<string, unknown> = {}
    if (body.start_time !== undefined) updateFields.start_time = body.start_time
    if (body.end_time !== undefined) updateFields.end_time = body.end_time

    const { data, error } = await auth.supabase
        .from('attendance_breaks')
        .update(updateFields)
        .eq('id', breakId)
        .eq('attendance_id', id)
        .select('id, start_time, end_time')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auth.supabase.from('audit_log').insert({
        actor_id: auth.employee.id,
        module: 'attendance',
        action: 'Edited a break',
        target_id: id,
        details: { actor_name: auth.employee.name },
    }).then(() => { })

    return NextResponse.json(data)
}

// DELETE /api/attendance/[id]/breaks/[breakId] - remove a break (admin only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; breakId: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id, breakId } = await params
    const { error } = await auth.supabase
        .from('attendance_breaks')
        .delete()
        .eq('id', breakId)
        .eq('attendance_id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auth.supabase.from('audit_log').insert({
        actor_id: auth.employee.id,
        module: 'attendance',
        action: 'Deleted a break',
        target_id: id,
        details: { actor_name: auth.employee.name },
    }).then(() => { })

    return NextResponse.json({ success: true })
}
