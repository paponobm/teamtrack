import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/monthly - admin only
export async function GET(req: NextRequest) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const month = req.nextUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const monthStart = month + '-01'
    const monthEnd = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    const [employees, workEntries, pointTx, attendanceData] = await Promise.all([
        supabase.from('employees').select('id, name, employee_id, avatar_url, total_points, department:departments(name)').eq('is_active', true).order('name'),
        supabase.from('work_entries').select('employee_id, amount, suggested_amount, delivery_status').gte('date', monthStart).lte('date', monthEnd),
        // Rank by points actually EARNED this month (delivered orders, tasks, etc.), from the ledger.
        supabase.from('point_transactions').select('employee_id, points').gte('created_at', monthStart + 'T00:00:00').lte('created_at', monthEnd + 'T23:59:59'),
        supabase.from('attendance').select('employee_id, status').gte('date', monthStart).lte('date', monthEnd),
    ])

    const work = workEntries.data || []
    const pts = pointTx.data || []
    const att = attendanceData.data || []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report = (employees.data || []).map((emp: any) => {
        const empWork = work.filter(w => w.employee_id === emp.id)
        const empPts = pts.filter(p => p.employee_id === emp.id)
        const empAtt = att.filter(a => a.employee_id === emp.id)

        const totalOrders = empWork.length
        // Actual order total = base amount + suggested (matches the work-log page).
        const totalAmount = empWork.reduce((s, w) => s + (Number(w.amount) || 0) + (Number(w.suggested_amount) || 0), 0)
        const delivered = empWork.filter(w => w.delivery_status === 'delivered').length
        const cancelled = empWork.filter(w => w.delivery_status === 'cancelled').length
        const deliveryRate = totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0
        const cancelRate = totalOrders > 0 ? Math.round((cancelled / totalOrders) * 100) : 0
        const totalPoints = empPts.reduce((s, p) => s + (Number(p.points) || 0), 0)   // earned this month
        const lifetimePoints = Number(emp.total_points) || 0                          // all-time balance
        const presentDays = empAtt.filter(a => a.status === 'present' || a.status === 'late').length
        const totalDays = empAtt.length || 1
        const attendanceRate = Math.round((presentDays / totalDays) * 100)

        const deptName = Array.isArray(emp.department) ? emp.department[0]?.name : emp.department?.name

        return {
            id: emp.id, name: emp.name, employeeId: emp.employee_id,
            department: deptName || '-', avatar_url: emp.avatar_url || null,
            totalOrders, totalAmount, delivered, cancelled,
            deliveryRate, cancelRate, totalPoints, lifetimePoints, attendanceRate, presentDays,
        }
    })

    // Rank by points earned this month; tiebreak by order amount so equal-points rows aren't alphabetical.
    report.sort((a: { totalPoints: number; totalAmount: number }, b: { totalPoints: number; totalAmount: number }) =>
        b.totalPoints - a.totalPoints || b.totalAmount - a.totalAmount)

    const teamTotals = {
        totalOrders: report.reduce((s: number, r: { totalOrders: number }) => s + r.totalOrders, 0),
        totalAmount: report.reduce((s: number, r: { totalAmount: number }) => s + r.totalAmount, 0),
        totalPoints: report.reduce((s: number, r: { totalPoints: number }) => s + r.totalPoints, 0),
        avgDeliveryRate: report.length > 0 ? Math.round(report.reduce((s: number, r: { deliveryRate: number }) => s + r.deliveryRate, 0) / report.length) : 0,
        avgAttendance: report.length > 0 ? Math.round(report.reduce((s: number, r: { attendanceRate: number }) => s + r.attendanceRate, 0) / report.length) : 0,
    }

    return NextResponse.json({ month, report, teamTotals })
}
