import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// POST /api/notices/read - mark notice(s) as read by the current user
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const noticeIds: string[] = Array.isArray(body.notice_ids) ? body.notice_ids : [body.notice_id]

    if (noticeIds.length === 0) {
        return NextResponse.json({ error: 'notice_id or notice_ids required' }, { status: 400 })
    }

    await db.query(
        `INSERT INTO notice_reads (notice_id, employee_id)
         SELECT * FROM UNNEST($1::uuid[], $2::uuid[])
         ON CONFLICT (notice_id, employee_id) DO NOTHING`,
        [noticeIds, noticeIds.map(() => auth.employee.id)]
    )

    return NextResponse.json({ message: 'Marked as read', count: noticeIds.length })
}
