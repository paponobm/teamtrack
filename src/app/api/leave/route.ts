import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// POST /api/leave - create a leave record + auto-notice (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ to create leave
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { employee_id, date, reason, auto_notice } = body

    if (!employee_id || !date) {
        return NextResponse.json({ error: 'employee_id and date are required' }, { status: 400 })
    }

    // Get employee name for notice
    const { data: emp } = await supabase
        .from('employees')
        .select('id, name, designation')
        .eq('id', employee_id)
        .single()

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    // Create leave record
    let leaveRecord = null
    const { data, error } = await supabase
        .from('leave_records')
        .insert({
            employee_id,
            leave_date: date,
            reason: reason || 'Personal',
            status: 'approved',
        })
        .select()
        .single()

    if (error) {
        console.error('Leave record insert failed:', error.message)
        // If table doesn't exist, still create the notice
    } else {
        leaveRecord = data
    }

    // Auto-create noticeboard notice
    if (auto_notice) {
        const dateFormatted = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        })

        const noticeContent = `${emp.name}${emp.designation ? ` (${emp.designation})` : ''} is on leave on ${dateFormatted}. Reason: ${reason || 'Personal'}.`

        await supabase.from('notices').insert({
            title: `🏠 ${emp.name} - On Leave`,
            content: noticeContent,
            type: 'announcement',
            priority: 'normal',
            is_pinned: false,
            created_by: auth.employee.id,
            expires_at: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        })
    }

    return NextResponse.json(leaveRecord || { success: true, employee_id, date }, { status: 201 })
}

// GET /api/leave - list leave records (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3
    const empId = searchParams.get('employee_id')
    const month = searchParams.get('month')

    let query = supabase
        .from('leave_records')
        .select('*, employee:employees!employee_id(id, name, designation)')
        .order('leave_date', { ascending: false })

    // Members only see their own
    if (!isAdmin) {
        query = query.eq('employee_id', auth.employee.id)
    } else if (empId) {
        query = query.eq('employee_id', empId)
    }

    if (month) {
        const start = `${month}-01`
        const d = new Date(start)
        d.setMonth(d.getMonth() + 1)
        d.setDate(0)
        const end = d.toISOString().split('T')[0]
        query = query.gte('leave_date', start).lte('leave_date', end)
    }

    const { data, error } = await query.limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data || [])
}
