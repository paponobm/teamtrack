import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/dashboard - aggregated dashboard stats including all modules
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    // Optional ?date=YYYY-MM-DD lets admins view a specific day (Today / Yesterday / custom).
    const dateParam = new URL(request.url).searchParams.get('date')
    const today = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'
    // Last day of the selected date's month (computed without UTC shift).
    const [yr, mo] = today.split('-').map(Number)
    const monthEnd = `${today.slice(0, 7)}-${String(new Date(yr, mo, 0).getDate()).padStart(2, '0')}`

    // Parallel queries - includes all page stats
    const [
        membersRes,
        todayWorkRes,
        monthWorkRes,
        problemsRes,
        allAttendanceRes,
        performanceRes,
        courierRes,
        expensesRes,
        requisitionsRes,
    ] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS count FROM employees WHERE is_active = true`),
        db.query(
            `SELECT w.id, w.amount, w.suggested_amount, w.employee_id, w.source, w.created_at,
                json_build_object('name', e.name, 'avatar_url', e.avatar_url) AS employee
             FROM work_entries w LEFT JOIN employees e ON e.id = w.employee_id
             WHERE w.date = $1`,
            [today]
        ),
        db.query(
            `SELECT employee_id, amount, suggested_amount FROM work_entries WHERE date >= $1 AND date <= $2`,
            [monthStart, monthEnd]
        ),
        db.query(`SELECT id, status FROM problems WHERE status = ANY($1)`, [['open', 'in_progress', 'resolved', 'escalated']]),
        db.query(`SELECT id, status FROM attendance WHERE date = $1`, [today]),
        db.query(
            `SELECT pt.employee_id, pt.points,
                json_build_object('name', e.name, 'avatar_url', e.avatar_url) AS employee
             FROM point_transactions pt LEFT JOIN employees e ON e.id = pt.employee_id
             WHERE pt.created_at >= $1 AND pt.created_at <= $2`,
            [monthStart + 'T00:00:00', monthEnd + 'T23:59:59']
        ),
        db.query(`SELECT id, problem_status, fraud_note FROM courier_issues`),
        db.query(`SELECT id, amount, payment_status FROM expenses`),
        db.query(`SELECT id, manager_approval, management_approval FROM requisitions`),
    ])

    const totalMembers = membersRes.rows[0]?.count || 0

    // Attendance breakdown
    const allAttendance = allAttendanceRes.rows
    const attPresent = allAttendance.filter((a: { status: string }) => a.status === 'present').length
    const attLate = allAttendance.filter((a: { status: string }) => a.status === 'late').length
    const attAbsent = allAttendance.filter((a: { status: string }) => a.status === 'absent').length
    const attLeave = allAttendance.filter((a: { status: string }) => ['leave', 'half_day', 'on_duty'].includes(a.status)).length
    const activeToday = attPresent + attLate

    // Today's work stats
    const todayEntries = todayWorkRes.rows
    const todayOrders = todayEntries.length
    const todayAmount = todayEntries.reduce((s: number, e: { amount: number; suggested_amount?: number }) => s + (Number(e.amount) || 0) + (Number(e.suggested_amount) || 0), 0)

    // Monthly work stats
    const monthEntries = monthWorkRes.rows
    const monthOrders = monthEntries.length
    const monthAmount = monthEntries.reduce((s: number, e: { amount: number; suggested_amount?: number }) => s + (Number(e.amount) || 0) + (Number(e.suggested_amount) || 0), 0)

    // Problems stats
    const allProblems = problemsRes.rows
    const openProblems = allProblems.filter((p: { status: string }) => p.status === 'open').length
    const inProgressProblems = allProblems.filter((p: { status: string }) => p.status === 'in_progress').length
    const resolvedProblems = allProblems.filter((p: { status: string }) => p.status === 'resolved').length

    // Courier stats
    const allCourier = courierRes.rows
    const courierTotal = allCourier.length
    const courierPending = allCourier.filter((i: { problem_status: string }) => i.problem_status === 'pending').length
    const courierResolved = allCourier.filter((i: { problem_status: string }) => i.problem_status === 'resolved').length
    const courierFraud = allCourier.filter((i: { fraud_note: boolean }) => i.fraud_note).length

    // Expenses stats
    const allExpenses = expensesRes.rows
    const expensesTotal = allExpenses.reduce((s: number, e: { amount: number }) => s + (Number(e.amount) || 0), 0)
    const expensesPending = allExpenses.filter((e: { payment_status: string }) => e.payment_status === 'pending').reduce((s: number, e: { amount: number }) => s + (Number(e.amount) || 0), 0)
    const expensesPaid = allExpenses.filter((e: { payment_status: string }) => e.payment_status === 'paid').reduce((s: number, e: { amount: number }) => s + (Number(e.amount) || 0), 0)
    const expensesRejected = allExpenses.filter((e: { payment_status: string }) => e.payment_status === 'rejected').reduce((s: number, e: { amount: number }) => s + (Number(e.amount) || 0), 0)

    // Requisitions stats
    const allReqs = requisitionsRes.rows
    const reqsTotal = allReqs.length
    const reqsPending = allReqs.filter((r: { manager_approval: string }) => r.manager_approval === 'pending').length
    const reqsApproved = allReqs.filter((r: { manager_approval: string; management_approval: string }) => r.manager_approval === 'approved' && r.management_approval === 'approved').length
    const reqsRejected = allReqs.filter((r: { manager_approval: string; management_approval: string }) => r.manager_approval === 'rejected' || r.management_approval === 'rejected').length

    // Recent activity (last 5 work entries today)
    const recentActivity = todayEntries.slice(0, 5).map((e: { employee?: { name?: string; avatar_url?: string | null }; amount: number; source: string; created_at: string }) => ({
        name: e.employee?.name || 'Unknown',
        action: `submitted ৳${Number(e.amount).toLocaleString()} order via ${e.source}`,
        time: e.created_at,
        type: 'work',
        avatar_url: e.employee?.avatar_url || null,
    }))

    // Top performers this month (aggregate points)
    const perfData = performanceRes.rows
    const perfMap: Record<string, { name: string; points: number; avatar_url: string | null }> = {}
    perfData.forEach((s: { employee_id: string; points: number; employee?: { name?: string; avatar_url?: string | null } }) => {
        if (!perfMap[s.employee_id]) {
            perfMap[s.employee_id] = { name: s.employee?.name || 'Unknown', points: 0, avatar_url: s.employee?.avatar_url || null }
        }
        perfMap[s.employee_id].points += (s.points || 0)
    })

    // Monthly orders per employee for top performers
    const orderMap: Record<string, number> = {}
    monthEntries.forEach((e: { employee_id: string }) => {
        orderMap[e.employee_id] = (orderMap[e.employee_id] || 0) + 1
    })

    const topPerformers = Object.entries(perfMap)
        .map(([id, v]) => ({ id, name: v.name, points: v.points, orders: orderMap[id] || 0, avatar_url: v.avatar_url }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 5)

    return NextResponse.json({
        stats: {
            totalMembers,
            activeToday,
            attendanceRate: totalMembers > 0 ? Math.round((activeToday / totalMembers) * 100) : 0,
            todayOrders,
            todayAmount,
            monthOrders,
            monthAmount,
            openProblems,
        },
        // Module-level stats for dashboard cards
        moduleStats: {
            attendance: { total: allAttendance.length, present: attPresent, late: attLate, absent: attAbsent, leave: attLeave },
            workLog: { todayOrders, todayAmount, monthOrders, monthAmount },
            members: { total: totalMembers },
            problems: { total: allProblems.length, open: openProblems, inProgress: inProgressProblems, resolved: resolvedProblems },
            courier: { total: courierTotal, pending: courierPending, resolved: courierResolved, fraud: courierFraud },
            expenses: { total: expensesTotal, pending: expensesPending, paid: expensesPaid, rejected: expensesRejected, count: allExpenses.length },
            requisitions: { total: reqsTotal, pending: reqsPending, approved: reqsApproved, rejected: reqsRejected },
        },
        recentActivity,
        topPerformers,
    })
}
