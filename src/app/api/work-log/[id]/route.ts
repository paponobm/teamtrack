import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { awardPoints } from '@/lib/auth'

// PATCH /api/work-log/[id] - update work entry (admin or owner of entry)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(0) // Any authed user
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const body = await request.json()
    const isAdmin = auth.employee.roleLevel <= 3

    // Fetch old entry (full row) to detect changes, status transitions and ownership
    const { data: oldEntry } = await auth.supabase.from('work_entries').select('*').eq('id', id).single()

    if (!oldEntry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only Admins or the owner can edit
    if (!isAdmin && oldEntry.employee_id !== auth.employee.id) {
        return NextResponse.json({ error: 'Unauthorized to edit this entry' }, { status: 403 })
    }

    const { data, error } = await auth.supabase
        .from('work_entries')
        .update(body)
        .eq('id', id)
        .select(`*, employee:employees!employee_id(id, name, employee_id)`)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Record a field-level diff so the entry's history shows exactly what changed (#7).
    const TRACKED_FIELDS = ['order_type', 'source', 'amount', 'suggested_amount', 'delivery_status', 'customer_name', 'customer_phone', 'product_details', 'business_name', 'quantity', 'notes', 'date', 'logistics', 'payment_gateway', 'transaction_id']
    const changes: { field: string; from: unknown; to: unknown }[] = []
    for (const k of Object.keys(body)) {
        if (TRACKED_FIELDS.includes(k) && String(oldEntry[k] ?? '') !== String(body[k] ?? '')) {
            changes.push({ field: k, from: oldEntry[k] ?? null, to: body[k] ?? null })
        }
    }
    await logAudit(auth.employee.id, 'Updated work log entry', 'work_log', id, { actor_name: auth.employee.name, changes })

    let awardedPoints = 0
    if (body.delivery_status === 'delivered' && oldEntry?.delivery_status !== 'delivered') {
        const pointMap: Record<string, number> = {
            'normal': 5,
            'suggested': 10,
            '2000_plus': 20,
            '3000_plus': 50,
            '5000_plus': 100,
            'upsell': 20,
            'incomplete': 10,
        }
        const pts = pointMap[body.order_type || data.order_type || 'normal'] || 0
        if (pts > 0) {
            await awardPoints(auth.supabase, data.employee_id, pts, 'work_log', data.id, `Order delivered (${body.order_type || data.order_type || 'normal'})`, auth.employee.id)
            awardedPoints = pts
        }
    }

    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/work-log/[id] (admin only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const { error } = await auth.supabase.from('work_entries').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAudit(auth.employee.id, 'Deleted work log entry', 'work_log', id)
    return NextResponse.json({ message: 'Entry deleted' })
}
