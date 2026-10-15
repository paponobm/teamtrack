import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { autoAssignEmployee, ITEM_SELECT } from '@/lib/contentCalendarServer'
import { KIND_INFO, STAGE_INFO, buildSlotDates, type Kind } from '@/lib/contentCalendar'

// GET /api/content-calendar/items — everything, unfiltered by date. The Month/Board/Workload
// views each slice this client-side (an item started last month can still have an unfinished
// stage today, and Workload needs to see that regardless of which month is on screen).
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`${ITEM_SELECT} ORDER BY i.start_date DESC`)
    return NextResponse.json({ items: rows })
}

// POST /api/content-calendar/items
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const typeId = typeof body.type_id === 'string' ? body.type_id : ''
    const startDate = typeof body.start_date === 'string' ? body.start_date : ''
    const gapDays = Number.isFinite(Number(body.gap_days)) ? Math.max(0, Math.floor(Number(body.gap_days))) : 3
    const channelIds: string[] = Array.isArray(body.channel_ids) ? body.channel_ids.filter((x: unknown) => typeof x === 'string') : []
    const productCode = typeof body.product_code === 'string' ? body.product_code.trim() : null
    const caption = typeof body.caption === 'string' ? body.caption : null
    const notes = typeof body.notes === 'string' ? body.notes : null
    const occasionId = typeof body.occasion_id === 'string' && body.occasion_id ? body.occasion_id : null
    const seriesId = typeof body.series_id === 'string' && body.series_id ? body.series_id : null

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return NextResponse.json({ error: 'start_date is required in YYYY-MM-DD format' }, { status: 400 })
    if (!channelIds.length) return NextResponse.json({ error: 'Pick at least one channel' }, { status: 400 })

    const { rows: [type] } = await db.query(`SELECT id, kind FROM content_calendar_types WHERE id = $1`, [typeId])
    if (!type) return NextResponse.json({ error: 'Please choose a valid post type' }, { status: 400 })
    const kind = type.kind as Kind
    const stage = KIND_INFO[kind]?.stages[0] || KIND_INFO.video.stages[0]

    const { rows: channels } = await db.query(`SELECT id, platform FROM content_calendar_channels WHERE id = ANY($1)`, [channelIds])
    if (channels.length !== channelIds.length) return NextResponse.json({ error: 'One or more selected channels no longer exist' }, { status: 400 })

    const byPlatform = new Map<string, string[]>()
    for (const id of channelIds) {
        const ch = channels.find((c: { id: string }) => c.id === id)
        if (!ch) continue
        const list = byPlatform.get(ch.platform) || []
        list.push(id)
        byPlatform.set(ch.platform, list)
    }
    const slots: { channelId: string; date: string }[] = []
    for (const ids of byPlatform.values()) slots.push(...buildSlotDates(ids, startDate, gapDays))

    const assigneeId = await autoAssignEmployee(db, STAGE_INFO[stage].role)

    const { rows: [inserted] } = await db.query(
        `INSERT INTO content_calendar_items (title, type_id, product_code, caption, notes, stage, assignee_id, stage_since, start_date, gap_days, occasion_id, series_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10, $11, $12) RETURNING id`,
        [title, typeId, productCode, caption, notes, stage, assigneeId, startDate, gapDays, occasionId, seriesId, auth.employee.id]
    )
    for (const s of slots) {
        await db.query(`INSERT INTO content_calendar_slots (item_id, channel_id, date) VALUES ($1, $2, $3)`, [inserted.id, s.channelId, s.date])
    }

    const { rows: [full] } = await db.query(`${ITEM_SELECT} WHERE i.id = $1`, [inserted.id])
    return NextResponse.json(full, { status: 201 })
}
