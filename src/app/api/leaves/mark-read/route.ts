import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const { error } = await supabase
        .from('leave_records')
        .update({ member_notified: true })
        .eq('employee_id', auth.employee.id)
        .neq('status', 'pending')
        // Also mark rows where member_notified is NULL (not just false).
        .or('member_notified.is.null,member_notified.eq.false')

    if (error) {
        // Ignore column doesn't exist error gracefully
        if (error.code === 'PGRST200') {
            return NextResponse.json({ success: true })
        }
        console.error("[Mark Leaves Read API] Update Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
