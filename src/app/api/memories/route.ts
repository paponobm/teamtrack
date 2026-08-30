import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/memories
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT m.*, json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id) AS author
         FROM memories m LEFT JOIN employees e ON e.id = m.created_by
         ORDER BY m.memory_date DESC`
    )

    return NextResponse.json({ memories: rows })
}

// POST /api/memories
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { title, description, memory_date, images } = body
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO memories (title, description, memory_date, images, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, description || null, memory_date || new Date().toISOString().split('T')[0], images || null, auth.employee.id]
    )

    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/memories?id=xxx (super admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Memory ID required' }, { status: 400 })

    await auth.db.query(`DELETE FROM memories WHERE id = $1`, [id])

    return NextResponse.json({ message: 'Memory deleted' })
}
