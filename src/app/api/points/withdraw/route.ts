import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const auth = await requireAuth(0)
        if (!isAuthed(auth)) return auth

        const supabase = auth.supabase
        const { amount } = await request.json()

        if (!amount || !Number.isInteger(amount) || amount < 500) {
            return NextResponse.json({ error: 'Minimum withdrawal amount is 500 points' }, { status: 400 })
        }

        // Get employee record (current points)
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('id, total_points')
            .eq('id', auth.employee.id)
            .single()

        if (empError || !employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        }

        // Calculate pending withdrawals
        const { data: pending } = await supabase
            .from('point_withdrawals')
            .select('amount')
            .eq('employee_id', employee.id)
            .eq('status', 'pending')

        const pendingTotal = pending?.reduce((sum, req) => sum + req.amount, 0) || 0
        const availableBalance = employee.total_points - pendingTotal

        if (availableBalance < amount) {
            return NextResponse.json({ 
                error: `Insufficient balance. You have ${employee.total_points} total points, but ${pendingTotal} points are pending withdrawal. Available: ${availableBalance}.`
            }, { status: 400 })
        }

        // Insert withdrawal request
        const { error: insertError } = await supabase
            .from('point_withdrawals')
            .insert({
                employee_id: employee.id,
                amount: amount,
                status: 'pending'
            })

        if (insertError) {
            console.error('Insert error:', insertError)
            return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Withdrawal requested successfully' })

    } catch (error) {
        console.error('Withdraw API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
