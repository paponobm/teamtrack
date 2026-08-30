import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const auth = await requireAuth(2) // Only Super Admin (Level <= 2) can review appeals
    if (!isAuthed(auth)) return auth

    const { db, employee } = auth

    try {
        const payload = await request.json()
        const { action } = payload // 'waive' or 'reject'

        if (!action || !['waive', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action. Use waive or reject' }, { status: 400 })
        }

        const { rows: [fine] } = await db.query(`SELECT * FROM fines WHERE id = $1`, [id])

        if (!fine) {
            return NextResponse.json({ error: 'Fine not found' }, { status: 404 })
        }

        if (fine.status !== 'Appealed') {
            return NextResponse.json({ error: 'Only Appealed fines can be reviewed' }, { status: 400 })
        }

        const newStatus = action === 'waive' ? 'Waived' : 'Active' // If rejected, it goes back to Active

        const { rows: [data] } = await db.query(
            `UPDATE fines SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [newStatus, id]
        )

        // If waived, refund the points
        if (action === 'waive') {
            await awardPoints(
                db,
                fine.member_id,
                Math.abs(fine.amount), // Positive amount to refund
                'Fine Waived',
                fine.id,
                `Fine Waived by Super Admin: ${fine.category}`,
                employee.id
            )
        }

        return NextResponse.json({ data })
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
