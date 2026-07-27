import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/memories
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { data, error } = await auth.supabase
        .from('memories')
        .select('*, author:employees!created_by(id, name, employee_id)')
        .order('memory_date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ memories: data || [] })
}

// POST /api/memories
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const empId = auth.employee.id

    const body = await request.json()
    const { title, description, memory_date, images } = body
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const { data, error } = await supabase
        .from('memories')
        .insert({
            title,
            description: description || null,
            memory_date: memory_date || new Date().toISOString().split('T')[0],
            images: images || null,
            created_by: empId,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/memories?id=xxx (super admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Memory ID required' }, { status: 400 })

    const { error } = await supabase.from('memories').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ message: 'Memory deleted' })
}
