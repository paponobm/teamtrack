import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/work-log/check - toggle management check on a work entry. Admin only.
export async function PUT(req: NextRequest) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await req.json()
    const { entry_id, management_check } = body
    // Actor is always the authenticated admin — never trust a client-supplied checked_by.
    const checkedBy = auth.employee.id
    // The toggle sends a boolean, but management_check / checked_by are UUID FK columns.
    // Approving stores the approver's id; un-approving clears it to NULL.
    const approving = management_check ?? true

    if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })

    const { data, error } = await supabase
        .from('work_entries')
        .update({
            management_check: approving ? checkedBy : null,
            checked_by: approving ? checkedBy : null,
            checked_at: approving ? new Date().toISOString() : null,
        })
        .eq('id', entry_id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log audit event
    await supabase.from('audit_log').insert({
        actor_id: checkedBy,
        action: management_check ? 'approved work entry' : 'unapproved work entry',
        module: 'work_log',
        target_id: entry_id,
    }).then(() => { })

    return NextResponse.json(data)
}
