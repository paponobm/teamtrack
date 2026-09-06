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

    // Safety guards for a non-Super-Admin actor (Admin, since this route already requires
    // level ≤ 3) — mirrors the superOnly flags in MemberModal's PAGE_DEFINITIONS:
    //
    // 1. Members, Employee Attendance, Finance, Product Buy, and Payroll Management can only be
    //    granted by a Super Admin/Owner — for ANY target, including a Member or Manager. An
    //    Admin can still use these pages themselves (seeded by default), just can't toggle them
    //    for anyone else.
    // 2. An Admin cannot modify the access of anyone at their own level or higher — this covers
    //    Super Admins/Owner and another Admin (peer-to-peer access changes), and their own
    //    record (self-granting access). Only a Super Admin/Owner can touch an Admin's
    //    permissions at all, same tier included.
    const SUPER_ADMIN_ONLY_SLUGS = ['members', 'employee-attendance', 'finance', 'product-buy', 'payroll-management']
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const employeeIds = [...new Set(permissions.map(p => p.employee_id))]
        const featureIds = [...new Set(permissions.map(p => p.feature_id))]
        if (employeeIds.length > 0) {
            const [{ rows: targets }, { rows: featureRows }] = await Promise.all([
                db.query(`SELECT e.id, r.level FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE e.id = ANY($1)`, [employeeIds]),
                db.query(`SELECT id, slug FROM features WHERE id = ANY($1)`, [featureIds]),
            ])
            const targetLevelById = new Map(targets.map((t: { id: string; level: number | null }) => [t.id, t.level ?? 99]))
            const slugByFeatureId = new Map(featureRows.map((f: { id: string; slug: string }) => [f.id, f.slug]))

            const attemptingSuperAdminOnlySlug = permissions.some(p => SUPER_ADMIN_ONLY_SLUGS.includes(slugByFeatureId.get(p.feature_id) || ''))
            if (attemptingSuperAdminOnlySlug) {
                return NextResponse.json({ error: 'This page can only be managed by a Super Admin' }, { status: 403 })
            }

            const attemptingProtectedTarget = permissions.some(p => (targetLevelById.get(p.employee_id) ?? 99) <= auth.employee.roleLevel)
            if (attemptingProtectedTarget) {
                return NextResponse.json({ error: 'You cannot modify the access of a user at your own or a higher access level' }, { status: 403 })
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
