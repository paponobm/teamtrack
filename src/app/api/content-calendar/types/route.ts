import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const KINDS = ['video', 'photo', 'design', 'text', 'live']

// GET /api/content-calendar/types
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT t.id, t.name, t.kind, t.caption_template, t.sort_order,
            (SELECT count(*) FROM content_calendar_items i WHERE i.type_id = t.id) AS item_count
         FROM content_calendar_types t ORDER BY t.sort_order`
    )
    return NextResponse.json({ types: rows })
}

// POST /api/content-calendar/types
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const kind = typeof body.kind === 'string' ? body.kind : ''
    const captionTemplate = typeof body.caption_template === 'string' ? body.caption_template : null

    if (!name) return NextResponse.json({ error: 'Type name is required' }, { status: 400 })
    if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Please choose a valid kind' }, { status: 400 })

    const { rows: [{ next }] } = await auth.db.query(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM content_calendar_types`)
    const { rows: [row] } = await auth.db.query(
        `INSERT INTO content_calendar_types (name, kind, caption_template, sort_order) VALUES ($1, $2, $3, $4)
         RETURNING id, name, kind, caption_template, sort_order`,
        [name, kind, captionTemplate, next]
    )
    return NextResponse.json(row, { status: 201 })
}

// PUT /api/content-calendar/types — {id, name?, kind?, caption_template?, sort_order?}
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Type ID required' }, { status: 400 })
    if (body.kind !== undefined && !KINDS.includes(body.kind)) return NextResponse.json({ error: 'Please choose a valid kind' }, { status: 400 })

    const { rows: [row] } = await auth.db.query(
        `UPDATE content_calendar_types SET
            name = COALESCE($2, name), kind = COALESCE($3, kind),
            caption_template = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE caption_template END,
            sort_order = COALESCE($5, sort_order)
         WHERE id = $1 RETURNING id, name, kind, caption_template, sort_order`,
        [id, typeof body.name === 'string' ? body.name.trim() : null, body.kind || null,
         typeof body.caption_template === 'string' ? body.caption_template : null,
         Number.isInteger(body.sort_order) ? body.sort_order : null]
    )
    if (!row) return NextResponse.json({ error: 'Type not found' }, { status: 404 })
    return NextResponse.json(row)
}

// DELETE /api/content-calendar/types?id=xxx — refused while any post uses it; rename instead.
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Type ID required' }, { status: 400 })

    const { rows: [{ count }] } = await auth.db.query(`SELECT count(*) FROM content_calendar_items WHERE type_id = $1`, [id])
    if (Number(count) > 0) {
        return NextResponse.json({ error: `This type has ${count} post(s), so it can't be deleted. You can rename it instead.` }, { status: 409 })
    }
    await auth.db.query(`DELETE FROM content_calendar_types WHERE id = $1`, [id])
    return NextResponse.json({ message: 'Type deleted' })
}
