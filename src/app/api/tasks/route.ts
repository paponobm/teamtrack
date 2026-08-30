import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/tasks - list tasks with assignments
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const db = auth.db
    const emp = auth.employee
    const roleLevel = auth.employee.roleLevel

    const { searchParams } = new URL(request.url)
    const countOnly = searchParams.get('count_only') === 'true'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (countOnly && emp) {
        const { rows: [{ count }] } = await db.query(
            `SELECT COUNT(*)::int AS count FROM task_assignments WHERE employee_id = $1 AND status = 'pending'`,
            [emp.id]
        )
        return NextResponse.json({ count: count || 0 })
    }

    const conditions: string[] = []
    const params: unknown[] = []

    if (startDate) {
        params.push(`${startDate}T00:00:00`)
        conditions.push(`t.created_at >= $${params.length}`)
    }
    if (endDate) {
        params.push(`${endDate}T23:59:59`)
        conditions.push(`t.created_at <= $${params.length}`)
    }

    if (roleLevel && roleLevel > 3 && emp) {
        const { rows: assignments } = await db.query(`SELECT task_id FROM task_assignments WHERE employee_id = $1`, [emp.id])
        const taskIds = assignments.map(a => a.task_id)

        params.push(emp.id)
        const empParamIdx = params.length
        if (taskIds.length > 0) {
            params.push(taskIds)
            conditions.push(`(t.created_by = $${empParamIdx} OR t.id = ANY($${params.length}))`)
        } else {
            conditions.push(`t.created_by = $${empParamIdx}`)
        }
    }

    const { rows: tasks } = await db.query(
        `SELECT t.*,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'employee_id', c.employee_id) ELSE NULL END AS creator
         FROM tasks t
         LEFT JOIN employees c ON c.id = t.created_by
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY t.created_at DESC`,
        params
    )

    const taskIds = tasks.map(t => t.id)
    let assignmentsByTask: Record<string, unknown[]> = {}
    if (taskIds.length > 0) {
        const { rows: assignmentRows } = await db.query(
            `SELECT ta.id, ta.task_id, ta.status, ta.assigned_at, ta.responded_at,
                json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url) AS employee
             FROM task_assignments ta
             LEFT JOIN employees e ON e.id = ta.employee_id
             WHERE ta.task_id = ANY($1)`,
            [taskIds]
        )
        assignmentsByTask = assignmentRows.reduce((acc: Record<string, unknown[]>, row) => {
            const { task_id, ...rest } = row
            acc[task_id] = acc[task_id] || []
            acc[task_id].push(rest)
            return acc
        }, {})
    }

    const enriched = tasks.map(t => ({ ...t, task_assignments: assignmentsByTask[t.id] || [] }))

    return NextResponse.json(enriched)
}

// POST /api/tasks - create a task with assignments
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const db = auth.db
    const emp = auth.employee

    const body = await request.json()
    const { title, description, due_date, priority, assignee_ids } = body

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    // Auto-generate task number (TSK-XXXX)
    const { rows: [{ count }] } = await db.query(`SELECT COUNT(*)::int AS count FROM tasks`)
    const taskNo = `TSK-${String((count || 0) + 1).padStart(4, '0')}`

    const { rows: [task] } = await db.query(
        `INSERT INTO tasks (title, description, due_date, priority, created_by, task_no)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [title, description || null, due_date || null, priority || 'medium', emp!.id, taskNo]
    )

    // Create assignments and notifications
    if (assignee_ids && assignee_ids.length > 0) {
        await db.query(
            `INSERT INTO task_assignments (task_id, employee_id) SELECT $1, * FROM UNNEST($2::uuid[])`,
            [task.id, assignee_ids]
        )

        await db.query(
            `INSERT INTO notifications (recipient_id, title, message, type, related_entity_type, related_entity_id, is_read)
             SELECT eid, 'New Task Assigned 📋', $2, 'task_assignment', 'tasks', $3, false
             FROM UNNEST($1::uuid[]) AS eid`,
            [assignee_ids, `You have been assigned a new task: ${title}`, task.id]
        )
    }

    // Log task creation
    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, new_value, details)
         VALUES ($1, 'tasks', 'task_created', $2, $3, $4)`,
        [emp!.id, task.id, title, JSON.stringify({ actor_name: emp!.name })]
    )

    return NextResponse.json(task, { status: 201 })
}

