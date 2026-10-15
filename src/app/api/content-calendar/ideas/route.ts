import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const IDEA_SELECT = `
    SELECT i.id, i.title, i.product_code, i.notes, i.created_at,
        CASE WHEN t.id IS NULL THEN NULL ELSE json_build_object('id', t.id, 'name', t.name, 'kind', t.kind) END AS type,
        CASE WHEN e.id IS NULL THEN NULL ELSE json_build_object('id', e.id, 'name', e.name) END AS by_employee
    FROM content_calendar_ideas i
    LEFT JOIN content_calendar_types t ON t.id = i.type_id
    LEFT JOIN employees e ON e.id = i.by_employee_id
`

// GET /api/content-calendar/ideas
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`${IDEA_SELECT} ORDER BY i.created_at DESC`)
    return NextResponse.json({ ideas: rows })
}

// POST /api/content-calendar/ideas
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const typeId = typeof body.type_id === 'string' && body.type_id ? body.type_id : null
    const productCode = typeof body.product_code === 'string' ? body.product_code.trim() || null : null
    const byEmployeeId = typeof body.by_employee_id === 'string' && body.by_employee_id ? body.by_employee_id : null
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

    if (!title) return NextResponse.json({ error: 'আইডিয়া লিখুন' }, { status: 400 })

    const { rows: [inserted] } = await db.query(
        `INSERT INTO content_calendar_ideas (title, type_id, product_code, by_employee_id, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [title, typeId, productCode, byEmployeeId, notes]
    )
    const { rows: [full] } = await db.query(`${IDEA_SELECT} WHERE i.id = $1`, [inserted.id])
    return NextResponse.json(full, { status: 201 })
}

// PUT /api/content-calendar/ideas — {id, title?, type_id?, product_code?, by_employee_id?, notes?}
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Idea ID required' }, { status: 400 })
    if (typeof body.title === 'string' && !body.title.trim()) return NextResponse.json({ error: 'আইডিয়া লিখুন' }, { status: 400 })

    const { rows: [row] } = await db.query(
        `UPDATE content_calendar_ideas SET
            title = COALESCE($2, title),
            type_id = CASE WHEN $3::text IS NOT NULL THEN NULLIF($3, '')::uuid ELSE type_id END,
            product_code = CASE WHEN $4::text IS NOT NULL THEN NULLIF($4, '') ELSE product_code END,
            by_employee_id = CASE WHEN $5::text IS NOT NULL THEN NULLIF($5, '')::uuid ELSE by_employee_id END,
            notes = CASE WHEN $6::text IS NOT NULL THEN NULLIF($6, '') ELSE notes END
         WHERE id = $1 RETURNING id`,
        [id, typeof body.title === 'string' ? body.title.trim() : null,
         body.type_id === undefined ? null : String(body.type_id || ''),
         body.product_code === undefined ? null : String(body.product_code || ''),
         body.by_employee_id === undefined ? null : String(body.by_employee_id || ''),
         body.notes === undefined ? null : String(body.notes || '')]
    )
    if (!row) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
    const { rows: [full] } = await db.query(`${IDEA_SELECT} WHERE i.id = $1`, [id])
    return NextResponse.json(full)
}

// DELETE /api/content-calendar/ideas?id=xxx
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Idea ID required' }, { status: 400 })

    await auth.db.query(`DELETE FROM content_calendar_ideas WHERE id = $1`, [id])
    return NextResponse.json({ message: 'Idea deleted' })
}
