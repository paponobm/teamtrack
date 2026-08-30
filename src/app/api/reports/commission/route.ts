import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/commission - super admin only (salary data)
export async function GET(req: NextRequest) {
    const auth = await requireAuth(2) // Super Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const month = req.nextUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const monthStart = month + '-01'
    const monthEnd = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    // Commission rates (configurable per org later)
    const BASE_SALARY = 0
    const POINT_VALUE = 50
    const ORDER_BONUS = 10
    const ATTENDANCE_BONUS = 100

    const [{ rows: employees }, { rows: work }, { rows: perf }, { rows: att }] = await Promise.all([
        db.query(
            `SELECT e.id, e.name, e.employee_id, json_build_object('name', d.name) AS department
             FROM employees e LEFT JOIN departments d ON d.id = e.department_id
             WHERE e.is_active = true ORDER BY e.name`
        ),
        db.query(`SELECT employee_id, delivery_status FROM work_entries WHERE date >= $1 AND date <= $2`, [monthStart, monthEnd]),
        db.query(`SELECT employee_id, points FROM performance_scores WHERE date >= $1 AND date <= $2`, [monthStart, monthEnd]),
        db.query(`SELECT employee_id, status FROM attendance WHERE date >= $1 AND date <= $2`, [monthStart, monthEnd]),
    ])

    const commissions = employees.map(emp => {
        const empDelivered = work.filter(w => w.employee_id === emp.id && w.delivery_status === 'delivered').length
        const empTotalOrders = work.filter(w => w.employee_id === emp.id).length
        const empPoints = perf.filter(p => p.employee_id === emp.id).reduce((s, p) => s + (p.points || 0), 0)
        const empPresent = att.filter(a => a.employee_id === emp.id && (a.status === 'present' || a.status === 'late')).length

        const orderCommission = empDelivered * ORDER_BONUS
        const pointCommission = empPoints * POINT_VALUE
        const attendanceCommission = empPresent * ATTENDANCE_BONUS
        const totalCommission = BASE_SALARY + orderCommission + pointCommission + attendanceCommission

        return {
            id: emp.id, name: emp.name, employeeId: emp.employee_id,
            department: emp.department?.name || '-',
            orders: empTotalOrders, delivered: empDelivered, points: empPoints, presentDays: empPresent,
            orderCommission, pointCommission, attendanceCommission, totalCommission,
        }
    })

    commissions.sort((a, b) => b.totalCommission - a.totalCommission)
    const grandTotal = commissions.reduce((s, c) => s + c.totalCommission, 0)

    return NextResponse.json({ month, rates: { POINT_VALUE, ORDER_BONUS, ATTENDANCE_BONUS }, commissions, grandTotal })
}
