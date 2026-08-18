import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/fines/:id — edit a fine's category/reason/payment_status (Admin+, level <= 3).
// Separate from /appeal (member-initiated) and /review (Super Admin waive/reject) — this never
// touches status or appeal_reason. Amount and member_id are deliberately NOT editable here:
// the fine's points were already deducted from a specific employee for a specific amount at
// issue time (see POST /api/fines), and there's no reconciliation logic to re-adjust that
// deduction if either changed after the fact — allowing it would silently desync total_points
// from the fine record. Marking Paid here doesn't move any points either — that's a separate
// concern (see the payment_status doc comment below).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase
    const body = await request.json()

    const update: Record<string, string> = {}

    if (body.payment_status !== undefined) {
        if (body.payment_status !== 'Paid' && body.payment_status !== 'Unpaid') {
            return NextResponse.json({ error: 'payment_status must be Paid or Unpaid' }, { status: 400 })
        }
        update.payment_status = body.payment_status
    }

    if (body.category !== undefined) {
        if (!body.category) return NextResponse.json({ error: 'category cannot be empty' }, { status: 400 })
        update.category = body.category
    }

    if (body.reason !== undefined) {
        if (!body.reason) return NextResponse.json({ error: 'reason cannot be empty' }, { status: 400 })
        update.reason = body.reason
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('fines')
        .update(update)
        .eq('id', id)
        .select('id')
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Fine not found' }, { status: 404 })

    return NextResponse.json({ success: true })
}

// DELETE /api/fines/:id (Admin+) — removes the fine record entirely. If it hadn't already been
// Waived (which already refunded its points via /review), refunds the points here too, so
// deleting a fine undoes its effect the same way waiving one does — no permanent point loss for
// a record that no longer exists.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase

    const { data: fine } = await supabase.from('fines').select('member_id, amount, status').eq('id', id).maybeSingle()
    if (!fine) return NextResponse.json({ error: 'Fine not found' }, { status: 404 })

    const { error } = await supabase.from('fines').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (fine.status !== 'Waived') {
        await awardPoints(supabase, fine.member_id, Math.abs(fine.amount), 'Fine Deleted', id, 'Fine record deleted by admin', auth.employee.id)
    }

    return NextResponse.json({ success: true })
}
