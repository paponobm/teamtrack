import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/content-calendar/series
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT s.id, s.title, s.gap_days, s.days_of_week, s.channel_ids, s.notes,
            json_build_object('id', t.id, 'name', t.name, 'kind', t.kind, 'caption_template', t.caption_template) AS type
         FROM content_calendar_series s JOIN content_calendar_types t ON t.id = s.type_id
         ORDER BY s.created_at`
    )
    return NextResponse.json({ series: rows })
}

// POST /api/content-calendar/series
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const typeId = typeof body.type_id === 'string' ? body.type_id : ''
    const gapDays = Number.isFinite(Number(body.gap_days)) ? Math.max(0, Math.floor(Number(body.gap_days))) : 0
    const daysOfWeek: number[] = Array.isArray(body.days_of_week) ? body.days_of_week.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) : []
    const channelIds: string[] = Array.isArray(body.channel_ids) ? body.channel_ids.filter((x: unknown) => typeof x === 'string') : []
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

    if (!title) return NextResponse.json({ error: 'সিরিজের নাম লিখুন' }, { status: 400 })
    if (!daysOfWeek.length) return NextResponse.json({ error: 'অন্তত একটা বার বেছে নিন' }, { status: 400 })
    if (!channelIds.length) return NextResponse.json({ error: 'অন্তত একটা চ্যানেল বেছে নিন' }, { status: 400 })

    const { rows: [type] } = await db.query(`SELECT id FROM content_calendar_types WHERE id = $1`, [typeId])
    if (!type) return NextResponse.json({ error: 'Please choose a valid post type' }, { status: 400 })

    const { rows: [row] } = await db.query(
        `INSERT INTO content_calendar_series (title, type_id, gap_days, days_of_week, channel_ids, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [title, typeId, gapDays, daysOfWeek, channelIds, notes]
    )
    const { rows: [full] } = await db.query(
        `SELECT s.id, s.title, s.gap_days, s.days_of_week, s.channel_ids, s.notes,
            json_build_object('id', t.id, 'name', t.name, 'kind', t.kind, 'caption_template', t.caption_template) AS type
         FROM content_calendar_series s JOIN content_calendar_types t ON t.id = s.type_id WHERE s.id = $1`,
        [row.id]
    )
    return NextResponse.json(full, { status: 201 })
}

// PUT /api/content-calendar/series — {id, title?, type_id?, gap_days?, days_of_week?, channel_ids?, notes?}
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Series ID required' }, { status: 400 })
    if (body.days_of_week !== undefined && !Array.isArray(body.days_of_week)) return NextResponse.json({ error: 'Invalid days_of_week' }, { status: 400 })
    if (body.channel_ids !== undefined && !Array.isArray(body.channel_ids)) return NextResponse.json({ error: 'Invalid channel_ids' }, { status: 400 })

    const { rows: [row] } = await db.query(
        `UPDATE content_calendar_series SET
            title = COALESCE($2, title), type_id = COALESCE($3, type_id),
            gap_days = COALESCE($4, gap_days),
            days_of_week = COALESCE($5, days_of_week),
            channel_ids = COALESCE($6, channel_ids),
            notes = CASE WHEN $7::text IS NOT NULL THEN NULLIF($7, '') ELSE notes END
         WHERE id = $1 RETURNING id`,
        [id, typeof body.title === 'string' ? body.title.trim() : null, body.type_id || null,
         Number.isFinite(Number(body.gap_days)) ? Math.max(0, Math.floor(Number(body.gap_days))) : null,
         Array.isArray(body.days_of_week) ? body.days_of_week : null,
         Array.isArray(body.channel_ids) ? body.channel_ids : null,
         typeof body.notes === 'string' ? body.notes : null]
    )
    if (!row) return NextResponse.json({ error: 'Series not found' }, { status: 404 })
    const { rows: [full] } = await db.query(
        `SELECT s.id, s.title, s.gap_days, s.days_of_week, s.channel_ids, s.notes,
            json_build_object('id', t.id, 'name', t.name, 'kind', t.kind, 'caption_template', t.caption_template) AS type
         FROM content_calendar_series s JOIN content_calendar_types t ON t.id = s.type_id WHERE s.id = $1`,
        [id]
    )
    return NextResponse.json(full)
}

// DELETE /api/content-calendar/series?id=xxx — already-generated content items just lose the
// series link (series_id set null), they aren't deleted.
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Series ID required' }, { status: 400 })

    await auth.db.query(`DELETE FROM content_calendar_series WHERE id = $1`, [id])
    return NextResponse.json({ message: 'Series deleted' })
}
