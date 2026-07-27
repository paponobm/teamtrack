import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = auth.supabase.from('point_transactions')
        .select(`
            *,
            employee:employees!point_transactions_employee_id_fkey(id, name, avatar_url),
            granted_by_user:employees!point_transactions_awarded_by_fkey(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (startDate) query = query.gte('created_at', startDate + 'T00:00:00.000Z')
    if (endDate) query = query.lte('created_at', endDate + 'T23:59:59.999Z')

    // Admin can see anyone's or everyone's history
    if (auth.employee.roleLevel <= 3) {
        if (employeeId) {
            query = query.eq('employee_id', employeeId)
        }
    } else {
        // Members can only see their own
        query = query.eq('employee_id', auth.employee.id)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ transactions: data })
}
