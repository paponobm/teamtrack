import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { autoAssignEmployee, ITEM_SELECT } from '@/lib/contentCalendarServer'
import { STAGE_INFO, type Stage } from '@/lib/contentCalendar'

// PUT /api/content-calendar/items/[id] — partial update. Any field left out of the body is
// unchanged. Changing `stage` logs the stage just finished (who had it, when) and — unless the
// body also names a new `assignee_id` — auto-assigns whoever's least busy for the new stage.
// Sending `slots` replaces the item's whole slot list (used by the edit sheet, and by the
// quick "mark posted" toggle, which sends back the full list with one flag flipped).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db
    const { id } = await params

    const { rows: [current] } = await db.query(`SELECT stage, assignee_id FROM content_calendar_items WHERE id = $1`, [id])
    if (!current) return NextResponse.json({ error: 'Content item not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))

    const fields: string[] = []
    const values: unknown[] = [id]
    const set = (col: string, val: unknown) => { values.push(val); fields.push(`${col} = $${values.length}`) }

    if (typeof body.title === 'string') { if (!body.title.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 }); set('title', body.title.trim()) }
    if (typeof body.caption === 'string' || body.caption === null) set('caption', body.caption)
    if (typeof body.notes === 'string' || body.notes === null) set('notes', body.notes)
    if (typeof body.product_code === 'string' || body.product_code === null) set('product_code', body.product_code)
    if (typeof body.occasion_id === 'string' || body.occasion_id === null) set('occasion_id', body.occasion_id || null)
    if (typeof body.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) set('start_date', body.start_date)
    if (Number.isFinite(Number(body.gap_days))) set('gap_days', Math.max(0, Math.floor(Number(body.gap_days))))

    let newAssignee: string | null | undefined
    if (typeof body.stage === 'string' && body.stage !== current.stage) {
        if (!STAGE_INFO[body.stage as Stage]) return NextResponse.json({ error: 'Unknown stage' }, { status: 400 })
        set('stage', body.stage)
        set('stage_since', new Date().toISOString())
        await db.query(
            `INSERT INTO content_calendar_stage_logs (item_id, stage, by_employee_id) VALUES ($1, $2, $3)`,
            [id, current.stage, current.assignee_id]
        )
        newAssignee = typeof body.assignee_id === 'string' ? body.assignee_id
            : body.assignee_id === null ? null
            : await autoAssignEmployee(db, STAGE_INFO[body.stage as Stage].role, id)
    } else if (typeof body.assignee_id === 'string' || body.assignee_id === null) {
        newAssignee = body.assignee_id
    }
    if (newAssignee !== undefined) set('assignee_id', newAssignee)

    set('updated_at', new Date().toISOString())
    if (fields.length) {
        await db.query(`UPDATE content_calendar_items SET ${fields.join(', ')} WHERE id = $1`, values)
    }

    if (Array.isArray(body.slots)) {
        await db.query(`DELETE FROM content_calendar_slots WHERE item_id = $1`, [id])
        for (const s of body.slots) {
            if (!s || typeof s.channel_id !== 'string' || typeof s.date !== 'string') continue
            const time = typeof s.time === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(s.time) ? s.time : null
            await db.query(
                `INSERT INTO content_calendar_slots (item_id, channel_id, date, time, posted, hook, reach, msgs, orders)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [id, s.channel_id, s.date, time, !!s.posted, s.hook || null,
                 s.reach === '' || s.reach == null ? null : Number(s.reach),
                 s.msgs === '' || s.msgs == null ? null : Number(s.msgs),
                 s.orders === '' || s.orders == null ? null : Number(s.orders)]
            )
        }
    }

    if (body.new_comment && typeof body.new_comment.text === 'string' && body.new_comment.text.trim()) {
        await db.query(
            `INSERT INTO content_calendar_comments (item_id, by_employee_id, text) VALUES ($1, $2, $3)`,
            [id, typeof body.new_comment.employee_id === 'string' ? body.new_comment.employee_id : null, body.new_comment.text.trim()]
        )
    }
    if (typeof body.toggle_comment_id === 'string') {
        await db.query(`UPDATE content_calendar_comments SET done = NOT done WHERE id = $1 AND item_id = $2`, [body.toggle_comment_id, id])
    }

    const { rows: [full] } = await db.query(`${ITEM_SELECT} WHERE i.id = $1`, [id])
    return NextResponse.json(full)
}

// DELETE /api/content-calendar/items/[id] — slots, stage logs and comments cascade with it.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const { id } = await params

    const { rowCount } = await auth.db.query(`DELETE FROM content_calendar_items WHERE id = $1`, [id])
    if (!rowCount) return NextResponse.json({ error: 'Content item not found' }, { status: 404 })
    return NextResponse.json({ message: 'Content item deleted' })
}
