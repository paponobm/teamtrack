import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/departments (any employee)
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { data, error } = await auth.supabase
        .from('departments')
        .select('*')
        .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// POST /api/departments - create a new department (Admin+)
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { name, name_bn } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Department name is required' }, { status: 400 })

    const { data, error } = await auth.supabase
        .from('departments')
        .insert({ name: name.trim(), name_bn: name_bn?.trim() || null })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// PATCH /api/departments?id=... - rename a department (Admin+)
export async function PATCH(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await request.json()
    const updates: Record<string, string> = {}
    if (body.name) updates.name = body.name.trim()
    if (body.name_bn !== undefined) updates.name_bn = body.name_bn?.trim() || null

    const { data, error } = await auth.supabase
        .from('departments')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// DELETE /api/departments?id=... (Admin+)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Pre-check: prevent deleting departments with active members
    const { count } = await auth.supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('department_id', id)
        .eq('is_active', true)

    if ((count ?? 0) > 0) {
        return NextResponse.json(
            { error: `Cannot delete department: ${count} active member(s) still assigned. Reassign them first.` },
            { status: 409 }
        )
    }

    const { error } = await auth.supabase.from('departments').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
