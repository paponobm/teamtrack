import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/content-calendar/occasions
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT o.id, o.name, o.date, o.lead_days, o.target, o.notes,
            (SELECT count(*) FROM content_calendar_items i WHERE i.occasion_id = o.id) AS item_count
         FROM content_calendar_occasions o ORDER BY o.date`
    )
    return NextResponse.json({ occasions: rows })
}

// POST /api/content-calendar/occasions
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const date = typeof body.date === 'string' ? body.date : ''
    const leadDays = Number.isFinite(Number(body.lead_days)) ? Math.max(0, Math.floor(Number(body.lead_days))) : 14
    const target = body.target === '' || body.target == null ? null : Math.max(0, Math.floor(Number(body.target)))
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

    if (!name) return NextResponse.json({ error: 'Occasion name is required' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'date is required in YYYY-MM-DD format' }, { status: 400 })

    const { rows: [row] } = await auth.db.query(
        `INSERT INTO content_calendar_occasions (name, date, lead_days, target, notes) VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, date, lead_days, target, notes`,
        [name, date, leadDays, target, notes]
    )
    return NextResponse.json(row, { status: 201 })
}

// PUT /api/content-calendar/occasions — {id, name?, date?, lead_days?, target?, notes?}
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Occasion ID required' }, { status: 400 })
    if (body.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return NextResponse.json({ error: 'date must be in YYYY-MM-DD format' }, { status: 400 })

    const { rows: [row] } = await auth.db.query(
        `UPDATE content_calendar_occasions SET
            name = COALESCE($2, name), date = COALESCE($3, date),
            lead_days = COALESCE($4, lead_days),
            target = CASE WHEN $5::text IS NOT NULL THEN NULLIF($5, '')::int ELSE target END,
            notes = CASE WHEN $6::text IS NOT NULL THEN NULLIF($6, '') ELSE notes END
         WHERE id = $1 RETURNING id, name, date, lead_days, target, notes`,
        [id, typeof body.name === 'string' ? body.name.trim() : null, body.date || null,
         Number.isFinite(Number(body.lead_days)) ? Math.max(0, Math.floor(Number(body.lead_days))) : null,
         body.target === undefined ? null : String(body.target),
         typeof body.notes === 'string' ? body.notes : null]
    )
    if (!row) return NextResponse.json({ error: 'Occasion not found' }, { status: 404 })
    return NextResponse.json(row)
}

// DELETE /api/content-calendar/occasions?id=xxx — any content already linked to it just loses
// the link (occasion_id is set null), it isn't deleted.
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Occasion ID required' }, { status: 400 })

    await auth.db.query(`DELETE FROM content_calendar_occasions WHERE id = $1`, [id])
    return NextResponse.json({ message: 'Occasion deleted' })
}
