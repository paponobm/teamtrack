import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    if (auth.employee.roleLevel > 3) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const { employee_id, amount, description } = body

        if (!employee_id || typeof amount !== 'number' || !Number.isFinite(amount) || !description) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Prevent self-awarding/deducting points (anti-fraud) for everyone, including super admins.
        if (employee_id === auth.employee.id) {
            return NextResponse.json({ error: 'You cannot adjust your own points.' }, { status: 403 })
        }

        await awardPoints(
            auth.db,
            employee_id,
            amount,
            'manual',
            null,
            description,
            auth.employee.id // granted_by
        )

        return NextResponse.json({ success: true, message: `Successfully ${amount >= 0 ? 'awarded' : 'deducted'} ${Math.abs(amount)} points.` })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
    }
}
