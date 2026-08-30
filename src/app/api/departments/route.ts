import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/departments (any employee)
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`SELECT * FROM departments ORDER BY name`)
    return NextResponse.json(rows)
}

// POST /api/departments - create a new department (Admin+)
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { name, name_bn } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Department name is required' }, { status: 400 })

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO departments (name, name_bn) VALUES ($1, $2) RETURNING *`,
        [name.trim(), name_bn?.trim() || null]
    )

    return NextResponse.json(data, { status: 201 })
}

// PATCH /api/departments?id=... - rename a department (Admin+)
export async function PATCH(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await request.json()
    const updates: Record<string, string | null> = {}
    if (body.name) updates.name = body.name.trim()
    if (body.name_bn !== undefined) updates.name_bn = body.name_bn?.trim() || null

    const keys = Object.keys(updates)
    if (keys.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE departments SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...keys.map(k => updates[k])]
    )

    if (!data) return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    return NextResponse.json(data)
}

// DELETE /api/departments?id=... (Admin+)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Pre-check: prevent deleting departments with active members
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*)::int AS count FROM employees WHERE department_id = $1 AND is_active = true`,
        [id]
    )

    if (count > 0) {
        return NextResponse.json(
            { error: `Cannot delete department: ${count} active member(s) still assigned. Reassign them first.` },
            { status: 409 }
        )
    }

    await db.query(`DELETE FROM departments WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
