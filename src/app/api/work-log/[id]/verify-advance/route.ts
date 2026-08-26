import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// POST /api/work-log/[id]/verify-advance - mark an entry's advance payment as verified.
// Admin / Super Admin / Manager only (roleLevel <= 4).
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(4)
    if (!isAuthed(auth)) return auth

    const { id } = await params

    const { data: entryRow, error: fetchErr } = await auth.supabase
        .from('work_entries')
        .select('advance, advance_verified, sl, invoice_no, date, payment_gateway, business_name')
        .eq('id', id)
        .single()

    if (fetchErr || !entryRow) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    if (!entryRow.advance || Number(entryRow.advance) <= 0) {
        return NextResponse.json({ error: 'This entry has no advance payment to verify' }, { status: 400 })
    }
    if (entryRow.advance_verified) {
        return NextResponse.json({ error: 'This advance payment is already verified' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { data, error } = await auth.supabase
        .from('work_entries')
        .update({ advance_verified: true, verified_by: auth.employee.id, verified_at: now })
        .eq('id', id)
        .select(`
            *,
            employee:employees!employee_id(id, name, employee_id),
            verifier:employees!verified_by(id, name)
        `)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const orderLabel = entryRow.invoice_no || `#${entryRow.sl}`
    await logAudit(
        auth.employee.id,
        `Verified advance payment of ৳${entryRow.advance} for order ${orderLabel}`,
        'work_log',
        id
    )

    // Mirrors the now-verified advance into Finance Hub's Income Hub (source 'Advance'), same
    // "linked record" pattern EMI/Advance/Product Buy already use to mirror into Expenses —
    // best-effort: a failed mirror doesn't block verification itself, since work_entries is
    // the record of truth for advance verification. work_entry_id (unique, see migration
    // 067_income_work_entry_link.sql) means this can never double-insert for the same order.
    await auth.supabase.from('income').insert({
        date: entryRow.date,
        description: `Advance payment — Order ${orderLabel}`,
        amount: entryRow.advance,
        source: 'Advance',
        note: entryRow.payment_gateway ? `Paid via ${entryRow.payment_gateway}` : null,
        business_name: entryRow.business_name || null,
        work_entry_id: id,
        added_by: auth.employee.id,
    })

    return NextResponse.json(data)
}
