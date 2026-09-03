import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// PATCH /api/work-log/[id] - update work entry (admin or owner of entry)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(0) // Any authed user
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id } = await params
    const body = await request.json()
    // Manager gets full Work Log parity with Admin — can edit any member's entry.
    const isAdmin = auth.employee.roleLevel <= 4

    // Fetch old entry (full row) to detect changes, status transitions and ownership
    const { rows: [oldEntry] } = await db.query(`SELECT * FROM work_entries WHERE id = $1`, [id])

    if (!oldEntry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only Admins or the owner can edit
    if (!isAdmin && oldEntry.employee_id !== auth.employee.id) {
        return NextResponse.json({ error: 'Unauthorized to edit this entry' }, { status: 403 })
    }

    const keys = Object.keys(body)
    if (keys.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `WITH upd AS (
            UPDATE work_entries SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *
         )
         SELECT w.*, json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id) AS employee
         FROM upd w LEFT JOIN employees e ON e.id = w.employee_id`,
        [id, ...keys.map(k => body[k])]
    )

    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
        // order_type is multi-select — sum points across every type tagged on the order.
        const orderTypes: string[] = (data.order_type && data.order_type.length > 0) ? data.order_type : ['normal']
        const pts = orderTypes.reduce((sum, ot) => sum + (pointMap[ot] || 0), 0)
        if (pts > 0) {
            await awardPoints(db, data.employee_id, pts, 'work_log', data.id, `Order delivered (${orderTypes.join(', ')})`, auth.employee.id)
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
    await auth.db.query(`DELETE FROM work_entries WHERE id = $1`, [id])
    await logAudit(auth.employee.id, 'Deleted work log entry', 'work_log', id)
    return NextResponse.json({ message: 'Entry deleted' })
}
