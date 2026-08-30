import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PROBLEM_SELECT = `p.*,
    json_build_object('id', pk.id, 'name', pk.name, 'employee_id', pk.employee_id) AS peek,
    json_build_object('id', sv.id, 'name', sv.name, 'employee_id', sv.employee_id) AS solver,
    json_build_object('id', mg.id, 'name', mg.name) AS manager,
    json_build_object('id', au.id, 'name', au.name) AS authority`
const PROBLEM_JOINS = `LEFT JOIN employees pk ON pk.id = p.problem_peek
    LEFT JOIN employees sv ON sv.id = p.problem_solver
    LEFT JOIN employees mg ON mg.id = p.management_check
    LEFT JOIN employees au ON au.id = p.authority_check`

// GET /api/problems (any employee can view)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []
    if (status && status !== 'all') { params.push(status); conditions.push(`p.status = $${params.length}`) }
    if (priority && priority !== 'all') { params.push(priority); conditions.push(`p.priority = $${params.length}`) }
    if (startDate) { params.push(startDate); conditions.push(`p.entry_date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`p.entry_date <= $${params.length}`) }

    const { rows: problems } = await db.query(
        `SELECT ${PROBLEM_SELECT} FROM problems p ${PROBLEM_JOINS}
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY p.created_at DESC`,
        params
    )

    const categoryCounts: Record<string, number> = {}
    problems.forEach(p => {
        const cat = p.category || 'uncategorized'
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    })

    const stats = {
        total: problems.length,
        open: problems.filter(p => p.status === 'open').length,
        inProgress: problems.filter(p => p.status === 'in_progress').length,
        resolved: problems.filter(p => p.status === 'resolved').length,
        escalated: problems.filter(p => p.status === 'escalated').length,
        categories: categoryCounts,
    }

    return NextResponse.json({ problems, stats })
}

// POST /api/problems (any employee)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()

    // Auto-generate problem number
    const { rows: [{ count }] } = await db.query(`SELECT COUNT(*)::int AS count FROM problems`)
    const problemNo = `PRB-${String((count || 0) + 1).padStart(4, '0')}`

    // NOTE: problem_peek (the picker who earns the solve award) is set only when explicitly
    // provided — i.e. when someone actually picks the problem. We deliberately do NOT auto-assign
    // it from matching work_entries: doing so made every new problem look "picked" by whoever
    // took the order, which read as work-log silently syncing into the problem box (V3 #8c glitch).
    const problemPeek = body.problem_peek || null

    const { rows: [data] } = await db.query(
        `INSERT INTO problems (problem_no, entry_date, customer_name, customer_phone, problem_details, problem_peek, priority, status, notes, payment_gateway, business_name, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10, $11) RETURNING *`,
        [
            problemNo, body.entry_date || new Date().toISOString().split('T')[0], body.customer_name, body.customer_phone,
            body.problem_details, problemPeek, body.priority || 'medium', body.notes || null,
            body.payment_gateway || null, body.business_name || null, body.category || null,
        ]
    )

    // Give 5 points for entering the problem
    await awardPoints(db, auth.employee.id, 5, 'problem', data.id, 'Entered problem', auth.employee.id)

    // Log creation
    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, new_value, details)
         VALUES ($1, 'problems', 'created', $2, $3, $4)`,
        [auth.employee.id, data.id, problemNo, JSON.stringify({ actor_name: auth.employee.name })]
    )

    return NextResponse.json({ ...data, awardedPoints: 5 }, { status: 201 })
}

// PUT /api/problems - update (any employee can update, points logic preserved)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id, status_note, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing problem id' }, { status: 400 })

    // Members may pick/unpick, change status/priority and add notes (the problem box is
    // collaborative). They may NOT assign the problem_solver, which is who receives the
    // 10-point solve award — only an admin assigns it (prevents points farming).
    const isAdmin = auth.employee.roleLevel <= 3
    if (!isAdmin && 'problem_solver' in updates) {
        return NextResponse.json({ error: 'Only an admin can assign the problem solver' }, { status: 403 })
    }

    // Get old state for logging
    const { rows: [oldProblem] } = await db.query(
        `SELECT status, priority, problem_peek, problem_solver FROM problems WHERE id = $1`,
        [id]
    )

    if (updates.status === 'resolved' && !updates.solved_date) {
        updates.solved_date = new Date().toISOString().split('T')[0]
    }

    const keys = Object.keys(updates)
    if (keys.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `WITH upd AS (
            UPDATE problems SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *
         )
         SELECT ${PROBLEM_SELECT} FROM upd p ${PROBLEM_JOINS}`,
        [id, ...keys.map(k => updates[k])]
    )

    if (!data) return NextResponse.json({ error: 'Problem not found' }, { status: 404 })

    // Log changes and handle points
    if (updates.status && oldProblem && updates.status !== oldProblem.status) {
        await db.query(
            `INSERT INTO audit_log (actor_id, module, action, target_id, old_value, new_value, details)
             VALUES ($1, 'problems', 'status_change', $2, $3, $4, $5)`,
            [auth.employee.id, id, oldProblem.status, updates.status, JSON.stringify({ actor_name: auth.employee.name, status_note: status_note || null })]
        )
    }

    if (updates.priority && oldProblem && updates.priority !== oldProblem.priority) {
        await db.query(
            `INSERT INTO audit_log (actor_id, module, action, target_id, old_value, new_value, details)
             VALUES ($1, 'problems', 'priority_change', $2, $3, $4, $5)`,
            [auth.employee.id, id, oldProblem.priority, updates.priority, JSON.stringify({ actor_name: auth.employee.name })]
        )
    }

    // Handle pick
    if (updates.problem_peek && (!oldProblem?.problem_peek || updates.problem_peek !== oldProblem.problem_peek)) {
        await db.query(
            `INSERT INTO audit_log (actor_id, module, action, target_id, new_value, details)
             VALUES ($1, 'problems', 'pick', $2, $3, $4)`,
            [auth.employee.id, id, updates.problem_peek, JSON.stringify({ actor_name: auth.employee.name })]
        )
    }

    // Handle unpick
    if (updates.problem_peek === null && oldProblem?.problem_peek) {
        await db.query(
            `INSERT INTO audit_log (actor_id, module, action, target_id, old_value, details)
             VALUES ($1, 'problems', 'unpick', $2, $3, $4)`,
            [auth.employee.id, id, oldProblem.problem_peek, JSON.stringify({ actor_name: auth.employee.name })]
        )
    }

    // Handle solve - award 10 points to solver
    let awardedPoints = 0
    if (updates.status === 'resolved' && oldProblem?.status !== 'resolved') {
        const solverId = updates.problem_solver || data.problem_solver
        if (solverId) {
            await awardPoints(db, solverId, 10, 'problem', id, 'Solved problem', auth.employee.id)
            awardedPoints = 10
            await db.query(
                `INSERT INTO audit_log (actor_id, module, action, target_id, new_value, details)
                 VALUES ($1, 'problems', 'solve', $2, $3, $4)`,
                [auth.employee.id, id, solverId, JSON.stringify({ actor_name: auth.employee.name, points: 10 })]
            )
        }
    }

    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/problems (admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await auth.db.query(`DELETE FROM problems WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
