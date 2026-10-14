import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const ROLES = ['plan', 'script', 'shoot', 'design', 'edit', 'live', 'post']

// GET /api/content-calendar/team — every active employee, with their content-calendar roles
// (an empty array if they've never been given one — they just don't show up for auto-assign).
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT e.id, e.name, e.avatar_url, COALESCE(r.roles, ARRAY[]::text[]) AS roles
         FROM employees e LEFT JOIN content_calendar_team_roles r ON r.employee_id = e.id
         WHERE e.is_active IS NOT FALSE
         ORDER BY e.name`
    )
    return NextResponse.json({ team: rows })
}

// PUT /api/content-calendar/team — {employee_id, roles: string[]}
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const employeeId = typeof body.employee_id === 'string' ? body.employee_id : ''
    const roles = Array.isArray(body.roles) ? body.roles.filter((r: unknown) => typeof r === 'string' && ROLES.includes(r)) : []
    if (!employeeId) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })

    const { rows: [employee] } = await auth.db.query(`SELECT id FROM employees WHERE id = $1`, [employeeId])
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    if (roles.length === 0) {
        await auth.db.query(`DELETE FROM content_calendar_team_roles WHERE employee_id = $1`, [employeeId])
        return NextResponse.json({ employee_id: employeeId, roles: [] })
    }

    const { rows: [row] } = await auth.db.query(
        `INSERT INTO content_calendar_team_roles (employee_id, roles) VALUES ($1, $2)
         ON CONFLICT (employee_id) DO UPDATE SET roles = EXCLUDED.roles
         RETURNING employee_id, roles`,
        [employeeId, roles]
    )
    return NextResponse.json(row)
}
