import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const auth = await requireAuth(5) // Level 5 (Member) can view
    if (!isAuthed(auth)) return auth

    const { supabase, employee } = auth
    const { searchParams } = new URL(request.url)

    try {
        let query = supabase
            .from('fines')
            .select(`
                *,
                member:employees!fines_member_id_fkey(id, name),
                issued_by_user:employees!fines_issued_by_fkey(id, name)
            `)
            .order('created_at', { ascending: false })

        // If not an admin, only show their own fines
        if (employee.roleLevel > 3) {
            query = query.eq('member_id', employee.id)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching fines:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const auth = await requireAuth(3) // Only Admin (level <= 3) can issue fines
    if (!isAuthed(auth)) return auth

    const { supabase, employee } = auth

    try {
        const payload = await request.json()
        const { member_id, amount, category, reason } = payload

        if (!member_id || !amount || !category || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (amount <= 0) {
            return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
        }

        // Insert into fines
        const { data, error } = await supabase
            .from('fines')
            .insert({
                member_id,
                issued_by: employee.id,
                amount,
                category,
                reason,
                status: 'Active'
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating fine:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Deduct points from the member
        await awardPoints(
            supabase,
            member_id,
            -Math.abs(amount), // Negative amount for deduction
            'Fine',
            data.id,
            `Fine: ${category} - ${reason}`,
            employee.id
        )

        return NextResponse.json({ data })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
