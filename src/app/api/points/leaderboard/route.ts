import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (startDate && endDate) {
        // Aggregate points from point_transactions for the specific date range
        const { data: txs, error: txError } = await auth.supabase
            .from('point_transactions')
            .select('employee_id, points')
            .gte('created_at', startDate + 'T00:00:00.000Z')
            .lte('created_at', endDate + 'T23:59:59.999Z')

        if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

        // Get employees
        const { data: emps, error: empError } = await auth.supabase
            .from('employees')
            .select('id, name, avatar_url, designation, is_active')
            .eq('is_active', true)

        if (empError) return NextResponse.json({ error: empError.message }, { status: 500 })

        // Calculate points
        const pointsMap: Record<string, number> = {}
        txs.forEach(tx => {
            pointsMap[tx.employee_id] = (pointsMap[tx.employee_id] || 0) + tx.points
        })

        const leaderboard = emps.map(emp => ({
            ...emp,
            total_points: pointsMap[emp.id] || 0
        })).sort((a, b) => b.total_points - a.total_points)

        return NextResponse.json({ leaderboard })
    }

    // Default behavior without dates
    const { data, error } = await auth.supabase
        .from('employees')
        .select('id, name, avatar_url, total_points, designation, is_active')
        .eq('is_active', true)
        .order('total_points', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ leaderboard: data })
}
