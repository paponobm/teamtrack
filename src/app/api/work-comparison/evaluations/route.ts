import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET /api/work-comparison/evaluations?employee_id - evaluation history for an employee, newest first
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    if (!employeeId) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })

    const { rows } = await auth.db.query(
        `SELECT we.id, we.period_start, we.period_end, we.total_assigned_points, we.total_earned_points, we.note, we.evaluated_at,
            json_build_object('id', ev.id, 'name', ev.name) AS evaluator
         FROM work_evaluations we LEFT JOIN employees ev ON ev.id = we.evaluated_by
         WHERE we.employee_id = $1
         ORDER BY we.evaluated_at DESC`,
        [employeeId]
    )

    return NextResponse.json(rows)
}

// POST /api/work-comparison/evaluations - save an evaluation, score each work report,
// and award the earned points on top of the employee's existing total (never overwritten).
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const { employee_id, period_start, period_end, total_assigned_points, note, items } = body

    if (!employee_id || !period_start || !period_end) {
        return NextResponse.json({ error: 'employee_id, period_start and period_end are required' }, { status: 400 })
    }
    if (!Array.isArray(items)) {
        return NextResponse.json({ error: 'items must be an array of { work_report_id, points }' }, { status: 400 })
    }

    const cleanItems = items
        .map((it: { work_report_id: string; points: number }) => ({
            work_report_id: it.work_report_id,
            points: Math.max(0, Math.round(Number(it.points) || 0)),
        }))
        .filter(it => it.work_report_id)

    const totalEarnedPoints = cleanItems.reduce((sum, it) => sum + it.points, 0)

    const { rows: [evaluation] } = await db.query(
        `INSERT INTO work_evaluations (employee_id, period_start, period_end, total_assigned_points, total_earned_points, note, evaluated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [employee_id, period_start, period_end, Math.max(0, Math.round(Number(total_assigned_points) || 0)), totalEarnedPoints, note || null, auth.employee.id]
    )

    if (cleanItems.length > 0) {
        await db.query(
            `INSERT INTO work_evaluation_items (evaluation_id, work_report_id, points)
             SELECT $1, * FROM UNNEST($2::uuid[], $3::int[])`,
            [evaluation.id, cleanItems.map(it => it.work_report_id), cleanItems.map(it => it.points)]
        )
    }

    // Additive only — awardPoints increments employees.total_points, it never sets/overwrites it.
    if (totalEarnedPoints > 0) {
        await awardPoints(
            db,
            employee_id,
            totalEarnedPoints,
            'work_evaluation',
            evaluation.id,
            `Work evaluation for ${period_start} to ${period_end}`,
            auth.employee.id
        )
    }

    await logAudit(auth.employee.id, `Evaluated work for ${period_start} to ${period_end} (${totalEarnedPoints} pts)`, 'work_comparison', evaluation.id)

    return NextResponse.json({ id: evaluation.id, total_earned_points: totalEarnedPoints }, { status: 201 })
}
