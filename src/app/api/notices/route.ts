import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const AUTHOR_JOIN = `
    LEFT JOIN LATERAL (
        SELECT json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url) AS author
        FROM employees e WHERE e.id = n.created_by
    ) a ON true
`

// GET /api/notices - list notices with read counts
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const showAll = searchParams.get('all') === 'true'

    const conditions = [`n.title NOT ILIKE '%- On Leave'`]
    if (!showAll) {
        conditions.push(`(n.expires_at IS NULL OR n.expires_at >= CURRENT_DATE)`)
    }

    const { rows: notices } = await db.query(
        `SELECT n.*, a.author FROM notices n ${AUTHOR_JOIN}
         WHERE ${conditions.join(' AND ')}
         ORDER BY n.is_pinned DESC, n.created_at DESC`
    )

    const noticeIds = notices.map(n => n.id)
    const readCounts: Record<string, number> = {}
    let userReadIds: string[] = []

    if (noticeIds.length > 0) {
        const { rows: reads } = await db.query(
            `SELECT notice_id, COUNT(*)::int AS count FROM notice_reads WHERE notice_id = ANY($1) GROUP BY notice_id`,
            [noticeIds]
        )
        reads.forEach(r => { readCounts[r.notice_id] = r.count })

        const { rows: myReads } = await db.query(
            `SELECT notice_id FROM notice_reads WHERE employee_id = $1 AND notice_id = ANY($2)`,
            [auth.employee.id, noticeIds]
        )
        userReadIds = myReads.map(r => r.notice_id)
    }

    const enriched = notices.map(n => ({
        ...n,
        read_count: readCounts[n.id] || 0,
        is_read: userReadIds.includes(n.id),
    }))

    return NextResponse.json(enriched)
}

// POST /api/notices - create a new notice (admin/super admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db
    const employee = auth.employee

    const body = await request.json()
    const { title, content, type, priority, is_pinned, expires_at } = body

    if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { rows: [data] } = await db.query(
        `WITH ins AS (
            INSERT INTO notices (title, content, type, priority, is_pinned, created_by, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
         )
         SELECT n.*, a.author FROM ins n ${AUTHOR_JOIN}`,
        [title, content || null, type || 'notice', priority || 'normal', is_pinned || false, employee!.id, expires_at || null]
    )

    return NextResponse.json(data, { status: 201 })
}

// PUT /api/notices - update a notice
export async function PUT(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id, title, content, type, priority, is_pinned, expires_at } = body

    if (!id) {
        return NextResponse.json({ error: 'Notice ID is required' }, { status: 400 })
    }

    const { rows: [data] } = await db.query(
        `WITH upd AS (
            UPDATE notices SET title = $2, content = $3, type = $4, priority = $5, is_pinned = $6,
                expires_at = $7, updated_at = NOW()
            WHERE id = $1
            RETURNING *
         )
         SELECT n.*, a.author FROM upd n ${AUTHOR_JOIN}`,
        [id, title, content, type, priority, is_pinned, expires_at || null]
    )

    if (!data) {
        return NextResponse.json({ error: 'Notice not found' }, { status: 404 })
    }

    return NextResponse.json(data)
}

// DELETE /api/notices - delete a notice
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Notice ID is required' }, { status: 400 })
    }

    await db.query(`DELETE FROM notices WHERE id = $1`, [id])

    return NextResponse.json({ message: 'Notice deleted' })
}
