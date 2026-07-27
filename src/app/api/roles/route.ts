import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/roles (any employee)
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { data, error } = await auth.supabase
        .from('roles')
        .select('*')
        .order('level')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// POST /api/roles - create a new role (Super Admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { name, level } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Role name is required' }, { status: 400 })

    const { data, error } = await auth.supabase
        .from('roles')
        .insert({ name: name.trim(), level: level || 5 })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/roles?id=... (Super Admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Safety: prevent deleting built-in system roles (Owner, Super Admin, Admin)
    const { data: role } = await auth.supabase.from('roles').select('level').eq('id', id).single()
    if (role && role.level <= 3) {
        return NextResponse.json({ error: 'Cannot delete system roles (Owner, Super Admin, Admin)' }, { status: 403 })
    }

    const { error } = await auth.supabase.from('roles').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
