import { NextResponse } from 'next/server'

import { requireAuth, isAuthed } from '@/lib/auth'

const FULL_SELECT = `e.*,
    json_build_object('id', r.id, 'name', r.name, 'level', r.level) AS role,
    json_build_object('id', d.id, 'name', d.name, 'name_bn', d.name_bn) AS department`
const JOINS = `LEFT JOIN roles r ON r.id = e.role_id LEFT JOIN departments d ON d.id = e.department_id`

// GET /api/members/[id]
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db
    const { id } = await params

    const { rows: [data] } = await db.query(
        `SELECT ${FULL_SELECT} FROM employees e ${JOINS} WHERE e.id = $1`,
        [id]
    )

    if (!data) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json(data)
}

// PATCH /api/members/[id] - update employee
// Admins (level 3+) can update any allowed field.
// Members can ONLY update their own record, limited to safe personal fields.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(0) // any employee
    if (!isAuthed(auth)) return auth
    const db = auth.db
    const { id } = await params
    const body = await request.json()

    const isAdmin = auth.employee.roleLevel <= 3
    const isSuperAdmin = auth.employee.roleLevel <= 2
    const isSelf = auth.employee.id === id

    // Members can only update their OWN record, and only safe fields
    if (!isAdmin) {
        if (!isSelf) {
            return NextResponse.json({ error: 'Members can only update their own profile' }, { status: 403 })
        }

        // Whitelist: fields a member is allowed to self-update
        const SELF_EDIT_FIELDS = ['personal_contact', 'whatsapp_number', 'address', 'avatar_url']
        const filtered: Record<string, unknown> = {}
        for (const key of SELF_EDIT_FIELDS) {
            if (key in body) filtered[key] = body[key]
        }

        if (Object.keys(filtered).length === 0) {
            return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
        }

        const keys = Object.keys(filtered)
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
        const { rows: [data] } = await db.query(
            `WITH upd AS (
                UPDATE employees SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *
             )
             SELECT ${FULL_SELECT} FROM upd e ${JOINS}`,
            [id, ...keys.map(k => filtered[k])]
        )
        if (!data) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        return NextResponse.json(data)
    }

    // Admin path: full update with safety guards.
    // Look up the target's current role (id + level) once for the privilege checks below.
    const { rows: [target] } = await db.query(
        `SELECT e.role_id, r.level FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE e.id = $1`,
        [id]
    )
    const targetLevel = target?.level ?? 99

    // An actor may never modify someone at the same or higher privilege tier (lower level number),
    // unless they are editing their own record. This blocks admin-vs-admin takeover and lockout.
    if (!isSelf && targetLevel <= auth.employee.roleLevel) {
        return NextResponse.json({ error: 'You cannot modify a user at your own or a higher access level' }, { status: 403 })
    }

    // Nobody may change their own role through this endpoint (prevents self-escalation) — but the
    // edit form always resubmits role_id as part of the full profile, even when it's untouched, so
    // only block an actual change, not just its presence in the payload.
    if (isSelf && body.role_id && body.role_id !== target?.role_id) {
        return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 })
    }

    // Admins cannot assign Super Admin (or higher) roles to anyone.
    if (!isSuperAdmin && body.role_id) {
        const { rows: [newRole] } = await db.query(`SELECT level FROM roles WHERE id = $1`, [body.role_id])
        if (newRole && newRole.level <= 2) {
            return NextResponse.json({ error: 'Admins cannot assign Super Admin roles' }, { status: 403 })
        }
    }

    // Strip fields that must never be set via mass-assignment from the client.
    // (total_points drives money withdrawals; user_id ties the row to an auth account.)
    const PROTECTED_FIELDS = ['id', 'user_id', 'total_points', 'created_at', 'updated_at']
    // Salary/bonus defaults (Members → Edit Member → Payroll / Festival Bonus tabs) are
    // Super-Admin-only, even though a plain Admin can reach this route for other fields —
    // the tab is hidden from Admins client-side, but that alone doesn't stop a raw API call.
    const SUPER_ADMIN_ONLY_FIELDS = ['payroll_basic_salary', 'payroll_transportation_bill', 'payroll_snacks_bill', 'basic_salary_effective_month', 'festival_bonus_percentage', 'festival_bonus_months', 'salary_increment_amount', 'salary_increment_effective_month']
    const safeUpdate: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
        if (PROTECTED_FIELDS.includes(key)) continue
        if (SUPER_ADMIN_ONLY_FIELDS.includes(key) && !isSuperAdmin) continue
        safeUpdate[key] = value
    }

    const keys = Object.keys(safeUpdate)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `WITH upd AS (
            UPDATE employees SET ${setClauses.length ? setClauses.join(', ') + ',' : ''} updated_at = NOW() WHERE id = $1 RETURNING *
         )
         SELECT ${FULL_SELECT} FROM upd e ${JOINS}`,
        [id, ...keys.map(k => safeUpdate[k])]
    )

    if (!data) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json(data)
}


// DELETE /api/members/[id] - deactivate (soft delete)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db
    const { id } = await params

    // Safety guard: cannot deactivate yourself, or anyone at your own / a higher access level.
    if (id === auth.employee.id) {
        return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 403 })
    }
    const { rows: [target] } = await db.query(
        `SELECT r.level FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE e.id = $1`,
        [id]
    )
    const targetLevel = target?.level ?? 99
    if (targetLevel <= auth.employee.roleLevel) {
        return NextResponse.json({ error: 'You cannot deactivate a user at your own or a higher access level' }, { status: 403 })
    }

    const { rows: [data] } = await db.query(
        `UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
    )

    if (!data) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Member deactivated', data })
}
