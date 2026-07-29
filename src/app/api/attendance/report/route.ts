import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// No configurable shift-length exists anywhere in the schema (only a per-employee
// duty_start_time, no duty_end_time) — 8h is the assumed standard workday for Overtime.
const STANDARD_SHIFT_MS = 8 * 60 * 60 * 1000

// GET /api/attendance/report?start_date&end_date&employee_id&status&search&page&limit
// Cross-employee attendance report for Daily/Weekly/Monthly/Custom ranges (admin only).
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only — this reports on all employees
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const employeeId = searchParams.get('employee_id') || ''
    const status = searchParams.get('status') || ''
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '20')))

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
    }

    let query = supabase
        .from('attendance')
        .select(`
            id, date, clock_in, clock_out, status,
            employee:employees(id, name, employee_id, avatar_url, department:departments(id, name))
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('clock_in', { ascending: true, nullsFirst: false })

    if (employeeId) query = query.eq('employee_id', employeeId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows = (data || []) as any[]

    if (search) {
        rows = rows.filter(r =>
            r.employee?.name?.toLowerCase().includes(search) ||
            r.employee?.employee_id?.toLowerCase().includes(search))
    }

    // Summary counts reflect the whole filtered range, not just the current page.
    const counts = { present: 0, late: 0, absent: 0, leave: 0 }
    rows.forEach(r => {
        if (r.status === 'present') counts.present++
        else if (r.status === 'late') counts.late++
        else if (r.status === 'absent') counts.absent++
        else if (r.status === 'leave') counts.leave++
    })

    const total = rows.length
    const offset = (page - 1) * limit
    const pageRows = rows.slice(offset, offset + limit)

    // Break time only needs computing for the rows actually being returned this page.
    const attendanceIds = pageRows.map(r => r.id)
    const breaksByAttendance: Record<string, number> = {}
    if (attendanceIds.length > 0) {
        const { data: breaks } = await supabase
            .from('attendance_breaks')
            .select('attendance_id, start_time, end_time')
            .in('attendance_id', attendanceIds)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ; (breaks || []).forEach((b: any) => {
            const start = new Date(b.start_time).getTime()
            const end = b.end_time ? new Date(b.end_time).getTime() : Date.now()
            breaksByAttendance[b.attendance_id] = (breaksByAttendance[b.attendance_id] || 0) + Math.max(0, end - start)
        })
    }

    const entries = pageRows.map(r => {
        let grossMs = 0
        if (r.clock_in) {
            const start = new Date(r.clock_in).getTime()
            const end = r.clock_out ? new Date(r.clock_out).getTime() : Date.now()
            grossMs = Math.max(0, end - start)
        }
        const breakMs = breaksByAttendance[r.id] || 0
        const workingMs = Math.max(0, grossMs - breakMs)
        const overtimeMs = Math.max(0, workingMs - STANDARD_SHIFT_MS)

        return {
            id: r.id,
            date: r.date,
            clock_in: r.clock_in,
            clock_out: r.clock_out,
            status: r.status,
            employee: {
                id: r.employee?.id,
                name: r.employee?.name,
                employee_id: r.employee?.employee_id,
                avatar_url: r.employee?.avatar_url,
                department: r.employee?.department?.name || null,
            },
            workingMs,
            breakMs,
            overtimeMs,
        }
    })

    return NextResponse.json({ entries, total, counts, page, limit })
}
