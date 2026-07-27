import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const auth = await requireAuth(0) // Regular user
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const { data, error } = await supabase
        .from('leave_records')
        .select('created_at, reason')
        .eq('employee_id', auth.employee.id)
        .neq('status', 'pending')
        // member_notified can be NULL on older rows; `.neq(...true)` would exclude those,
        // so a member's processed-but-unseen leave would never count. Match NULL or false.
        .or('member_notified.is.null,member_notified.eq.false')

    if (error) {
        // If column doesn't exist yet, just return 0 without breaking the app
        if (error.code === 'PGRST200') {
            return NextResponse.json({ count: 0 })
        }
        console.error("[Unread Leaves Count API] Query Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group leaves into distinct "requests" just like we do for pending count
    const uniqueRequests = new Set()
    if (data) {
        for (const record of data) {
            const key = `${record.created_at}-${record.reason}`
            uniqueRequests.add(key)
        }
    }

    return NextResponse.json({ count: uniqueRequests.size })
}
