import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`SELECT * FROM finance_funds ORDER BY created_at DESC`)
    return NextResponse.json(rows)
}

export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { name, balance, category } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO finance_funds (name, balance, category) VALUES ($1, $2, $3) RETURNING *`,
        [name, Number(balance) || 0, category || 'Uncategorized']
    )

    return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id, name, balance, category } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (balance !== undefined) updateData.balance = Number(balance)
    if (category !== undefined) updateData.category = category

    const keys = Object.keys(updateData)
    if (keys.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE finance_funds SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...keys.map(k => updateData[k])]
    )

    if (!data) return NextResponse.json({ error: 'Fund not found' }, { status: 404 })
    return NextResponse.json(data)
}

export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await auth.db.query(`DELETE FROM finance_funds WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
