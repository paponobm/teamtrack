import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/dashboard/employee?employee_id=xxx - personal dashboard for an employee
export async function GET(req: NextRequest) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const employeeId = req.nextUrl.searchParams.get('employee_id')

    if (!employeeId) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })

    // Members may only view their own dashboard; admins (level <= 3) may view anyone's.
    if (employeeId !== auth.employee.id && auth.employee.roleLevel > 3) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'

    const [todayWork, monthWork, perfScores, attendance] = await Promise.all([
        supabase.from('work_entries').select('id, amount, source, delivery_status', { count: 'exact' })
            .eq('employee_id', employeeId).eq('date', today),
        supabase.from('work_entries').select('id, amount, delivery_status', { count: 'exact' })
            .eq('employee_id', employeeId).gte('date', monthStart).lte('date', today),
        supabase.from('performance_scores').select('points, category:point_categories(name)')
            .eq('employee_id', employeeId).gte('date', monthStart).lte('date', today),
        supabase.from('attendance').select('date, status, check_in, check_out')
            .eq('employee_id', employeeId).gte('date', monthStart).lte('date', today)
            .order('date', { ascending: false }),
    ])

    const todayEntries = todayWork.data || []
    const monthEntries = monthWork.data || []
    const todayOrders = todayWork.count || 0
    const todayAmount = todayEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const monthOrders = monthWork.count || 0
    const monthAmount = monthEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0)

    // Delivery stats
    const delivered = monthEntries.filter(e => e.delivery_status === 'delivered').length
    const cancelled = monthEntries.filter(e => e.delivery_status === 'cancelled').length
    const deliveryRate = monthOrders > 0 ? Math.round((delivered / monthOrders) * 100) : 0
    const cancelRate = monthOrders > 0 ? Math.round((cancelled / monthOrders) * 100) : 0

    // Performance points
    const totalPoints = (perfScores.data || []).reduce((s, p) => s + (p.points || 0), 0)

    // Attendance
    const attendanceDays = attendance.data || []
    const presentDays = attendanceDays.filter(a => a.status === 'present').length
    const absentDays = attendanceDays.filter(a => a.status === 'absent').length
    const lateDays = attendanceDays.filter(a => a.status === 'late').length
    const present = presentDays + lateDays
    const workingDays = attendanceDays.length || 1
    const attendanceRate = Math.round((present / workingDays) * 100)

    return NextResponse.json({
        todayOrders, todayAmount, monthOrders, monthAmount,
        deliveryRate, cancelRate, totalPoints, attendanceRate,
        presentDays, absentDays, lateDays,
        attendanceDays: attendanceDays.slice(0, 7),
    })
}
