import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET /api/content
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const category = searchParams.get('category')

    const conditions: string[] = []
    const params: unknown[] = []
    if (startDate) { params.push(`${startDate}T00:00:00.000Z`); conditions.push(`cb.created_at >= $${params.length}`) }
    if (endDate) { params.push(`${endDate}T23:59:59.999Z`); conditions.push(`cb.created_at <= $${params.length}`) }
    if (category && category !== 'all') { params.push(category); conditions.push(`cb.category = $${params.length}`) }

    const { rows: items } = await db.query(
        `SELECT cb.*, json_build_object('id', c.id, 'name', c.name) AS creator
         FROM content_batches cb LEFT JOIN employees c ON c.id = cb.created_by
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY cb.created_at DESC`,
        params
    )

    return NextResponse.json({ items })
}

// POST /api/content (Create a new batch)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()

    if (!body.titles || !Array.isArray(body.titles) || body.titles.length === 0) {
        return NextResponse.json({ error: 'Titles array is required' }, { status: 400 })
    }

    const typeStr = body.type || 'video'

    const { rows: data } = await db.query(
        `INSERT INTO content_batches (type, category, titles, shoot_done, edit_done, upload_done, created_by)
         SELECT $1, $2, ARRAY[t], false, false, false, $3 FROM UNNEST($4::text[]) AS t
         RETURNING *`,
        [typeStr, body.category || null, auth.employee.id, body.titles]
    )

    if (data.length > 0) {
        await logAudit(auth.employee.id, `Started ${data.length} new content topics`, 'content', data[0].id)
    }

    return NextResponse.json(data, { status: 201 })
}

// PUT /api/content (Update batch progress)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    updates.updated_at = new Date().toISOString()

    // Check old batch
    const { rows: [oldBatch] } = await db.query(`SELECT upload_done, created_by FROM content_batches WHERE id = $1`, [id])

    const keys = Object.keys(updates)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE content_batches SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...keys.map(k => updates[k])]
    )

    if (!data) return NextResponse.json({ error: 'Content batch not found' }, { status: 404 })

    await logAudit(auth.employee.id, 'Updated content progress', 'content', id)

    let awardedPoints = 0
    // Award 5 points if upload_done becomes true
    if (updates.upload_done === true && oldBatch?.upload_done !== true) {
        await awardPoints(db, auth.employee.id, 5, 'content', id, 'Completed content upload', null)
        awardedPoints = 5
    }

    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/content (Admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await auth.db.query(`DELETE FROM content_batches WHERE id = $1`, [id])

    await logAudit(auth.employee.id, 'Deleted content batch', 'content', id)

    return NextResponse.json({ success: true })
}
