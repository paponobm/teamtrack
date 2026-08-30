import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT created_at, employee_id, reason FROM leave_records WHERE status = 'pending'`
    )

    // Group leaves into distinct "requests"
    const uniqueRequests = new Set()
    for (const record of rows) {
        const key = `${record.employee_id}-${record.created_at.toISOString()}-${record.reason}`
        uniqueRequests.add(key)
    }

    return NextResponse.json({ count: uniqueRequests.size })
}
