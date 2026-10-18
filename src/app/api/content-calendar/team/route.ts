import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const ROLES = ['plan', 'script', 'shoot', 'design', 'edit', 'live', 'post']

// GET /api/content-calendar/team — every active employee, with their content-calendar roles
// (an empty array if they've never been given one — they just don't show up for auto-assign)
// and whether they're active for the content calendar (inactive ones are hidden from every
// picker/workload view but still listed in Settings so they can be turned back on).
// Ordered the same way as the main Members page, so the serial matches everywhere.
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT e.id, e.name, e.avatar_url, COALESCE(r.roles, ARRAY[]::text[]) AS roles, COALESCE(r.active, true) AS active
         FROM employees e LEFT JOIN content_calendar_team_roles r ON r.employee_id = e.id
         WHERE e.is_active IS NOT FALSE
         ORDER BY e.sort_order ASC NULLS LAST, e.created_at DESC`
    )
    return NextResponse.json({ team: rows })
}

// PUT /api/content-calendar/team — {employee_id, roles?: string[], active?: boolean}
// Either field can be sent alone; the other is left untouched.
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const employeeId = typeof body.employee_id === 'string' ? body.employee_id : ''
    if (!employeeId) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
    const roles = Array.isArray(body.roles) ? body.roles.filter((r: unknown) => typeof r === 'string' && ROLES.includes(r)) : null
    const active = typeof body.active === 'boolean' ? body.active : null

    const { rows: [employee] } = await auth.db.query(`SELECT id FROM employees WHERE id = $1`, [employeeId])
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const { rows: [row] } = await auth.db.query(
        `INSERT INTO content_calendar_team_roles (employee_id, roles, active)
         VALUES ($1, COALESCE($2::text[], ARRAY[]::text[]), COALESCE($3, true))
         ON CONFLICT (employee_id) DO UPDATE SET
             roles = COALESCE($2::text[], content_calendar_team_roles.roles),
             active = COALESCE($3, content_calendar_team_roles.active)
         RETURNING employee_id, roles, active`,
        [employeeId, roles, active]
    )
    return NextResponse.json(row)
}
