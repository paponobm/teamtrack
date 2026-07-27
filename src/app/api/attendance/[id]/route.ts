import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/attendance/[id] - update attendance record (clock out, status change, notes). Admin only.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { id } = await params
    const body = await request.json()

    // Get old record for logging
    const { data: oldRecord } = await supabase
        .from('attendance')
        .select('clock_in, clock_out, status, notes')
        .eq('id', id)
        .single()

    const updateFields: Record<string, unknown> = {}

    if (body.clock_out !== undefined) updateFields.clock_out = body.clock_out
    if (body.clock_in !== undefined) updateFields.clock_in = body.clock_in
    if (body.status !== undefined) updateFields.status = body.status
    if (body.notes !== undefined) updateFields.notes = body.notes

    const { data, error } = await supabase
        .from('attendance')
        .update(updateFields)
        .eq('id', id)
        .select(`
            *,
            employee:employees(id, name, employee_id, designation, department:departments(id, name))
        `)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log changes
    {
        const actor = auth.employee

        if (actor) {
            const changes: string[] = []
            if (body.clock_out !== undefined && body.clock_out !== oldRecord?.clock_out) {
                changes.push(`clock_out: ${oldRecord?.clock_out || 'none'} → ${body.clock_out}`)
            }
            if (body.clock_in !== undefined && body.clock_in !== oldRecord?.clock_in) {
                changes.push(`clock_in: ${oldRecord?.clock_in || 'none'} → ${body.clock_in}`)
            }
            if (body.status !== undefined && body.status !== oldRecord?.status) {
                changes.push(`status: ${oldRecord?.status || 'none'} → ${body.status}`)
            }

            if (changes.length > 0) {
                await supabase.from('audit_log').insert({
                    actor_id: actor.id,
                    module: 'attendance',
                    action: 'update',
                    target_id: id,
                    old_value: JSON.stringify({ clock_out: oldRecord?.clock_out, status: oldRecord?.status }),
                    new_value: JSON.stringify(updateFields),
                    details: { actor_name: actor.name, changes },
                }).then(() => { })
            }
        }
    }

    return NextResponse.json(data)
}

// DELETE /api/attendance/[id] - hard delete an attendance record (Super Admin only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const adminClient = createAdminClient()
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: actor } = await adminClient.from('employees')
        .select('id, name, role:roles(level)')
        .eq('user_id', user.id)
        .single()

    const roleLevel = (actor?.role as unknown as { level: number })?.level ?? 99
    if (roleLevel > 2) {
        return NextResponse.json({ error: 'Super Admin only' }, { status: 403 })
    }

    const { id } = await params
    const { error } = await adminClient.from('attendance').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Audit log
    if (actor) {
        await adminClient.from('audit_log').insert({
            actor_id: actor.id,
            module: 'attendance',
            action: 'delete',
            target_id: id,
            details: { actor_name: actor.name },
        }).then(() => {})
    }

    return NextResponse.json({ message: 'Attendance record deleted' })
}
