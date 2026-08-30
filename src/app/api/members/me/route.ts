import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/members/me - get the current authenticated user's own employee record
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows: [data] } = await auth.db.query(
        `SELECT e.*,
            json_build_object('id', r.id, 'name', r.name, 'level', r.level) AS role,
            json_build_object('id', d.id, 'name', d.name, 'name_bn', d.name_bn) AS department
         FROM employees e
         LEFT JOIN roles r ON r.id = e.role_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.id = $1`,
        [auth.employee.id]
    )

    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
}
