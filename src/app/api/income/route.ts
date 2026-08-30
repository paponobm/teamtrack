import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/income
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Income privacy: Super Admins (Owner/Super Admin, level <= 2) see ALL income.
    // A regular Admin only sees the income entries they personally added.
    const isSuperAdmin = auth.employee.roleLevel <= 2

    const conditions: string[] = []
    const params: unknown[] = []
    if (!isSuperAdmin) { params.push(auth.employee.id); conditions.push(`i.added_by = $${params.length}`) }
    if (startDate) { params.push(startDate); conditions.push(`i.date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`i.date <= $${params.length}`) }

    const { rows: entries } = await db.query(
        `SELECT i.*, json_build_object('id', e.id, 'name', e.name) AS adder
         FROM income i LEFT JOIN employees e ON e.id = i.added_by
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY i.created_at DESC`,
        params
    )

    const totalIncome = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0)

    return NextResponse.json({ entries, totalIncome })
}

// POST /api/income
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO income (date, description, amount, source, fund_id, note, business_name, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
            body.date || new Date().toISOString().split('T')[0],
            body.description || null,
            body.amount || 0,
            body.source || null,
            body.fund_id || null,
            body.note || null,
            body.business_name || null,
            auth.employee.id,
        ]
    )

    return NextResponse.json(data, { status: 201 })
}

// PATCH /api/income - edit an income entry (Super Admin+)
export async function PATCH(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Only allow updating safe fields (note: the income table has no invoice_id column)
    const allowed = ['date', 'description', 'amount', 'source', 'fund_id', 'note', 'business_name']
    const safeUpdates: Record<string, unknown> = {}
    for (const key of allowed) {
        if (key in updates) safeUpdates[key] = updates[key]
    }

    if (Object.keys(safeUpdates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // A regular Admin may only edit income they added; Super Admins may edit any.
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const { rows: [existing] } = await db.query(`SELECT added_by FROM income WHERE id = $1`, [id])
        if (existing && existing.added_by !== auth.employee.id) {
            return NextResponse.json({ error: 'You can only edit income you added' }, { status: 403 })
        }
    }

    const keys = Object.keys(safeUpdates)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE income SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...keys.map(k => safeUpdates[k])]
    )

    if (!data) return NextResponse.json({ error: 'Income entry not found' }, { status: 404 })
    return NextResponse.json(data)
}

// DELETE /api/income
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // A regular Admin may only delete income they added; Super Admins may delete any.
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const { rows: [existing] } = await db.query(`SELECT added_by FROM income WHERE id = $1`, [id])
        if (existing && existing.added_by !== auth.employee.id) {
            return NextResponse.json({ error: 'You can only delete income you added' }, { status: 403 })
        }
    }

    await db.query(`DELETE FROM income WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
