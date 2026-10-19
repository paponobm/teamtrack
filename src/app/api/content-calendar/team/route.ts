import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { CONTENT_TABS } from '@/lib/contentCalendar'

const ROLES = ['plan', 'script', 'shoot', 'design', 'edit', 'live', 'post']
const TAB_KEYS: string[] = CONTENT_TABS.map(t => t.key)

// GET /api/content-calendar/team — every employee who has Content Calendar access (Owner/Super
// Admin always, everyone else per Members → Edit Member → Access), with their content-calendar
// roles (an empty array if they've never been given one — they just don't show up for
// auto-assign), whether they're active for the content calendar, and which nav tabs they're
// restricted to (an empty array means no restriction — every tab is visible).
// Ordered the same way as the main Members page, so the serial matches everywhere.
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT e.id, e.name, e.avatar_url, COALESCE(r.roles, ARRAY[]::text[]) AS roles, COALESCE(r.active, true) AS active,
                COALESCE(r.allowed_tabs, ARRAY[]::text[]) AS allowed_tabs
         FROM employees e
         LEFT JOIN content_calendar_team_roles r ON r.employee_id = e.id
         LEFT JOIN roles ro ON ro.id = e.role_id
         WHERE e.is_active IS NOT FALSE
           AND (
               ro.level <= 2
               OR EXISTS (
                   SELECT 1 FROM employee_permissions ep JOIN features f ON f.id = ep.feature_id
                   WHERE ep.employee_id = e.id AND f.slug = 'content' AND ep.access_level <> 'no_access'
               )
           )
         ORDER BY e.sort_order ASC NULLS LAST, e.created_at DESC`
    )
    return NextResponse.json({ team: rows })
}

// PUT /api/content-calendar/team — {employee_id, roles?: string[], active?: boolean, allowed_tabs?: string[]}
// Any field can be sent alone; the others are left untouched. allowed_tabs is an explicit
// allow-list of CONTENT_TABS keys; sending [] means "no restriction, show every tab".
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const employeeId = typeof body.employee_id === 'string' ? body.employee_id : ''
    if (!employeeId) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
    const roles = Array.isArray(body.roles) ? body.roles.filter((r: unknown) => typeof r === 'string' && ROLES.includes(r)) : null
    const active = typeof body.active === 'boolean' ? body.active : null
    const allowedTabs = Array.isArray(body.allowed_tabs) ? body.allowed_tabs.filter((t: unknown) => typeof t === 'string' && TAB_KEYS.includes(t)) : null

    const { rows: [employee] } = await auth.db.query(`SELECT id FROM employees WHERE id = $1`, [employeeId])
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const { rows: [row] } = await auth.db.query(
        `INSERT INTO content_calendar_team_roles (employee_id, roles, active, allowed_tabs)
         VALUES ($1, COALESCE($2::text[], ARRAY[]::text[]), COALESCE($3, true), COALESCE($4::text[], ARRAY[]::text[]))
         ON CONFLICT (employee_id) DO UPDATE SET
             roles = COALESCE($2::text[], content_calendar_team_roles.roles),
             active = COALESCE($3, content_calendar_team_roles.active),
             allowed_tabs = COALESCE($4::text[], content_calendar_team_roles.allowed_tabs)
         RETURNING employee_id, roles, active, allowed_tabs`,
        [employeeId, roles, active, allowedTabs]
    )
    return NextResponse.json(row)
}
