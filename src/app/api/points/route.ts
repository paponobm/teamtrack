import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/points - list point transactions (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3
    const employeeId = searchParams.get('employee_id')
    const source = searchParams.get('source')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = auth.supabase
        .from('point_transactions')
        .select(`
            *,
            employee:employees!employee_id(id, name, employee_id),
            awarder:employees!awarded_by(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

    // Members only see their own
    if (!isAdmin) {
        query = query.eq('employee_id', auth.employee.id)
    } else if (employeeId) {
        query = query.eq('employee_id', employeeId)
    }

    if (source) query = query.eq('source', source)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
}

// POST /api/points - award points (admin only for manual)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ for manual points
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { employee_id, points, source, source_id, description } = body

    if (!employee_id || !points || !source) {
        return NextResponse.json({ error: 'employee_id, points, and source are required' }, { status: 400 })
    }

    // Safety guard: nobody can manually award points to themselves (anti-fraud), including super admins.
    if (employee_id === auth.employee.id) {
        return NextResponse.json({ error: 'You cannot manually award points to yourself' }, { status: 403 })
    }

    await awardPoints(
        auth.supabase,
        employee_id,
        points,
        source,
        source_id || null,
        description || `${points} points awarded`,
        auth.employee.id
    )

    return NextResponse.json({ success: true, points })
}
