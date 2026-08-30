import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const auth = await requireAuth(0)
        if (!isAuthed(auth)) return auth
        const db = auth.db

        const { amount } = await request.json()

        if (!amount || !Number.isInteger(amount) || amount < 500) {
            return NextResponse.json({ error: 'Minimum withdrawal amount is 500 points' }, { status: 400 })
        }

        // Get employee record (current points)
        const { rows: [employee] } = await db.query(`SELECT id, total_points FROM employees WHERE id = $1`, [auth.employee.id])

        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        }

        // Calculate pending withdrawals
        const { rows: pending } = await db.query(
            `SELECT amount FROM point_withdrawals WHERE employee_id = $1 AND status = 'pending'`,
            [employee.id]
        )

        const pendingTotal = pending.reduce((sum, req) => sum + req.amount, 0)
        const availableBalance = employee.total_points - pendingTotal

        if (availableBalance < amount) {
            return NextResponse.json({
                error: `Insufficient balance. You have ${employee.total_points} total points, but ${pendingTotal} points are pending withdrawal. Available: ${availableBalance}.`
            }, { status: 400 })
        }

        // Insert withdrawal request
        try {
            await db.query(
                `INSERT INTO point_withdrawals (employee_id, amount, status) VALUES ($1, $2, 'pending')`,
                [employee.id, amount]
            )
        } catch (insertError) {
            console.error('Insert error:', insertError)
            return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Withdrawal requested successfully' })

    } catch (error) {
        console.error('Withdraw API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
