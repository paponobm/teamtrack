import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/monthly - admin only
export async function GET(req: NextRequest) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const month = req.nextUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const monthStart = month + '-01'
    const monthEnd = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    const [{ rows: employees }, { rows: work }, { rows: pts }, { rows: att }] = await Promise.all([
        db.query(
            `SELECT e.id, e.name, e.employee_id, e.avatar_url, e.total_points, json_build_object('name', d.name) AS department
             FROM employees e LEFT JOIN departments d ON d.id = e.department_id
             WHERE e.is_active = true ORDER BY e.name`
        ),
        db.query(`SELECT employee_id, amount, suggested_amount, delivery_status FROM work_entries WHERE date >= $1 AND date <= $2`, [monthStart, monthEnd]),
        // Rank by points actually EARNED this month (delivered orders, tasks, etc.), from the ledger.
        db.query(`SELECT employee_id, points FROM point_transactions WHERE created_at >= $1 AND created_at <= $2`, [monthStart + 'T00:00:00', monthEnd + 'T23:59:59']),
        db.query(`SELECT employee_id, status FROM attendance WHERE date >= $1 AND date <= $2`, [monthStart, monthEnd]),
    ])

    const report = employees.map(emp => {
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

        return {
            id: emp.id, name: emp.name, employeeId: emp.employee_id,
            department: emp.department?.name || '-', avatar_url: emp.avatar_url || null,
            totalOrders, totalAmount, delivered, cancelled,
            deliveryRate, cancelRate, totalPoints, lifetimePoints, attendanceRate, presentDays,
        }
    })

    // Rank by points earned this month; tiebreak by order amount so equal-points rows aren't alphabetical.
    report.sort((a, b) => b.totalPoints - a.totalPoints || b.totalAmount - a.totalAmount)

    const teamTotals = {
        totalOrders: report.reduce((s, r) => s + r.totalOrders, 0),
        totalAmount: report.reduce((s, r) => s + r.totalAmount, 0),
        totalPoints: report.reduce((s, r) => s + r.totalPoints, 0),
        avgDeliveryRate: report.length > 0 ? Math.round(report.reduce((s, r) => s + r.deliveryRate, 0) / report.length) : 0,
        avgAttendance: report.length > 0 ? Math.round(report.reduce((s, r) => s + r.attendanceRate, 0) / report.length) : 0,
    }

    return NextResponse.json({ month, report, teamTotals })
}
