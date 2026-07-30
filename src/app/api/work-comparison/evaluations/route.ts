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

    const { data, error } = await auth.supabase
        .from('work_evaluations')
        .select(`
            id, period_start, period_end, total_assigned_points, total_earned_points, note, evaluated_at,
            evaluator:employees!evaluated_by(id, name)
        `)
        .eq('employee_id', employeeId)
        .order('evaluated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
}

// POST /api/work-comparison/evaluations - save an evaluation, score each work report,
// and award the earned points on top of the employee's existing total (never overwritten).
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
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

    const { data: evaluation, error: evalErr } = await supabase
        .from('work_evaluations')
        .insert({
            employee_id,
            period_start,
            period_end,
            total_assigned_points: Math.max(0, Math.round(Number(total_assigned_points) || 0)),
            total_earned_points: totalEarnedPoints,
            note: note || null,
            evaluated_by: auth.employee.id,
        })
        .select('id')
        .single()

    if (evalErr) return NextResponse.json({ error: evalErr.message }, { status: 500 })

    if (cleanItems.length > 0) {
        const { error: itemsErr } = await supabase
            .from('work_evaluation_items')
            .insert(cleanItems.map(it => ({ evaluation_id: evaluation.id, work_report_id: it.work_report_id, points: it.points })))
        if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })
    }

    // Additive only — awardPoints increments employees.total_points, it never sets/overwrites it.
    if (totalEarnedPoints > 0) {
        await awardPoints(
            supabase,
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
