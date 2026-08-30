import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    try {
        const { ids, updates } = await request.json()

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Missing PR IDs' }, { status: 400 })
        }

        if (!updates || Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Missing updates' }, { status: 400 })
        }

        const keys = Object.keys(updates)
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
        const { rows: data } = await db.query(
            `UPDATE pr_management SET ${setClauses.join(', ')} WHERE id = ANY($1) RETURNING *`,
            [ids, ...keys.map(k => updates[k])]
        )

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error updating bulk PR entries:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
