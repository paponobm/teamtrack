import { NextResponse } from 'next/server'
import { requireAuth, isAuthed } from '@/lib/auth'

// GET /api/permissions - get all permissions (optionally filtered by employee)
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')

    const { rows } = await db.query(
        `SELECT ep.*,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id) AS employee,
            json_build_object('id', f.id, 'name', f.name, 'name_bn', f.name_bn, 'category', f.category, 'slug', f.slug, 'sort_order', f.sort_order) AS feature
         FROM employee_permissions ep
         LEFT JOIN employees e ON e.id = ep.employee_id
         LEFT JOIN features f ON f.id = ep.feature_id
         ${employeeId ? 'WHERE ep.employee_id = $1' : ''}`,
        employeeId ? [employeeId] : []
    )

    return NextResponse.json(rows)
}

// POST /api/permissions - bulk upsert permissions
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()

    // body is an array: [{ employee_id, feature_id, access_level }]
    const permissions = body.permissions as {
        employee_id: string
        feature_id: string
        access_level: 'admin' | 'member' | 'no_access'
    }[]

    if (!Array.isArray(permissions) || permissions.length === 0) {
        return NextResponse.json({ error: 'permissions array required' }, { status: 400 })
    }

    // Safety guard: Admins cannot modify permissions of Super Admins
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const employeeIds = [...new Set(permissions.map(p => p.employee_id))]
        if (employeeIds.length > 0) {
            const { rows: targets } = await db.query(
                `SELECT r.level FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE e.id = ANY($1)`,
                [employeeIds]
            )
            const attemptingSuperAdminMod = targets.some(t => (t.level ?? 99) <= 2)
            if (attemptingSuperAdminMod) {
                return NextResponse.json({ error: 'Admins cannot modify permissions of Super Admins' }, { status: 403 })
            }
        }
    }

    const { rows } = await db.query(
        `INSERT INTO employee_permissions (employee_id, feature_id, access_level)
         SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::text[])
         ON CONFLICT (employee_id, feature_id) DO UPDATE SET access_level = EXCLUDED.access_level
         RETURNING *`,
        [permissions.map(p => p.employee_id), permissions.map(p => p.feature_id), permissions.map(p => p.access_level)]
    )

    return NextResponse.json({ message: 'Permissions updated', count: rows.length })
}
