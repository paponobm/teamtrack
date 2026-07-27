import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/leaves/today - list currently active approved leaves
export async function GET() {
    const auth = await requireAuth(0) // All authenticated users
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const todayStr = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('leave_records')
        .select(`
            id,
            leave_date,
            reason,
            status,
            employee:employees!employee_id(id, name, avatar_url, designation)
        `)
        .eq('leave_date', todayStr)
        .eq('status', 'approved')

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Extract clean list of employees on leave
    const activeLeaves = (data || []).map(record => ({
        id: record.id,
        reason: record.reason,
        employee: record.employee
    }))

    return NextResponse.json(activeLeaves)
}
