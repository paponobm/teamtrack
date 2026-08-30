import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/ideas (any employee)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []
    if (status && status !== 'all') { params.push(status); conditions.push(`i.status = $${params.length}`) }
    if (startDate) { params.push(startDate); conditions.push(`i.date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`i.date <= $${params.length}`) }

    const { rows: ideas } = await db.query(
        `SELECT i.*, json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url) AS author
         FROM ideas i LEFT JOIN employees e ON e.id = i.contributor
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY i.created_at DESC`,
        params
    )

    const stats = {
        total: ideas.length,
        submitted: ideas.filter(i => i.status === 'submitted').length,
        accepted: ideas.filter(i => i.status === 'accepted').length,
        implemented: ideas.filter(i => i.status === 'implemented').length,
    }

    return NextResponse.json({ ideas, stats })
}

// POST /api/ideas (+5 points)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO ideas (date, title, description, contributor, category, priority, status, approval_status, reference_links)
         VALUES ($1, $2, $3, $4, $5, $6, 'submitted', 'pending', $7) RETURNING *`,
        [
            new Date().toISOString().split('T')[0], body.title, body.description || null,
            auth.employee.id, body.category || 'General', body.priority || 'medium', body.reference_links || null,
        ]
    )

    return NextResponse.json({ ...data, awardedPoints: 0 }, { status: 201 })
}

// PUT /api/ideas (+5 points on accepted) - admin only for approval / status changes
export async function PUT(request: Request) {
    const auth = await requireAuth(3) // Admin+ only — approving/rejecting/implementing is an admin action
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Check old status before update
    const { rows: [oldIdea] } = await db.query(`SELECT status, contributor FROM ideas WHERE id = $1`, [id])

    const keys = Object.keys(updates)
    if (keys.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE ideas SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...keys.map(k => updates[k])]
    )

    if (!data) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

    let awardedPoints = 0
    // Award 5 points when idea is accepted (instead of on submission)
    if (updates.status === 'accepted' && oldIdea?.status !== 'accepted' && oldIdea?.contributor) {
        await awardPoints(db, oldIdea.contributor, 5, 'idea', id, 'Idea accepted', auth.employee.id)
        if (oldIdea.contributor === auth.employee.id) {
            awardedPoints = 5
        }
    }

    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/ideas (admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await auth.db.query(`DELETE FROM ideas WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
