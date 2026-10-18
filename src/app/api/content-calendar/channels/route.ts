import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube']

// GET /api/content-calendar/channels — every channel, including inactive ones (Settings needs
// to show and re-activate those too), ordered the way they're ranked for rotation.
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT c.id, c.name, c.platform, c.photo_url, c.upload_link, c.active, c.sort_order,
            (SELECT count(*) FROM content_calendar_slots s WHERE s.channel_id = c.id) AS slot_count
         FROM content_calendar_channels c
         ORDER BY c.platform, c.sort_order`
    )
    return NextResponse.json({ channels: rows })
}

// POST /api/content-calendar/channels
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const platform = typeof body.platform === 'string' ? body.platform : ''
    const photoUrl = typeof body.photo_url === 'string' ? body.photo_url.trim() : null
    const uploadLink = typeof body.upload_link === 'string' ? body.upload_link.trim() : null

    if (!name) return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
    if (!PLATFORMS.includes(platform)) return NextResponse.json({ error: 'Please choose a valid platform' }, { status: 400 })
    if (uploadLink && !/^https:\/\//.test(uploadLink)) return NextResponse.json({ error: 'Upload link must start with https://' }, { status: 400 })

    const { rows: [{ next }] } = await auth.db.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM content_calendar_channels WHERE platform = $1`, [platform]
    )
    const { rows: [row] } = await auth.db.query(
        `INSERT INTO content_calendar_channels (name, platform, photo_url, upload_link, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, platform, photo_url, upload_link, active, sort_order`,
        [name, platform, photoUrl, uploadLink, next]
    )
    return NextResponse.json(row, { status: 201 })
}

// PUT /api/content-calendar/channels — {id, name?, photo_url?, upload_link?, active?, sort_order?}
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })

    const { rows: [existing] } = await auth.db.query(`SELECT id FROM content_calendar_channels WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

    const uploadLink = typeof body.upload_link === 'string' ? body.upload_link.trim() : null
    if (uploadLink && !/^https:\/\//.test(uploadLink)) return NextResponse.json({ error: 'Upload link must start with https://' }, { status: 400 })

    const { rows: [row] } = await auth.db.query(
        `UPDATE content_calendar_channels SET
            name = COALESCE($2, name),
            photo_url = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE photo_url END,
            upload_link = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE upload_link END,
            active = COALESCE($5, active),
            sort_order = COALESCE($6, sort_order)
         WHERE id = $1
         RETURNING id, name, platform, photo_url, upload_link, active, sort_order`,
        [id, typeof body.name === 'string' ? body.name.trim() : null,
         typeof body.photo_url === 'string' ? body.photo_url.trim() : null,
         uploadLink,
         typeof body.active === 'boolean' ? body.active : null,
         Number.isInteger(body.sort_order) ? body.sort_order : null]
    )
    return NextResponse.json(row)
}

// DELETE /api/content-calendar/channels?id=xxx — refused while any post still uses it;
// deactivating (PUT active:false) is the normal way to retire a channel instead.
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })

    const { rows: [{ count }] } = await auth.db.query(`SELECT count(*) FROM content_calendar_slots WHERE channel_id = $1`, [id])
    if (Number(count) > 0) {
        return NextResponse.json({ error: `এই চ্যানেলে ${count}টা পোস্ট আছে। মুছার বদলে বন্ধ করুন।` }, { status: 409 })
    }
    await auth.db.query(`DELETE FROM content_calendar_channels WHERE id = $1`, [id])
    return NextResponse.json({ message: 'Channel deleted' })
}
