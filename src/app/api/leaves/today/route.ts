import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/leaves/today - list currently active approved leaves
export async function GET() {
    const auth = await requireAuth(0) // All authenticated users

    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT lr.id, lr.reason,
            json_build_object('id', e.id, 'name', e.name, 'avatar_url', e.avatar_url, 'designation', e.designation) AS employee
         FROM leave_records lr
         LEFT JOIN employees e ON e.id = lr.employee_id
         WHERE lr.leave_date = CURRENT_DATE AND lr.status = 'approved'`
    )

    return NextResponse.json(rows)
}
