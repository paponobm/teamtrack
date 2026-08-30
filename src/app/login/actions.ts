'use server'

import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { pool } from '@/lib/db'
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, signSession } from '@/lib/session'

export async function login(formData: FormData) {
    const email = (formData.get('email') as string || '').trim().toLowerCase()
    const password = formData.get('password') as string

    if (!email || !password) {
        return { error: 'Email and password are required' }
    }

    const { rows: [user] } = await pool.query(
        `SELECT u.id, u.email, u.password_hash, e.is_active
         FROM users u
         LEFT JOIN employees e ON e.user_id = u.id
         WHERE u.email = $1`,
        [email]
    )

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return { error: 'Invalid login credentials' }
    }

    if (user.is_active === false) {
        return { error: 'Your account is deactivated, Please contact admin' }
    }

    const token = await signSession({ userId: user.id, email: user.email })
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)

    redirect('/dashboard')
}
