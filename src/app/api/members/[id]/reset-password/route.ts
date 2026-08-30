import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// POST /api/members/[id]/reset-password - admin resets a member's password
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id } = await params
    const body = await request.json()
    const { new_password } = body

    if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Safety guard: you can only reset the password of someone at a strictly LOWER access
    // level than yourself (consistent with the member edit/deactivate guards). This blocks
    // an admin from resetting a peer admin's (or a super admin's) password.
    if (id !== auth.employee.id) {
        const { rows: [target] } = await db.query(
            `SELECT r.level FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE e.id = $1`,
            [id]
        )
        const targetLevel = target?.level ?? 99
        if (targetLevel <= auth.employee.roleLevel) {
            return NextResponse.json({ error: 'You cannot reset the password of a user at your own or a higher access level' }, { status: 403 })
        }
    }

    const { rows: [emp] } = await db.query(`SELECT user_id, name FROM employees WHERE id = $1`, [id])

    if (!emp || !emp.user_id) {
        return NextResponse.json({ error: 'Employee not found or has no login account' }, { status: 404 })
    }

    const passwordHash = await bcrypt.hash(new_password, 10)
    await db.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, emp.user_id])

    // Audit log
    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, details)
         VALUES ($1, 'members', 'password_reset', $2, $3)`,
        [auth.employee.id, id, JSON.stringify({ actor_name: auth.employee.name, target_name: emp.name })]
    )

    return NextResponse.json({ success: true, message: `Password reset for ${emp.name}` })
}
