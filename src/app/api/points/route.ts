import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/points - list point transactions (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3
    const employeeId = searchParams.get('employee_id')
    const source = searchParams.get('source')
    const limit = parseInt(searchParams.get('limit') || '50')

    const conditions: string[] = []
    const params: unknown[] = []

    // Members only see their own
    if (!isAdmin) {
        params.push(auth.employee.id); conditions.push(`pt.employee_id = $${params.length}`)
    } else if (employeeId) {
        params.push(employeeId); conditions.push(`pt.employee_id = $${params.length}`)
    }

    if (source) { params.push(source); conditions.push(`pt.source = $${params.length}`) }

    params.push(limit)

    const { rows } = await db.query(
        `SELECT pt.*,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id) AS employee,
            json_build_object('id', aw.id, 'name', aw.name) AS awarder
         FROM point_transactions pt
         LEFT JOIN employees e ON e.id = pt.employee_id
         LEFT JOIN employees aw ON aw.id = pt.awarded_by
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY pt.created_at DESC
         LIMIT $${params.length}`,
        params
    )

    return NextResponse.json(rows)
}

// POST /api/points - award points (admin only for manual)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ for manual points
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { employee_id, points, source, source_id, description } = body

    if (!employee_id || !points || !source) {
        return NextResponse.json({ error: 'employee_id, points, and source are required' }, { status: 400 })
    }

    // Safety guard: nobody can manually award points to themselves (anti-fraud), including super admins.
    if (employee_id === auth.employee.id) {
        return NextResponse.json({ error: 'You cannot manually award points to yourself' }, { status: 403 })
    }

    await awardPoints(
        auth.db,
        employee_id,
        points,
        source,
        source_id || null,
        description || `${points} points awarded`,
        auth.employee.id
    )

    return NextResponse.json({ success: true, points })
}
