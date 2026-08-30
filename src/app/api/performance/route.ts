import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/performance (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const employeeId = searchParams.get('employee_id')
    const isAdmin = auth.employee.roleLevel <= 3

    const conditions = ['ps.date = $1']
    const params: unknown[] = [date]

    // Members can only see their own scores
    if (!isAdmin) {
        params.push(auth.employee.id); conditions.push(`ps.employee_id = $${params.length}`)
    } else if (employeeId) {
        params.push(employeeId); conditions.push(`ps.employee_id = $${params.length}`)
    }

    const { rows } = await db.query(
        `SELECT ps.*,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id) AS employee,
            json_build_object('id', pc.id, 'name', pc.name, 'name_bn', pc.name_bn, 'max_points', pc.max_points, 'sort_order', pc.sort_order) AS category,
            json_build_object('id', sc.id, 'name', sc.name) AS scorer
         FROM performance_scores ps
         LEFT JOIN employees e ON e.id = ps.employee_id
         LEFT JOIN point_categories pc ON pc.id = ps.category_id
         LEFT JOIN employees sc ON sc.id = ps.scored_by
         WHERE ${conditions.join(' AND ')}`,
        params
    )

    return NextResponse.json(rows)
}

// POST /api/performance - bulk upsert scores (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()

    const scores = body.scores as {
        employee_id: string
        category_id: string
        date: string
        points: number
        scored_by?: string
    }[]

    if (!Array.isArray(scores) || scores.length === 0) {
        return NextResponse.json({ error: 'scores array required' }, { status: 400 })
    }

    for (const s of scores) {
        if (s.points < 0 || s.points > 10) {
            return NextResponse.json({ error: 'Points must be 0-10' }, { status: 400 })
        }
    }

    const { rows: data } = await db.query(
        `INSERT INTO performance_scores (employee_id, category_id, date, points, scored_by)
         SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::date[], $4::int[], $5::uuid[])
         ON CONFLICT (date, employee_id, category_id) DO UPDATE SET points = EXCLUDED.points, scored_by = EXCLUDED.scored_by
         RETURNING *`,
        [
            scores.map(s => s.employee_id),
            scores.map(s => s.category_id),
            scores.map(s => s.date),
            scores.map(s => s.points),
            scores.map(s => s.scored_by || auth.employee.id),
        ]
    )

    return NextResponse.json({ message: 'Scores saved', count: data.length })
}

// DELETE /api/performance?employee_id=...&category_id=...&date=... - delete a score entry (Admin+)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const employee_id = searchParams.get('employee_id')
    const category_id = searchParams.get('category_id')
    const date = searchParams.get('date')

    if (!employee_id || !category_id || !date) {
        return NextResponse.json({ error: 'employee_id, category_id, and date are all required' }, { status: 400 })
    }

    await auth.db.query(
        `DELETE FROM performance_scores WHERE employee_id = $1 AND category_id = $2 AND date = $3`,
        [employee_id, category_id, date]
    )

    return NextResponse.json({ success: true })
}
