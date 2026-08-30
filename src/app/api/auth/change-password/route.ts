import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// POST /api/auth/change-password - self-service password change (requires current password).
// No email/magic-link infra exists in this deployment, so "forgot password while logged in"
// is handled this way instead of an emailed reset link.
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { current_password, new_password } = await request.json()

    if (!current_password || !new_password) {
        return NextResponse.json({ error: 'current_password and new_password are required' }, { status: 400 })
    }
    if (new_password.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    const { rows: [user] } = await db.query(
        `SELECT u.id, u.password_hash FROM users u WHERE u.id = (SELECT user_id FROM employees WHERE id = $1)`,
        [auth.employee.id]
    )

    if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(new_password, 10)
    await db.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, user.id])

    return NextResponse.json({ success: true })
}
