import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/work-log/ranking - member ranking by order count and amount
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'monthly' // 'weekly' | 'monthly'

    // Calculate date range
    const now = new Date()
    let startDate: string

    if (period === 'weekly') {
        const weekStart = new Date(now)
        const day = weekStart.getDay()
        weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1)) // Monday
        startDate = weekStart.toISOString().split('T')[0]
    } else if (period === 'monthly') {
        // monthly
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    } else {
        // daily
        startDate = now.toISOString().split('T')[0]
    }

    const endDate = now.toISOString().split('T')[0]

    const { rows: entries } = await db.query(
        `SELECT employee_id, amount, suggested_amount, order_type FROM work_entries WHERE date >= $1 AND date <= $2`,
        [startDate, endDate]
    )

    // Aggregate per employee
    const empMap: Record<string, { totalOrders: number; totalAmount: number; orders2000Plus: number }> = {}
    for (const e of entries) {
        if (!e.employee_id) continue
        if (!empMap[e.employee_id]) {
            empMap[e.employee_id] = { totalOrders: 0, totalAmount: 0, orders2000Plus: 0 }
        }
        empMap[e.employee_id].totalOrders++
        empMap[e.employee_id].totalAmount += (Number(e.amount) || 0) + (Number(e.suggested_amount) || 0)
        if (e.order_type && e.order_type.includes('2000_plus')) empMap[e.employee_id].orders2000Plus++
    }

    // Fetch employee names
    const empIds = Object.keys(empMap)
    if (empIds.length === 0) {
        return NextResponse.json({ ranking: [], period, startDate, endDate })
    }

    const { rows: employees } = await db.query(`SELECT id, name, employee_id FROM employees WHERE id = ANY($1)`, [empIds])

    const empNameMap: Record<string, { name: string; employee_id: string }> = {}
    for (const emp of employees) {
        empNameMap[emp.id] = { name: emp.name, employee_id: emp.employee_id }
    }

    // Build ranking sorted by totalAmount desc
    const ranking = Object.entries(empMap)
        .map(([empId, stats]) => ({
            employee_id: empId,
            name: empNameMap[empId]?.name || 'Unknown',
            emp_code: empNameMap[empId]?.employee_id || '',
            ...stats,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)

    return NextResponse.json({ ranking, period, startDate, endDate })
}
