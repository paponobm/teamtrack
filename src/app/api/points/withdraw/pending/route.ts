import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        const auth = await requireAuth(3) // Admin+
        if (!isAuthed(auth)) return auth
        const db = auth.db

        const url = new URL(request.url)
        const all = url.searchParams.get('all') === 'true'

        const { rows } = await db.query(
            `SELECT pw.id, pw.amount, pw.status, pw.requested_at, pw.processed_at,
                json_build_object('name', e.name, 'avatar_url', e.avatar_url) AS employee,
                json_build_object('name', p.name) AS processor
             FROM point_withdrawals pw
             LEFT JOIN employees e ON e.id = pw.employee_id
             LEFT JOIN employees p ON p.id = pw.processed_by
             ${all ? '' : `WHERE pw.status = 'pending'`}
             ORDER BY pw.requested_at DESC`
        )

        return NextResponse.json({ requests: rows })

    } catch (error) {
        console.error('Pending withdrawals API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
