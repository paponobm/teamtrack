import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/income
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
        .from('income')
        .select(`*, adder:employees!added_by(id, name)`)
        .order('created_at', { ascending: false })

    // Income privacy: Super Admins (Owner/Super Admin, level <= 2) see ALL income.
    // A regular Admin only sees the income entries they personally added.
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) query = query.eq('added_by', auth.employee.id)

    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const entries = data || []
    const totalIncome = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0)

    return NextResponse.json({ entries, totalIncome })
}

// POST /api/income
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const body = await request.json()

    const { data, error } = await supabase
        .from('income')
        .insert({
            date: body.date || new Date().toISOString().split('T')[0],
            description: body.description || null,
            amount: body.amount || 0,
            source: body.source || null,
            fund_id: body.fund_id || null,
            note: body.note || null,
            business_name: body.business_name || null,
            added_by: auth.employee.id,
        })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// PATCH /api/income - edit an income entry (Super Admin+)
export async function PATCH(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Only allow updating safe fields (note: the income table has no invoice_id column)
    const allowed = ['date', 'description', 'amount', 'source', 'fund_id', 'note', 'business_name']
    const safeUpdates: Record<string, unknown> = {}
    for (const key of allowed) {
        if (key in updates) safeUpdates[key] = updates[key]
    }

    if (Object.keys(safeUpdates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // A regular Admin may only edit income they added; Super Admins may edit any.
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const { data: existing } = await supabase.from('income').select('added_by').eq('id', id).single()
        if (existing && existing.added_by !== auth.employee.id) {
            return NextResponse.json({ error: 'You can only edit income you added' }, { status: 403 })
        }
    }

    const { data, error } = await supabase
        .from('income')
        .update(safeUpdates)
        .eq('id', id)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// DELETE /api/income
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // A regular Admin may only delete income they added; Super Admins may delete any.
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const { data: existing } = await supabase.from('income').select('added_by').eq('id', id).single()
        if (existing && existing.added_by !== auth.employee.id) {
            return NextResponse.json({ error: 'You can only delete income you added' }, { status: 403 })
        }
    }

    const { error } = await supabase.from('income').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
