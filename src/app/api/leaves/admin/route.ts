import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/leaves/admin - list pending leaves
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'pending'

    let query = supabase
        .from('leave_records')
        .select(`
            *,
            employee:employees!employee_id(id, name, avatar_url, designation)
        `)
        
    if (tab === 'history') {
        query = query.neq('status', 'pending')
    } else {
        query = query.eq('status', 'pending')
    }
        
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
        console.error("[Leaves Admin API] Query Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ records: data || [] })
}

// POST /api/leaves/admin - approve/reject leave
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { record_ids, action, rejection_reason } = body // action: 'approve' | 'reject'

    if (!record_ids || !Array.isArray(record_ids) || !action) {
        return NextResponse.json({ error: 'record_ids array and action are required' }, { status: 400 })
    }

    if (action !== 'approve' && action !== 'reject') {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Safety guard: Admins cannot approve/reject their own leaves
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const { data: recordsToCheck } = await supabase
            .from('leave_records')
            .select('employee_id')
            .in('id', record_ids)
            
        const attemptingSelfApproval = recordsToCheck?.some(r => r.employee_id === auth.employee.id)
        if (attemptingSelfApproval) {
            return NextResponse.json({ error: 'Admins cannot approve or reject their own leave requests' }, { status: 403 })
        }
    }

    // Update leave_records
    const updatePayload: any = {
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: auth.employee.id
    }
    
    if (action === 'reject' && rejection_reason) {
        updatePayload.rejection_reason = rejection_reason
    }

    const { error: updError } = await supabase
        .from('leave_records')
        .update(updatePayload)
        .in('id', record_ids)

    if (updError) {
        return NextResponse.json({ error: updError.message }, { status: 500 })
    }

    // If approved, upsert attendance records as 'leave'
    if (action === 'approve') {
        const { data: leaves } = await supabase
            .from('leave_records')
            .select('employee_id, leave_date')
            .in('id', record_ids)

        if (leaves && leaves.length > 0) {
            const attendanceInserts = leaves.map(leave => ({
                employee_id: leave.employee_id,
                date: leave.leave_date,
                status: 'leave',
                notes: 'Approved Leave'
            }))

            const { error: attError } = await supabase
                .from('attendance')
                .upsert(attendanceInserts, { onConflict: 'employee_id,date' })

            if (attError) {
                console.error('Failed to sync attendance for leaves', attError)
                // We don't fail the request here, but log it
            }
        }
    }

    return NextResponse.json({ success: true })
}
