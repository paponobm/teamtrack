import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/performance/report - aggregated performance report with date range. Admin only.
export async function GET(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)

    const from = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0]

    // Get scores in range
    const { rows: scores } = await db.query(
        `SELECT employee_id, category_id, date, points FROM performance_scores WHERE date >= $1 AND date <= $2`,
        [from, to]
    )

    // Get attendance stats in range
    const { rows: attendance } = await db.query(
        `SELECT employee_id, status, date FROM attendance WHERE date >= $1 AND date <= $2`,
        [from, to]
    )

    // Get problem stats in range
    const { rows: problems } = await db.query(
        `SELECT problem_peek, problem_solver, status, created_at FROM problems WHERE created_at >= $1 AND created_at <= $2`,
        [`${from}T00:00:00`, `${to}T23:59:59`]
    )

    // Get employees
    const { rows: employees } = await db.query(
        `SELECT id, name, employee_id, total_points FROM employees WHERE is_active = true ORDER BY name`
    )

    // Build per-employee report
    const report = employees.map(emp => {
        // Performance scores aggregated
        const empScores = scores.filter(s => s.employee_id === emp.id)
        const totalPerformancePoints = empScores.reduce((sum, s) => sum + (s.points || 0), 0)
        const daysScored = new Set(empScores.map(s => s.date)).size

        // Attendance
        const empAttendance = attendance.filter(a => a.employee_id === emp.id)
        const presentDays = empAttendance.filter(a => a.status === 'present').length
        const lateDays = empAttendance.filter(a => a.status === 'late').length
        const absentDays = empAttendance.filter(a => a.status === 'absent').length
        const leaveDays = empAttendance.filter(a => a.status === 'leave' || a.status === 'half_day').length
        const totalDays = empAttendance.length
        // Auto time management: 10 pts per present, 5 for late, 0 for absent
        const timeManagementScore = presentDays * 10 + lateDays * 5

        // Problems
        const picked = problems.filter(p => p.problem_peek === emp.id).length
        const solved = problems.filter(p => p.problem_solver === emp.id && p.status === 'resolved').length
        // Auto problem solving: 5 per pick, 10 per solve
        const problemScore = picked * 5 + solved * 10

        return {
            employee_id: emp.id,
            name: emp.name,
            emp_code: emp.employee_id,
            lifetime_points: emp.total_points || 0,
            performance_points: totalPerformancePoints,
            days_scored: daysScored,
            time_management: timeManagementScore,
            problem_solving: problemScore,
            attendance: { present: presentDays, late: lateDays, absent: absentDays, leave: leaveDays, total: totalDays },
            problems: { picked, solved },
            combined_score: totalPerformancePoints + timeManagementScore + problemScore,
        }
    }).sort((a, b) => b.combined_score - a.combined_score)

    return NextResponse.json({ report, from, to })
}
