import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/audit-log - list recent audit log entries
export async function GET(req: NextRequest) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0')
    const search = req.nextUrl.searchParams.get('search')
    const module = req.nextUrl.searchParams.get('module')
    const startDate = req.nextUrl.searchParams.get('start_date')
    const endDate = req.nextUrl.searchParams.get('end_date')
    const id = req.nextUrl.searchParams.get('id')

    if (id) {
        const { rows: [entry] } = await db.query(
            `SELECT al.*, json_build_object('name', e.name) AS actor
             FROM audit_log al LEFT JOIN employees e ON e.id = al.actor_id
             WHERE al.id = $1`,
            [id]
        )
        if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json({ entry })
    }

    const conditions: string[] = []
    const params: unknown[] = []
    if (search) { params.push(`%${search}%`); conditions.push(`al.action ILIKE $${params.length}`) }
    if (module && module !== 'all') { params.push(module); conditions.push(`al.module = $${params.length}`) }
    if (startDate) { params.push(`${startDate}T00:00:00`); conditions.push(`al.created_at >= $${params.length}`) }
    if (endDate) { params.push(`${endDate}T23:59:59`); conditions.push(`al.created_at <= $${params.length}`) }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

    const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        db.query(
            `SELECT al.*, json_build_object('name', e.name) AS actor
             FROM audit_log al LEFT JOIN employees e ON e.id = al.actor_id
             ${where}
             ORDER BY al.created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        ),
        db.query(`SELECT COUNT(*)::int AS count FROM audit_log al ${where}`, params),
    ])

    return NextResponse.json({ entries: rows, total: count || 0 })
}

// POST /api/audit-log - log an action
export async function POST(req: NextRequest) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const body = await req.json()
    const { action, module, target_id, details } = body

    if (!action || !module) {
        return NextResponse.json({ error: 'action and module required' }, { status: 400 })
    }

    const { rows: [data] } = await auth.db.query(
        // Always stamp the actor from the authenticated session — never trust a client-supplied actor_id.
        `INSERT INTO audit_log (actor_id, action, module, target_id, details) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [auth.employee.id, action, module, target_id || null, details ? JSON.stringify(details) : null]
    )

    return NextResponse.json(data, { status: 201 })
}
