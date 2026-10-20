import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const STATUSES = ['pending', 'idea', 'returned', 'scheduled']

const SELECT = `
    SELECT s.id, s.title, s.type_text, s.caption, s.status, s.return_note, s.scheduled_item_id, s.created_at, s.updated_at,
        CASE WHEN e.id IS NULL THEN NULL ELSE json_build_object('id', e.id, 'name', e.name) END AS by_employee,
        CASE WHEN i.id IS NULL THEN NULL ELSE json_build_object('id', i.id, 'title', i.title) END AS scheduled_item
    FROM content_calendar_post_submissions s
    LEFT JOIN employees e ON e.id = s.by_employee_id
    LEFT JOIN content_calendar_items i ON i.id = s.scheduled_item_id
`

// GET /api/content-calendar/post-bank
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`${SELECT} ORDER BY s.created_at DESC`)
    return NextResponse.json({ submissions: rows })
}

// POST /api/content-calendar/post-bank — {type_text, title, caption, status}
// status is 'pending' (text is ready for approval) or 'idea' (just an idea) — chosen by the
// submitter's radio pick, not inferred here. by_employee_id is always the logged-in submitter —
// not something the client gets to set.
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const typeText = typeof body.type_text === 'string' ? body.type_text.trim() || null : null
    const caption = typeof body.caption === 'string' ? body.caption.trim() || null : null
    const status = body.status === 'pending' ? 'pending' : 'idea'

    if (!title) return NextResponse.json({ error: 'শিরোনাম লিখুন' }, { status: 400 })

    const { rows: [inserted] } = await db.query(
        `INSERT INTO content_calendar_post_submissions (title, type_text, caption, by_employee_id, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [title, typeText, caption, auth.employee.id, status]
    )
    const { rows: [full] } = await db.query(`${SELECT} WHERE s.id = $1`, [inserted.id])
    return NextResponse.json(full, { status: 201 })
}

// PUT /api/content-calendar/post-bank — {id, title?, type_text?, caption?, by_employee_id?, status?, return_note?, scheduled_item_id?}
// Editing a returned submission's text implicitly resubmits it (back to pending), unless the
// caller explicitly sets a different status.
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Submission ID required' }, { status: 400 })
    if (typeof body.title === 'string' && !body.title.trim()) return NextResponse.json({ error: 'শিরোনাম লিখুন' }, { status: 400 })
    if (body.status !== undefined && !STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    const { rows: [row] } = await db.query(
        `UPDATE content_calendar_post_submissions SET
            title = COALESCE($2, title),
            type_text = CASE WHEN $3::text IS NOT NULL THEN NULLIF($3, '') ELSE type_text END,
            caption = CASE WHEN $4::text IS NOT NULL THEN NULLIF($4, '') ELSE caption END,
            by_employee_id = CASE WHEN $5::text IS NOT NULL THEN NULLIF($5, '')::uuid ELSE by_employee_id END,
            status = COALESCE($6, status),
            return_note = CASE WHEN $7::text IS NOT NULL THEN NULLIF($7, '') ELSE return_note END,
            scheduled_item_id = CASE WHEN $8::text IS NOT NULL THEN NULLIF($8, '')::uuid ELSE scheduled_item_id END,
            updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id, typeof body.title === 'string' ? body.title.trim() : null,
         body.type_text === undefined ? null : String(body.type_text),
         body.caption === undefined ? null : String(body.caption),
         body.by_employee_id === undefined ? null : String(body.by_employee_id),
         body.status || null,
         body.return_note === undefined ? null : String(body.return_note),
         body.scheduled_item_id === undefined ? null : String(body.scheduled_item_id)]
    )
    if (!row) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    const { rows: [full] } = await db.query(`${SELECT} WHERE s.id = $1`, [id])
    return NextResponse.json(full)
}

// DELETE /api/content-calendar/post-bank?id=xxx
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Submission ID required' }, { status: 400 })

    await auth.db.query(`DELETE FROM content_calendar_post_submissions WHERE id = $1`, [id])
    return NextResponse.json({ message: 'Submission deleted' })
}
