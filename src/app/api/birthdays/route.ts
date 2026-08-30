import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/birthdays - get employees whose birthday is today
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT id, name, photo_url, date_of_birth, designation
         FROM employees
         WHERE is_active = true
           AND date_of_birth IS NOT NULL
           AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)`
    )

    return NextResponse.json(rows)
}
