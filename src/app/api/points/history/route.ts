import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []

    if (startDate) { params.push(startDate + 'T00:00:00.000Z'); conditions.push(`pt.created_at >= $${params.length}`) }
    if (endDate) { params.push(endDate + 'T23:59:59.999Z'); conditions.push(`pt.created_at <= $${params.length}`) }

    // Admin can see anyone's or everyone's history
    if (auth.employee.roleLevel <= 3) {
        if (employeeId) { params.push(employeeId); conditions.push(`pt.employee_id = $${params.length}`) }
    } else {
        // Members can only see their own
        params.push(auth.employee.id); conditions.push(`pt.employee_id = $${params.length}`)
    }

    params.push(limit)

    const { rows } = await db.query(
        `SELECT pt.*,
            json_build_object('id', e.id, 'name', e.name, 'avatar_url', e.avatar_url) AS employee,
            json_build_object('id', aw.id, 'name', aw.name) AS granted_by_user
         FROM point_transactions pt
         LEFT JOIN employees e ON e.id = pt.employee_id
         LEFT JOIN employees aw ON aw.id = pt.awarded_by
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY pt.created_at DESC
         LIMIT $${params.length}`,
        params
    )

    return NextResponse.json({ transactions: rows })
}
