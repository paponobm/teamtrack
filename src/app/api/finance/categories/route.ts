import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/finance/categories
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`SELECT * FROM finance_categories ORDER BY name ASC`)
    return NextResponse.json(rows)
}

// POST /api/finance/categories
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { name, type, parent_id } = body

    if (!name || !type) return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO finance_categories (name, type, parent_id) VALUES ($1, $2, $3) RETURNING *`,
        [name, type, parent_id || null]
    )

    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/finance/categories
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await auth.db.query(`DELETE FROM finance_categories WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
