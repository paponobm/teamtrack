import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/todo - Get all personal todos for the authenticated employee
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT * FROM personal_todos WHERE employee_id = $1 ORDER BY created_at DESC`,
        [auth.employee.id]
    )

    return NextResponse.json(rows)
}

// POST /api/todo - Create a new personal todo
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    try {
        const body = await request.json()
        const { title, description, due_date, color, is_pinned } = body

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 })
        }

        const { rows: [data] } = await auth.db.query(
            `INSERT INTO personal_todos (employee_id, title, description, due_date, color, is_pinned, completed)
             VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING *`,
            [auth.employee.id, title.trim(), description ? description.trim() : null, due_date || null, color || null, is_pinned || false]
        )

        return NextResponse.json(data, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Bad request' }, { status: 400 })
    }
}

// PUT /api/todo - Update a personal todo
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    try {
        const body = await request.json()
        const { id, title, description, completed, due_date, color, is_pinned } = body

        if (!id) {
            return NextResponse.json({ error: 'Todo ID is required' }, { status: 400 })
        }

        // Prepare updates
        const updates: Record<string, unknown> = {}
        if (title !== undefined) updates.title = title.trim()
        if (description !== undefined) updates.description = description ? description.trim() : null
        if (completed !== undefined) updates.completed = completed
        if (due_date !== undefined) updates.due_date = due_date || null
        if (color !== undefined) updates.color = color || null
        if (is_pinned !== undefined) updates.is_pinned = is_pinned

        const keys = Object.keys(updates)
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 3}`)
        setClauses.push('updated_at = NOW()')

        // Safety check: must own it
        const { rows: [data] } = await auth.db.query(
            `UPDATE personal_todos SET ${setClauses.join(', ')} WHERE id = $1 AND employee_id = $2 RETURNING *`,
            [id, auth.employee.id, ...keys.map(k => updates[k])]
        )

        if (!data) return NextResponse.json({ error: 'Todo not found' }, { status: 404 })

        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Bad request' }, { status: 400 })
    }
}

// DELETE /api/todo - Delete a personal todo
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Todo ID is required' }, { status: 400 })
    }

    // Safety check: must own it
    await auth.db.query(`DELETE FROM personal_todos WHERE id = $1 AND employee_id = $2`, [id, auth.employee.id])

    return NextResponse.json({ message: 'Todo deleted successfully' })
}
