import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/attendance/me - get today's attendance & breaks for the logged-in user
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // 1. Get attendance record for today
    const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', auth.employee.id)
        .eq('date', date)
        .maybeSingle()

    if (attError) return NextResponse.json({ error: attError.message }, { status: 500 })

    if (!attendance) {
        return NextResponse.json({ record: null, breaks: [] })
    }

    // 2. Get breaks for this attendance record
    const { data: breaks, error: breaksError } = await supabase
        .from('attendance_breaks')
        .select('*')
        .eq('attendance_id', attendance.id)
        .order('start_time', { ascending: true })

    if (breaksError) return NextResponse.json({ error: breaksError.message }, { status: 500 })

    return NextResponse.json({ record: attendance, breaks })
}

// POST /api/attendance/me - clock_in, clock_out, start_break, end_break
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { action, date } = body // action: 'clock_in', 'clock_out', 'start_break', 'end_break'
    
    if (!action || !date) {
        return NextResponse.json({ error: 'Action and date are required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Ensure attendance record exists
    let { data: attendance, error: fetchErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', auth.employee.id)
        .eq('date', date)
        .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    if (action === 'clock_in') {
        // Late if clocking in more than 15 minutes after the employee's duty start time
        // (falls back to 09:00 if not set, matching the threshold used in /api/attendance/absent).
        const { data: empRow } = await supabase
            .from('employees')
            .select('duty_start_time')
            .eq('id', auth.employee.id)
            .single()

        const startTime = empRow?.duty_start_time || '09:00:00'
        const [dutyH, dutyM] = startTime.split(':').map(Number)
        const shiftStart = new Date(`${date}T00:00:00`)
        shiftStart.setHours(dutyH, dutyM, 0, 0)
        const LATE_GRACE_MS = 15 * 60 * 1000
        const clockInStatus = Date.now() - shiftStart.getTime() > LATE_GRACE_MS ? 'late' : 'present'

        if (!attendance) {
            const { data: newAtt, error: insErr } = await supabase
                .from('attendance')
                .insert({
                    employee_id: auth.employee.id,
                    date: date,
                    clock_in: now,
                    status: clockInStatus
                })
                .select()
                .single()
            if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
            attendance = newAtt
        } else if (!attendance.clock_in) {
            const { data: updAtt, error: updErr } = await supabase
                .from('attendance')
                .update({ clock_in: now, status: clockInStatus })
                .eq('id', attendance.id)
                .select()
                .single()
            if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
            attendance = updAtt
        }
    } else if (action === 'clock_out') {
        if (!attendance) return NextResponse.json({ error: 'Must clock in first' }, { status: 400 })
        const { data: updAtt, error: updErr } = await supabase
            .from('attendance')
            .update({ clock_out: now })
            .eq('id', attendance.id)
            .select()
            .single()
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
        attendance = updAtt
    } else if (action === 'start_break') {
        if (!attendance) return NextResponse.json({ error: 'Must clock in first' }, { status: 400 })
        // Guard against double-tap: don't open a second break while one is already open
        // (orphan open breaks corrupt the day's net-hours math).
        const { data: openBreaks } = await supabase
            .from('attendance_breaks')
            .select('id')
            .eq('attendance_id', attendance.id)
            .is('end_time', null)
            .limit(1)
        if (openBreaks && openBreaks.length > 0) {
            return NextResponse.json({ error: 'A break is already in progress' }, { status: 400 })
        }
        const { error: insErr } = await supabase
            .from('attendance_breaks')
            .insert({
                attendance_id: attendance.id,
                start_time: now
            })
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    } else if (action === 'end_break') {
        if (!attendance) return NextResponse.json({ error: 'No active attendance' }, { status: 400 })
        
        // Find active break
        const { data: activeBreaks, error: fetchBrkErr } = await supabase
            .from('attendance_breaks')
            .select('*')
            .eq('attendance_id', attendance.id)
            .is('end_time', null)
            .order('start_time', { ascending: false })
            .limit(1)

        if (fetchBrkErr) return NextResponse.json({ error: fetchBrkErr.message }, { status: 500 })
        
        if (activeBreaks && activeBreaks.length > 0) {
            const activeBreak = activeBreaks[0]
            const { error: updErr } = await supabase
                .from('attendance_breaks')
                .update({ end_time: now })
                .eq('id', activeBreak.id)
            if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
        } else {
            return NextResponse.json({ error: 'No active break found' }, { status: 400 })
        }
    } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Fetch fresh breaks to return
    let breaks = []
    if (attendance) {
        const { data: freshBreaks } = await supabase
            .from('attendance_breaks')
            .select('*')
            .eq('attendance_id', attendance.id)
            .order('start_time', { ascending: true })
        if (freshBreaks) breaks = freshBreaks
    }

    return NextResponse.json({ record: attendance, breaks })
}
