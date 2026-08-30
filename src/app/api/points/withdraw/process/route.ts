import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const auth = await requireAuth(3) // 3=Admin
    if (!isAuthed(auth)) return auth
    const db = auth.db

    try {
        const { id, action } = await request.json()
        if (!id || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
        }

        // Get withdrawal request
        const { rows: [reqRow] } = await db.query(`SELECT * FROM point_withdrawals WHERE id = $1`, [id])

        if (!reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
        if (reqRow.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 400 })

        const newStatus = action === 'approve' ? 'approved' : 'rejected'

        // On approve, ensure the member still has enough points (never drive the balance negative).
        if (action === 'approve') {
            const { rows: [emp] } = await db.query(`SELECT total_points FROM employees WHERE id = $1`, [reqRow.employee_id])
            if (!emp || (emp.total_points || 0) < reqRow.amount) {
                return NextResponse.json({ error: 'Member no longer has enough points to cover this withdrawal.' }, { status: 400 })
            }
        }

        // Atomically claim the request: flip pending -> new status only if still pending.
        // This guarantees only one processing wins, preventing double-deduct / double-pay.
        let claimed
        try {
            const { rows } = await db.query(
                `UPDATE point_withdrawals SET status = $1, processed_at = NOW(), processed_by = $2
                 WHERE id = $3 AND status = 'pending' RETURNING id`,
                [newStatus, auth.employee.id, id]
            )
            claimed = rows
        } catch (claimError) {
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
                    db,
                    reqRow.employee_id,
                    -Math.abs(reqRow.amount), // Deduct
                    'withdrawal',
                    null,
                    'Points converted to BDT',
                    auth.employee.id
                )
            } catch (deductError) {
                // Roll the request back to pending so the points stay consistent with the ledger.
                await db.query(`UPDATE point_withdrawals SET status = 'pending', processed_at = NULL, processed_by = NULL WHERE id = $1`, [id])
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
