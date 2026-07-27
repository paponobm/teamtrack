import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const { data, error } = await supabase
        .from('leave_records')
        .select('created_at, employee_id, reason')
        .eq('status', 'pending')

    if (error) {
        console.error("[Pending Leaves Count API] Query Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group leaves into distinct "requests"
    const uniqueRequests = new Set()
    if (data) {
        for (const record of data) {
            // Use a combination of employee, timestamp, and reason to identify a single request
            const key = `${record.employee_id}-${record.created_at}-${record.reason}`
            uniqueRequests.add(key)
        }
    }

    return NextResponse.json({ count: uniqueRequests.size })
}
