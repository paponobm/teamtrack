import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/performance (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const employeeId = searchParams.get('employee_id')
    const isAdmin = auth.employee.roleLevel <= 3

    let query = auth.supabase
        .from('performance_scores')
        .select(`
            *,
            employee:employees!employee_id(id, name, employee_id),
            category:point_categories(id, name, name_bn, max_points, sort_order),
            scorer:employees!scored_by(id, name)
        `)
        .eq('date', date)

    // Members can only see their own scores
    if (!isAdmin) {
        query = query.eq('employee_id', auth.employee.id)
    } else if (employeeId) {
        query = query.eq('employee_id', employeeId)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// POST /api/performance - bulk upsert scores (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    const scores = body.scores as {
        employee_id: string
        category_id: string
        date: string
        points: number
        scored_by?: string
    }[]

    if (!Array.isArray(scores) || scores.length === 0) {
        return NextResponse.json({ error: 'scores array required' }, { status: 400 })
    }

    for (const s of scores) {
        if (s.points < 0 || s.points > 10) {
            return NextResponse.json({ error: 'Points must be 0-10' }, { status: 400 })
        }
    }

    const { data, error } = await auth.supabase
        .from('performance_scores')
        .upsert(scores, { onConflict: 'employee_id,category_id,date' })
        .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: 'Scores saved', count: data?.length })
}

// DELETE /api/performance?employee_id=...&category_id=...&date=... - delete a score entry (Admin+)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const employee_id = searchParams.get('employee_id')
    const category_id = searchParams.get('category_id')
    const date = searchParams.get('date')

    if (!employee_id || !category_id || !date) {
        return NextResponse.json({ error: 'employee_id, category_id, and date are all required' }, { status: 400 })
    }

    const { error } = await auth.supabase
        .from('performance_scores')
        .delete()
        .eq('employee_id', employee_id)
        .eq('category_id', category_id)
        .eq('date', date)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
