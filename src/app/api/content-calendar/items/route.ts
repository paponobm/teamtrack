import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { autoAssignEmployee, ITEM_SELECT } from '@/lib/contentCalendarServer'
import { KIND_INFO, STAGE_INFO, buildSlotDates, type Kind, type Stage } from '@/lib/contentCalendar'

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
    const time = typeof body.time === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(body.time) ? body.time : null

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return NextResponse.json({ error: 'start_date is required in YYYY-MM-DD format' }, { status: 400 })
    if (!channelIds.length) return NextResponse.json({ error: 'Pick at least one channel' }, { status: 400 })

    const { rows: [type] } = await db.query(`SELECT id, kind FROM content_calendar_types WHERE id = $1`, [typeId])
    if (!type) return NextResponse.json({ error: 'Please choose a valid post type' }, { status: 400 })
    const kind = type.kind as Kind
    const validStages: Stage[] = KIND_INFO[kind]?.stages || KIND_INFO.video.stages
    // Lets the "add content" form pick a starting stage/assignee up front instead of always
    // defaulting to the first stage and whoever's least busy.
    const stage: Stage = typeof body.stage === 'string' && validStages.includes(body.stage as Stage) ? (body.stage as Stage) : validStages[0]

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
    // The "add content" form previews (and lets you hand-adjust) each channel's date/time before
    // saving — when it sends that exact list back, use it as-is instead of recomputing the
    // rotation, so those per-row edits aren't silently discarded.
    const explicitSlots: { channel_id: string; date: string; time?: string }[] = Array.isArray(body.slots)
        ? body.slots.filter((s: unknown): s is { channel_id: string; date: string; time?: string } =>
            !!s && typeof s === 'object' && typeof (s as Record<string, unknown>).channel_id === 'string' && channelIds.includes((s as Record<string, unknown>).channel_id as string)
            && typeof (s as Record<string, unknown>).date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((s as Record<string, unknown>).date as string))
        : []
    const slots: { channelId: string; date: string; time: string | null }[] = explicitSlots.length
        ? explicitSlots.map(s => ({ channelId: s.channel_id, date: s.date, time: typeof s.time === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(s.time) ? s.time : time }))
        : (() => {
            const built: { channelId: string; date: string; time: string | null }[] = []
            for (const ids of byPlatform.values()) built.push(...buildSlotDates(ids, startDate, gapDays).map(s => ({ ...s, time })))
            return built
        })()

    const assigneeId = typeof body.assignee_id === 'string' && body.assignee_id
        ? body.assignee_id
        : await autoAssignEmployee(db, STAGE_INFO[stage].role)

    const { rows: [inserted] } = await db.query(
        `INSERT INTO content_calendar_items (title, type_id, product_code, caption, notes, stage, assignee_id, stage_since, start_date, gap_days, occasion_id, series_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10, $11, $12) RETURNING id`,
        [title, typeId, productCode, caption, notes, stage, assigneeId, startDate, gapDays, occasionId, seriesId, auth.employee.id]
    )
    for (const s of slots) {
        await db.query(`INSERT INTO content_calendar_slots (item_id, channel_id, date, time) VALUES ($1, $2, $3, $4)`, [inserted.id, s.channelId, s.date, s.time])
    }

    const { rows: [full] } = await db.query(`${ITEM_SELECT} WHERE i.id = $1`, [inserted.id])
    return NextResponse.json(full, { status: 201 })
}
