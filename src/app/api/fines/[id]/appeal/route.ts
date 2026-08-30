import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const auth = await requireAuth(5) // Members can appeal
    if (!isAuthed(auth)) return auth

    const { db, employee } = auth

    try {
        const payload = await request.json()
        const { appeal_reason } = payload

        if (!appeal_reason) {
            return NextResponse.json({ error: 'Appeal reason is required' }, { status: 400 })
        }

        // Verify the fine exists, belongs to the user, is Active, and within 3 days
        const { rows: [fine] } = await db.query(`SELECT * FROM fines WHERE id = $1`, [id])

        if (!fine) {
            return NextResponse.json({ error: 'Fine not found' }, { status: 404 })
        }

        if (fine.member_id !== employee.id) {
            return NextResponse.json({ error: 'Unauthorized to appeal this fine' }, { status: 403 })
        }

        if (fine.status !== 'Active') {
            return NextResponse.json({ error: 'Only Active fines can be appealed' }, { status: 400 })
        }

        const createdAt = new Date(fine.created_at)
        const now = new Date()
        const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24)

        if (diffDays > 3) {
            return NextResponse.json({ error: 'Appeal window (3 days) has expired' }, { status: 400 })
        }

        // Update the fine
        const { rows: [data] } = await db.query(
            `UPDATE fines SET status = 'Appealed', appeal_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [appeal_reason, id]
        )

        return NextResponse.json({ data })
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
