import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/dashboard/employee?employee_id=xxx - personal dashboard for an employee
export async function GET(req: NextRequest) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const employeeId = req.nextUrl.searchParams.get('employee_id')

    if (!employeeId) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })

    // Members may only view their own dashboard; admins (level <= 3) may view anyone's.
    if (employeeId !== auth.employee.id && auth.employee.roleLevel > 3) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'

    const [todayWork, monthWork, perfScores, attendance] = await Promise.all([
        db.query(`SELECT id, amount, source, delivery_status FROM work_entries WHERE employee_id = $1 AND date = $2`, [employeeId, today]),
        db.query(`SELECT id, amount, delivery_status FROM work_entries WHERE employee_id = $1 AND date >= $2 AND date <= $3`, [employeeId, monthStart, today]),
        db.query(
            `SELECT ps.points, json_build_object('name', pc.name) AS category
             FROM performance_scores ps LEFT JOIN point_categories pc ON pc.id = ps.category_id
             WHERE ps.employee_id = $1 AND ps.date >= $2 AND ps.date <= $3`,
            [employeeId, monthStart, today]
        ),
        db.query(
            `SELECT date, status, check_in, check_out FROM attendance
             WHERE employee_id = $1 AND date >= $2 AND date <= $3
             ORDER BY date DESC`,
            [employeeId, monthStart, today]
        ),
    ])

    const todayEntries = todayWork.rows
    const monthEntries = monthWork.rows
    const todayOrders = todayEntries.length
    const todayAmount = todayEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const monthOrders = monthEntries.length
    const monthAmount = monthEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0)

    // Delivery stats
    const delivered = monthEntries.filter(e => e.delivery_status === 'delivered').length
    const cancelled = monthEntries.filter(e => e.delivery_status === 'cancelled').length
    const deliveryRate = monthOrders > 0 ? Math.round((delivered / monthOrders) * 100) : 0
    const cancelRate = monthOrders > 0 ? Math.round((cancelled / monthOrders) * 100) : 0

    // Performance points
    const totalPoints = perfScores.rows.reduce((s, p) => s + (p.points || 0), 0)

    // Attendance
    const attendanceDays = attendance.rows
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
