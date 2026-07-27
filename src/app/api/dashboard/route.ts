import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/dashboard - aggregated dashboard stats including all modules
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const adminSupabase = createAdminClient()

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
        supabase.from('employees').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('work_entries').select('id, amount, suggested_amount, employee_id, source, created_at, employee:employees!employee_id(name, avatar_url)', { count: 'exact' }).eq('date', today),
        supabase.from('work_entries').select('employee_id, amount, suggested_amount').gte('date', monthStart).lte('date', monthEnd),
        supabase.from('problems').select('id, status', { count: 'exact' }).in('status', ['open', 'in_progress', 'resolved', 'escalated']),
        supabase.from('attendance').select('id, status').eq('date', today),
        // Top Performers: admin client bypasses any RLS so all employees' points are visible.
        adminSupabase.from('point_transactions').select('employee_id, points, employee:employees!employee_id(name, avatar_url)').gte('created_at', monthStart + 'T00:00:00').lte('created_at', monthEnd + 'T23:59:59'),
        supabase.from('courier_issues').select('id, problem_status, fraud_note'),
        supabase.from('expenses').select('id, amount, payment_status'),
        supabase.from('requisitions').select('id, manager_approval, management_approval'),
    ])

    const totalMembers = membersRes.count || 0

    // Attendance breakdown
    const allAttendance = allAttendanceRes.data || []
    const attPresent = allAttendance.filter((a: { status: string }) => a.status === 'present').length
    const attLate = allAttendance.filter((a: { status: string }) => a.status === 'late').length
    const attAbsent = allAttendance.filter((a: { status: string }) => a.status === 'absent').length
    const attLeave = allAttendance.filter((a: { status: string }) => ['leave', 'half_day', 'on_duty'].includes(a.status)).length
    const activeToday = attPresent + attLate

    // Today's work stats
    const todayEntries = todayWorkRes.data || []
    const todayOrders = todayWorkRes.count || 0
    const todayAmount = todayEntries.reduce((s: number, e: { amount: number; suggested_amount?: number }) => s + (Number(e.amount) || 0) + (Number(e.suggested_amount) || 0), 0)

    // Monthly work stats
    const monthEntries = monthWorkRes.data || []
    const monthOrders = monthEntries.length
    const monthAmount = monthEntries.reduce((s: number, e: { amount: number; suggested_amount?: number }) => s + (Number(e.amount) || 0) + (Number(e.suggested_amount) || 0), 0)

    // Problems stats
    const allProblems = problemsRes.data || []
    const openProblems = allProblems.filter((p: { status: string }) => p.status === 'open').length
    const inProgressProblems = allProblems.filter((p: { status: string }) => p.status === 'in_progress').length
    const resolvedProblems = allProblems.filter((p: { status: string }) => p.status === 'resolved').length

    // Courier stats
    const allCourier = courierRes.data || []
    const courierTotal = allCourier.length
    const courierPending = allCourier.filter((i: { problem_status: string }) => i.problem_status === 'pending').length
    const courierResolved = allCourier.filter((i: { problem_status: string }) => i.problem_status === 'resolved').length
    const courierFraud = allCourier.filter((i: { fraud_note: boolean }) => i.fraud_note).length

    // Expenses stats
    const allExpenses = expensesRes.data || []
    const expensesTotal = allExpenses.reduce((s: number, e: { amount: number }) => s + (Number(e.amount) || 0), 0)
    const expensesPending = allExpenses.filter((e: { payment_status: string }) => e.payment_status === 'pending').reduce((s: number, e: { amount: number }) => s + (Number(e.amount) || 0), 0)
    const expensesPaid = allExpenses.filter((e: { payment_status: string }) => e.payment_status === 'paid').reduce((s: number, e: { amount: number }) => s + (Number(e.amount) || 0), 0)
    const expensesRejected = allExpenses.filter((e: { payment_status: string }) => e.payment_status === 'rejected').reduce((s: number, e: { amount: number }) => s + (Number(e.amount) || 0), 0)

    // Requisitions stats
    const allReqs = requisitionsRes.data || []
    const reqsTotal = allReqs.length
    const reqsPending = allReqs.filter((r: { manager_approval: string }) => r.manager_approval === 'pending').length
    const reqsApproved = allReqs.filter((r: { manager_approval: string; management_approval: string }) => r.manager_approval === 'approved' && r.management_approval === 'approved').length
    const reqsRejected = allReqs.filter((r: { manager_approval: string; management_approval: string }) => r.manager_approval === 'rejected' || r.management_approval === 'rejected').length

    // Recent activity (last 5 work entries today)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentActivity = todayEntries.slice(0, 5).map((e: any) => {
        const empName = Array.isArray(e.employee) ? e.employee[0]?.name : e.employee?.name
        const empAvatar = Array.isArray(e.employee) ? e.employee[0]?.avatar_url : e.employee?.avatar_url
        return {
            name: empName || 'Unknown',
            action: `submitted ৳${Number(e.amount).toLocaleString()} order via ${e.source}`,
            time: e.created_at,
            type: 'work',
            avatar_url: empAvatar || null,
        }
    })

    // Top performers this month (aggregate points)
    const perfData = performanceRes.data || []
    const perfMap: Record<string, { name: string; points: number; avatar_url: string | null }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    perfData.forEach((s: any) => {
        const empName = Array.isArray(s.employee) ? s.employee[0]?.name : s.employee?.name
        const empAvatar = Array.isArray(s.employee) ? s.employee[0]?.avatar_url : s.employee?.avatar_url
        if (!perfMap[s.employee_id]) {
            perfMap[s.employee_id] = { name: empName || 'Unknown', points: 0, avatar_url: empAvatar || null }
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
