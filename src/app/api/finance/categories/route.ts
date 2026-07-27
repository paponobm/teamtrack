import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/finance/categories
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { data, error } = await supabase
        .from('finance_categories')
        .select('*')
        .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// POST /api/finance/categories
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { name, type, parent_id } = body

    if (!name || !type) return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })

    const { data, error } = await auth.supabase
        .from('finance_categories')
        .insert({ name, type, parent_id: parent_id || null })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/finance/categories
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await auth.supabase.from('finance_categories').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
