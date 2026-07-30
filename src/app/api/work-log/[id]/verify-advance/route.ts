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
        .select('advance, advance_verified, sl, invoice_no')
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

    return NextResponse.json(data)
}