// PUT /api/tasks - update a task
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const db = auth.db
    const body = await request.json()
    const { id, assignee_ids, ...updates } = body

    if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

    // If this is an assignment response (accept/reject)
    if (updates.assignment_response) {
        const emp = auth.employee

        await db.query(
            `UPDATE task_assignments SET status = $1, responded_at = NOW() WHERE task_id = $2 AND employee_id = $3`,
            [updates.assignment_response, id, emp.id]
        )

        if (updates.assignment_response === 'accepted' || updates.assignment_response === 'rejected') {
            await db.query(
                `INSERT INTO audit_log (actor_id, module, action, target_id, details)
                 VALUES ($1, 'tasks', $2, $3, $4)`,
                [emp.id, `task_${updates.assignment_response}`, id, JSON.stringify({ actor_name: emp.name })]
            )
        }

        return NextResponse.json({ message: 'Response recorded' })
    }

    // Normal update
    const actor = auth.employee
    const isAdmin = actor.roleLevel <= 3

    // Non-admins may ONLY mark a task they have accepted as completed — nothing else.
    if (!isAdmin) {
        const onlyCompleting = Object.keys(updates).length === 1 && updates.status === 'completed'
        if (!onlyCompleting) {
            return NextResponse.json({ error: 'You can only complete a task assigned to you' }, { status: 403 })
        }
        const { rows: [myAssignment] } = await db.query(
            `SELECT status FROM task_assignments WHERE task_id = $1 AND employee_id = $2`,
            [id, actor.id]
        )
        if (!myAssignment || myAssignment.status !== 'accepted') {
            return NextResponse.json({ error: 'You can only complete a task you have accepted' }, { status: 403 })
        }
    }

    const { rows: [oldTask] } = await db.query(`SELECT status FROM tasks WHERE id = $1`, [id])

    const updateKeys = Object.keys(updates)
    const setClauses = updateKeys.map((k, i) => `"${k}" = $${i + 2}`)
    setClauses.push(`updated_at = NOW()`)
    const { rows: [data] } = await db.query(
        `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...updateKeys.map(k => updates[k])]
    )

    if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    // Re-sync assignees (admin edit only) — add newly checked members, remove unchecked ones.
    if (isAdmin && Array.isArray(assignee_ids)) {
        const { rows: existingAssignments } = await db.query(`SELECT employee_id FROM task_assignments WHERE task_id = $1`, [id])
        const existingIds = new Set(existingAssignments.map(a => a.employee_id))
        const newIds = new Set(assignee_ids as string[])

        const toAdd = [...newIds].filter(eid => !existingIds.has(eid))
        const toRemove = [...existingIds].filter(eid => !newIds.has(eid))

        if (toRemove.length > 0) {
            await db.query(`DELETE FROM task_assignments WHERE task_id = $1 AND employee_id = ANY($2)`, [id, toRemove])
        }
        if (toAdd.length > 0) {
            await db.query(
                `INSERT INTO task_assignments (task_id, employee_id) SELECT $1, * FROM UNNEST($2::uuid[])`,
                [id, toAdd]
            )
            await db.query(
                `INSERT INTO notifications (recipient_id, title, message, type, related_entity_type, related_entity_id, is_read)
                 SELECT eid, 'New Task Assigned 📋', $2, 'task_assignment', 'tasks', $3, false
                 FROM UNNEST($1::uuid[]) AS eid`,
                [toAdd, `You have been assigned a task: ${data.title}`, id]
            )
        }
    }

    // Log status change
    if (updates.status && oldTask && updates.status !== oldTask.status && actor) {
        await db.query(
            `INSERT INTO audit_log (actor_id, module, action, target_id, old_value, new_value, details)
             VALUES ($1, 'tasks', 'status_change', $2, $3, $4, $5)`,
            [actor.id, id, oldTask.status, updates.status, JSON.stringify({ actor_name: actor.name })]
        )
    }

    let awardedPoints = 0
    // Award 10 points to all accepted assignees when task is completed
    if (updates.status === 'completed' && oldTask?.status !== 'completed') {
        const { rows: assignments } = await db.query(
            `SELECT employee_id FROM task_assignments WHERE task_id = $1 AND status = 'accepted'`,
            [id]
        )

        for (const a of assignments) {
            await awardPoints(db, a.employee_id, 10, 'task', id, 'Task completed', null)

            const { rows: [empName] } = await db.query(`SELECT name FROM employees WHERE id = $1`, [a.employee_id])
            await db.query(
                `INSERT INTO audit_log (actor_id, module, action, target_id, details)
                 VALUES ($1, 'tasks', 'task_completed', $2, $3)`,
                [a.employee_id, id, JSON.stringify({ actor_name: empName?.name || 'Unknown', points: 10 })]
            )
            // Only return awardedPoints if the current user is an assignee
            if (a.employee_id === auth.employee.id) {
                awardedPoints = 10
            }
        }
    }

    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/tasks - delete a task (super admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

    await db.query(`DELETE FROM task_assignments WHERE task_id = $1`, [id])
    await db.query(`DELETE FROM tasks WHERE id = $1`, [id])

    return NextResponse.json({ message: 'Task deleted' })
}
