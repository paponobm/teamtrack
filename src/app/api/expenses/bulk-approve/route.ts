import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

interface PendingExpense {
    id: string
    submitted_by: string | null
    amount: number
    payment_status: string
    created_at: string
}

// POST /api/expenses/bulk-approve - approve many pending expenses at once (Super Admin only).
// Mirrors the single-approve rules in PUT /api/expenses exactly (same fund-overdraw guard,
// same approved_by stamping), just applied to a batch.
export async function POST(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const ids: string[] = Array.isArray(body.ids) ? body.ids : []
    if (ids.length === 0) return NextResponse.json({ error: 'No expenses selected' }, { status: 400 })

    const { data: expenses, error } = await auth.supabase
        .from('expenses')
        .select('id, submitted_by, amount, payment_status, created_at')
        .in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const pending = ((expenses || []) as PendingExpense[]).filter(e => e.payment_status === 'pending')
    if (pending.length === 0) return NextResponse.json({ approved: 0, skipped: [] })

    // Group by submitter so each submitter's fund is checked cumulatively across the whole
    // batch — approving several of their expenses in one call must not collectively overdraw
    // the fund even though each looks fine individually against the pre-batch balance.
    const bySubmitter = new Map<string, PendingExpense[]>()
    for (const e of pending) {
        const key = e.submitted_by || ''
        if (!bySubmitter.has(key)) bySubmitter.set(key, [])
        bySubmitter.get(key)!.push(e)
    }

    const approvedIds: string[] = []
    const skipped: { id: string; reason: string }[] = []

    for (const [submittedBy, group] of bySubmitter) {
        if (!submittedBy) {
            approvedIds.push(...group.map(e => e.id))
            continue
        }

        const { data: allocs } = await auth.supabase.from('fund_allocations').select('amount').eq('employee_id', submittedBy)
        if (!allocs || allocs.length === 0) {
            // Not a fund holder — unlimited, same rule as the single-approve endpoint.
            approvedIds.push(...group.map(e => e.id))
            continue
        }

        const allocated = allocs.reduce((s, a) => s + Number(a.amount || 0), 0)
        const { data: paidExp } = await auth.supabase.from('expenses').select('amount').eq('submitted_by', submittedBy).eq('payment_status', 'paid')
        let remaining = allocated - (paidExp || []).reduce((s, e) => s + Number(e.amount || 0), 0)

        // Deterministic order (oldest first) so which ones get skipped is predictable.
        const ordered = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        for (const e of ordered) {
            const amt = Number(e.amount || 0)
            if (amt <= remaining) {
                approvedIds.push(e.id)
                remaining -= amt
            } else {
                skipped.push({ id: e.id, reason: 'Exceeds available fund' })
            }
        }
    }

    if (approvedIds.length > 0) {
        const { error: updateError } = await auth.supabase
            .from('expenses')
            .update({ payment_status: 'paid', approved_by: auth.employee.id })
            .in('id', approvedIds)
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ approved: approvedIds.length, skipped })
}
