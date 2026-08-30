import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/finance/budgets
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || new Date().toISOString().slice(0, 7) // YYYY-MM

    const { rows } = await auth.db.query(
        `SELECT b.*, row_to_json(c.*) AS category
         FROM finance_budgets b LEFT JOIN finance_categories c ON c.id = b.category_id
         WHERE b.period = $1`,
        [period]
    )

    return NextResponse.json(rows)
}

// POST /api/finance/budgets
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { category_id, period, amount } = body

    if (!category_id || !period || amount === undefined) {
        return NextResponse.json({ error: 'category_id, period, and amount are required' }, { status: 400 })
    }

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO finance_budgets (category_id, period, amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (category_id, period) DO UPDATE SET amount = EXCLUDED.amount
         RETURNING *`,
        [category_id, period, amount]
    )

    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/finance/budgets
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await auth.db.query(`DELETE FROM finance_budgets WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
