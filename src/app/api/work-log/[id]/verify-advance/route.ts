import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// POST /api/work-log/[id]/verify-advance - mark an entry's advance payment as verified.
// Admin / Super Admin only (roleLevel <= 3) — Manager is deliberately excluded.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id } = await params

    const { rows: [entryRow] } = await db.query(
        `SELECT advance, advance_verified, sl, invoice_no, date, payment_gateway, business_name FROM work_entries WHERE id = $1`,
        [id]
    )

    if (!entryRow) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    if (!entryRow.advance || Number(entryRow.advance) <= 0) {
        return NextResponse.json({ error: 'This entry has no advance payment to verify' }, { status: 400 })
    }
    if (entryRow.advance_verified) {
        return NextResponse.json({ error: 'This advance payment is already verified' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { rows: [data] } = await db.query(
        `WITH upd AS (
            UPDATE work_entries SET advance_verified = true, verified_by = $1, verified_at = $2 WHERE id = $3 RETURNING *
         )
         SELECT w.*,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id) AS employee,
            json_build_object('id', v.id, 'name', v.name) AS verifier
         FROM upd w LEFT JOIN employees e ON e.id = w.employee_id LEFT JOIN employees v ON v.id = w.verified_by`,
        [auth.employee.id, now, id]
    )

    const orderLabel = entryRow.invoice_no || `#${entryRow.sl}`
    await logAudit(
        auth.employee.id,
        `Verified advance payment of ৳${entryRow.advance} for order ${orderLabel}`,
        'work_log',
        id
    )

    // Mirrors the now-verified advance into Finance Hub's Income Hub (source 'Order Advance' —
    // named to stay distinct from Finance Hub's own separate "Salary Advance" concept, see
    // migration 070_income_order_advance_source_rename.sql), same "linked record" pattern
    // EMI/Advance/Product Buy already use to mirror into Expenses — best-effort: a failed
    // mirror doesn't block verification itself, since work_entries is the record of truth for
    // advance verification. work_entry_id (unique, see migration
    // 067_income_work_entry_link.sql) means this can never double-insert for the same order.
    await db.query(
        `INSERT INTO income (date, description, amount, source, note, business_name, work_entry_id, added_by)
         VALUES ($1, $2, $3, 'Order Advance', $4, $5, $6, $7)`,
        [
            entryRow.date,
            `Advance payment — Order ${orderLabel}`,
            entryRow.advance,
            entryRow.payment_gateway ? `Paid via ${entryRow.payment_gateway}` : null,
            entryRow.business_name || null,
            id,
            auth.employee.id,
        ]
    )

    return NextResponse.json(data)
}
