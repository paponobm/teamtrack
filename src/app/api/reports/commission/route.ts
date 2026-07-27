import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/commission - super admin only (salary data)
export async function GET(req: NextRequest) {
    const auth = await requireAuth(2) // Super Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const month = req.nextUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const monthStart = month + '-01'
    const monthEnd = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    // Commission rates (configurable per org later)
    const BASE_SALARY = 0
    const POINT_VALUE = 50
    const ORDER_BONUS = 10
    const ATTENDANCE_BONUS = 100

    const [employees, workEntries, perfScores, attendanceData] = await Promise.all([
        supabase.from('employees').select('id, name, employee_id, department:departments(name)').eq('is_active', true).order('name'),
        supabase.from('work_entries').select('employee_id, delivery_status').gte('date', monthStart).lte('date', monthEnd),
        supabase.from('performance_scores').select('employee_id, points').gte('date', monthStart).lte('date', monthEnd),
        supabase.from('attendance').select('employee_id, status').gte('date', monthStart).lte('date', monthEnd),
    ])

    const work = workEntries.data || []
    const perf = perfScores.data || []
    const att = attendanceData.data || []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commissions = (employees.data || []).map((emp: any) => {
        const empDelivered = work.filter(w => w.employee_id === emp.id && w.delivery_status === 'delivered').length
        const empTotalOrders = work.filter(w => w.employee_id === emp.id).length
        const empPoints = perf.filter(p => p.employee_id === emp.id).reduce((s, p) => s + (p.points || 0), 0)
        const empPresent = att.filter(a => a.employee_id === emp.id && (a.status === 'present' || a.status === 'late')).length

        const orderCommission = empDelivered * ORDER_BONUS
        const pointCommission = empPoints * POINT_VALUE
        const attendanceCommission = empPresent * ATTENDANCE_BONUS
        const totalCommission = BASE_SALARY + orderCommission + pointCommission + attendanceCommission

        const deptName = Array.isArray(emp.department) ? emp.department[0]?.name : emp.department?.name

        return {
            id: emp.id, name: emp.name, employeeId: emp.employee_id,
            department: deptName || '-',
            orders: empTotalOrders, delivered: empDelivered, points: empPoints, presentDays: empPresent,
            orderCommission, pointCommission, attendanceCommission, totalCommission,
        }
    })

    commissions.sort((a: { totalCommission: number }, b: { totalCommission: number }) => b.totalCommission - a.totalCommission)
    const grandTotal = commissions.reduce((s: number, c: { totalCommission: number }) => s + c.totalCommission, 0)

    return NextResponse.json({ month, rates: { POINT_VALUE, ORDER_BONUS, ATTENDANCE_BONUS }, commissions, grandTotal })
}
