import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/roles (any employee)
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`SELECT * FROM roles ORDER BY level`)
    return NextResponse.json(rows)
}

// POST /api/roles - create a new role (Super Admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { name, level } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Role name is required' }, { status: 400 })

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO roles (name, level) VALUES ($1, $2) RETURNING *`,
        [name.trim(), level || 5]
    )

    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/roles?id=... (Super Admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Safety: prevent deleting built-in system roles (Owner, Super Admin, Admin)
    const { rows: [role] } = await db.query(`SELECT level FROM roles WHERE id = $1`, [id])
    if (role && role.level <= 3) {
        return NextResponse.json({ error: 'Cannot delete system roles (Owner, Super Admin, Admin)' }, { status: 403 })
    }

    await db.query(`DELETE FROM roles WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
