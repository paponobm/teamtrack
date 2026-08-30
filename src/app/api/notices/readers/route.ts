import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/notices/readers?notice_id=xxx - list employees who read a notice
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const noticeId = searchParams.get('notice_id')

    if (!noticeId) {
        return NextResponse.json({ error: 'notice_id is required' }, { status: 400 })
    }

    const { rows } = await db.query(
        `SELECT nr.read_at, e.name, e.employee_id, e.avatar_url
         FROM notice_reads nr
         LEFT JOIN employees e ON e.id = nr.employee_id
         WHERE nr.notice_id = $1
         ORDER BY nr.read_at DESC`,
        [noticeId]
    )

    const readers = rows.map(r => ({
        name: r.name || 'Unknown',
        employee_id: r.employee_id || '',
        avatar_url: r.avatar_url || null,
        read_at: r.read_at,
    }))

    return NextResponse.json(readers)
}
