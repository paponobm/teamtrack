import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/permissions/me - get current user's permissions
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const roleLevel = auth.employee.roleLevel

    // Check if user is Owner, Super Admin, or Admin (level 1–3) - they get full access
    if (roleLevel && roleLevel <= 3) {
        const { rows: features } = await db.query(`SELECT id, slug FROM features`)

        const allAdmin: Record<string, string> = {}
        features.forEach(f => { allAdmin[f.slug] = 'admin' })

        return NextResponse.json({
            employee_id: auth.employee.id,
            role: auth.employee.roleName,
            permissions: allAdmin,
            is_super: roleLevel <= 2,
            is_admin: true,
        })
    }

    // For regular users, get their specific permissions
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
        is_admin: false,
    })
}
