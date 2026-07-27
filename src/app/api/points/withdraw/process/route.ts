import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const auth = await requireAuth(3) // 3=Admin
    if (!isAuthed(auth)) return auth

    try {
        const { id, action } = await request.json()
        if (!id || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
        }

        // Get withdrawal request
        const { data: req, error: reqError } = await auth.supabase
            .from('point_withdrawals')
            .select('*')
            .eq('id', id)
            .single()

        if (reqError || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
        if (req.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 400 })

        const newStatus = action === 'approve' ? 'approved' : 'rejected'

        // On approve, ensure the member still has enough points (never drive the balance negative).
        if (action === 'approve') {
            const { data: emp } = await auth.supabase
                .from('employees')
                .select('total_points')
                .eq('id', req.employee_id)
                .single()
            if (!emp || (emp.total_points || 0) < req.amount) {
                return NextResponse.json({ error: 'Member no longer has enough points to cover this withdrawal.' }, { status: 400 })
            }
        }

        // Atomically claim the request: flip pending -> new status only if still pending.
        // This guarantees only one processing wins, preventing double-deduct / double-pay.
        const { data: claimed, error: claimError } = await auth.supabase
            .from('point_withdrawals')
            .update({
                status: newStatus,
                processed_at: new Date().toISOString(),
                processed_by: auth.employee.id,
            })
            .eq('id', id)
            .eq('status', 'pending')
            .select('id')

        if (claimError) {
            console.error('Update withdrawal error:', claimError)
            return NextResponse.json({ error: 'Failed to update withdrawal status' }, { status: 500 })
        }
        if (!claimed || claimed.length === 0) {
            return NextResponse.json({ error: 'Request already processed' }, { status: 400 })
        }

        // Only after successfully claiming do we deduct points.
        if (action === 'approve') {
            try {
                await awardPoints(
                    auth.supabase,
                    req.employee_id,
                    -Math.abs(req.amount), // Deduct
                    'withdrawal',
                    null,
                    'Points converted to BDT',
                    auth.employee.id
                )
            } catch (deductError) {
                // Roll the request back to pending so the points stay consistent with the ledger.
                await auth.supabase.from('point_withdrawals').update({ status: 'pending', processed_at: null, processed_by: null }).eq('id', id)
                console.error('Failed to deduct points:', deductError)
                return NextResponse.json({ error: 'Failed to deduct points' }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true, message: `Withdrawal ${newStatus} successfully` })

    } catch (error) {
        console.error('Process withdrawal API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
