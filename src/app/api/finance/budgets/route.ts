import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/finance/budgets
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || new Date().toISOString().slice(0, 7) // YYYY-MM

    const supabase = auth.supabase
    const { data: budgets, error } = await supabase
        .from('finance_budgets')
        .select(`
            *,
            category:finance_categories(*)
        `)
        .eq('period', period)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(budgets)
}

// POST /api/finance/budgets
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { category_id, period, amount } = body

    if (!category_id || !period || amount === undefined) {
        return NextResponse.json({ error: 'category_id, period, and amount are required' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
        .from('finance_budgets')
        .upsert({ category_id, period, amount }, { onConflict: 'category_id,period' })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/finance/budgets
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await auth.supabase.from('finance_budgets').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
