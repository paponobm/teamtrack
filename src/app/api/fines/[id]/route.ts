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
    const db = auth.db
    const body = await request.json()

    const update: Record<string, string | null> = {}

    if (body.payment_status !== undefined) {
        if (body.payment_status !== 'Paid' && body.payment_status !== 'Unpaid') {
            return NextResponse.json({ error: 'payment_status must be Paid or Unpaid' }, { status: 400 })
        }
        update.payment_status = body.payment_status
        // Stamped/cleared alongside payment_status so getFineTotalsForMonth (src/lib/payroll.ts)
        // knows which month this fine was actually settled in — marking Paid here (outside a
        // payroll run) settles it as of the current month; marking back Unpaid re-opens it.
        update.settled_month = body.payment_status === 'Paid'
            ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
            : null
    }

    if (body.category !== undefined) {
        if (!body.category) return NextResponse.json({ error: 'category cannot be empty' }, { status: 400 })
        update.category = body.category
    }

    if (body.reason !== undefined) {
        if (!body.reason) return NextResponse.json({ error: 'reason cannot be empty' }, { status: 400 })
        update.reason = body.reason
    }

    const keys = Object.keys(update)
    if (keys.length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE fines SET ${setClauses.join(', ')} WHERE id = $1 RETURNING id`,
        [id, ...keys.map(k => update[k])]
    )

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
    const db = auth.db

    const { rows: [fine] } = await db.query(`SELECT member_id, amount, status FROM fines WHERE id = $1`, [id])
    if (!fine) return NextResponse.json({ error: 'Fine not found' }, { status: 404 })

    await db.query(`DELETE FROM fines WHERE id = $1`, [id])

    if (fine.status !== 'Waived') {
        await awardPoints(db, fine.member_id, Math.abs(fine.amount), 'Fine Deleted', id, 'Fine record deleted by admin', auth.employee.id)
    }

    return NextResponse.json({ success: true })
}
