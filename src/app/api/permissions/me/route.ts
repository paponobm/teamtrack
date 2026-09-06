import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/permissions/me - get current user's permissions
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const roleLevel = auth.employee.roleLevel

    // Owner/Super Admin (level ≤ 2) always have full access to every page, including
    // Finance/Payroll Management — this tier can never be restricted per-member.
    if (roleLevel && roleLevel <= 2) {
        const { rows: features } = await db.query(`SELECT slug FROM features`)
        const allAdmin: Record<string, string> = {}
        features.forEach(f => { allAdmin[f.slug] = 'admin' })

        return NextResponse.json({
            employee_id: auth.employee.id,
            role: auth.employee.roleName,
            permissions: allAdmin,
            is_super: true,
            is_admin: true,
        })
    }

    // Everyone else — Admin, Manager, Member — gets exactly what's been explicitly granted via
    // Members → Edit Member → Access. A plain Admin no longer gets a blanket runtime bypass: a
    // Super Admin can turn off an individual page for one specific Admin the same way they can
    // for anyone else, and it actually hides it from that Admin's sidebar. New/promoted Admins
    // are seeded with full access by default (see seedAdminPermissions in lib/permissions.ts),
    // so this only changes anything once a Super Admin deliberately restricts something.
    const { rows: perms } = await db.query(
        `SELECT ep.access_level, f.slug
         FROM employee_permissions ep LEFT JOIN features f ON f.id = ep.feature_id
         WHERE ep.employee_id = $1`,
        [auth.employee.id]
    )

    const permMap: Record<string, string> = {}
    perms.forEach(p => { if (p.slug) permMap[p.slug] = p.access_level })

    return NextResponse.json({
        employee_id: auth.employee.id,
        role: auth.employee.roleName,
        permissions: permMap,
        is_super: false,
        is_admin: roleLevel === 3,
    })
}
