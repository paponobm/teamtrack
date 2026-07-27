import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { data, error } = await supabase.from('finance_funds').select('*').order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { name, balance, category } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { data, error } = await auth.supabase
        .from('finance_funds')
        .insert({ name, balance: Number(balance) || 0, category: category || 'Uncategorized' })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { id, name, balance, category } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (balance !== undefined) updateData.balance = Number(balance)
    if (category !== undefined) updateData.category = category

    const { data, error } = await auth.supabase
        .from('finance_funds')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const { error } = await auth.supabase.from('finance_funds').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
