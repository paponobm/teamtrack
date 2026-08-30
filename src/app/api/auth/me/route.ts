import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { pool } from '@/lib/db'
import { SESSION_COOKIE, verifySession } from '@/lib/session'

export async function GET() {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const session = token ? await verifySession(token) : null

    if (!session) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { rows: [employee] } = await pool.query(
        `SELECT e.name, e.avatar_url, e.is_active, r.name AS role_name
         FROM employees e
         LEFT JOIN roles r ON r.id = e.role_id
         WHERE e.user_id = $1`,
        [session.userId]
    )

    if (!employee) {
        // Ghost user: a session exists but no employee record is linked to it.
        return NextResponse.json({ ghost: true, email: session.email })
    }

    if (employee.is_active === false) {
        return NextResponse.json({ deactivated: true })
    }

    return NextResponse.json({
        name: employee.name || session.email.split('@')[0] || 'User',
        role: employee.role_name || 'Member',
        email: session.email,
        avatar_url: employee.avatar_url || null,
    })
}
