import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/attendance - list attendance records (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3

    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const employeeId = searchParams.get('employee_id') || ''

    let query = supabase
        .from('attendance')
        .select(`
            *,
            employee:employees(id, name, employee_id, designation, avatar_url, duty_start_time, department:departments(id, name))
        `)
        .eq('date', date)
        .order('clock_in', { ascending: true, nullsFirst: false })

    // Members can only see their own attendance
    if (!isAdmin) {
        query = query.eq('employee_id', auth.employee.id)
    } else if (employeeId) {
        query = query.eq('employee_id', employeeId)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// POST /api/attendance - mark attendance (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ to mark attendance
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()

    const { employee_id, date, clock_in, status, notes } = body

    if (!employee_id || !date) {
        return NextResponse.json(
            { error: 'employee_id and date are required' },
            { status: 400 }
        )
    }

    // Safety guard: Admins cannot override their own attendance manually
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin && employee_id === auth.employee.id) {
        return NextResponse.json({ error: 'Admins cannot manually override their own attendance records' }, { status: 403 })
    }

    const { data, error } = await supabase
        .from('attendance')
        .upsert(
            {
                employee_id,
                date,
                clock_in: clock_in || null,
                status: status || 'present',
                notes: notes || null,
            },
            { onConflict: 'employee_id,date' }
        )
        .select(`
            *,
            employee:employees(id, name, employee_id, designation, avatar_url, duty_start_time, department:departments(id, name))
        `)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}
