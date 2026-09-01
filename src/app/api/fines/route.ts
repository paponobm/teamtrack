import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const auth = await requireAuth(5) // Level 5 (Member) can view
    if (!isAuthed(auth)) return auth

    const { db, employee } = auth

    try {
        const conditions: string[] = []
        const params: unknown[] = []
        // If not an admin, only show their own fines
        if (employee.roleLevel > 3) {
            params.push(employee.id)
            conditions.push(`f.member_id = $${params.length}`)
        }

        const { rows: data } = await db.query(
            `SELECT f.*,
                json_build_object('id', m.id, 'name', m.name, 'employee_id', m.employee_id, 'avatar_url', m.avatar_url) AS member,
                json_build_object('id', ib.id, 'name', ib.name) AS issued_by_user
             FROM fines f
             LEFT JOIN employees m ON m.id = f.member_id
             LEFT JOIN employees ib ON ib.id = f.issued_by
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
             ORDER BY f.created_at DESC`,
            params
        )

        return NextResponse.json({ data })
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const auth = await requireAuth(4) // Everyone except Member (level <= 4) can issue fines
    if (!isAuthed(auth)) return auth

    const { db, employee } = auth

    try {
        const payload = await request.json()
        const { member_id, amount, category, reason } = payload

        if (!member_id || !amount || !category || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (amount <= 0) {
            return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
        }

        // Insert into fines
        const { rows: [data] } = await db.query(
            `INSERT INTO fines (member_id, issued_by, amount, category, reason, status, payment_status)
             VALUES ($1, $2, $3, $4, $5, 'Active', 'Unpaid') RETURNING *`,
            [member_id, employee.id, amount, category, reason]
        )

        // Deduct points from the member
        await awardPoints(
            db,
            member_id,
            -Math.abs(amount), // Negative amount for deduction
            'Fine',
            data.id,
            `Fine: ${category} - ${reason}`,
            employee.id
        )

        return NextResponse.json({ data })
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
