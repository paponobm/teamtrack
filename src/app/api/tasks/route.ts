import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/tasks - list tasks with assignments
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const emp = auth.employee
    const roleLevel = auth.employee.roleLevel

    const { searchParams } = new URL(request.url)
    const countOnly = searchParams.get('count_only') === 'true'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (countOnly && emp) {
        const { count, error: countErr } = await supabase
            .from('task_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('employee_id', emp.id)
            .eq('status', 'pending')
        
        if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })
        return NextResponse.json({ count: count || 0 })
    }

    let query = supabase
        .from('tasks')
        .select(`
            *,
            creator:employees!created_by(id, name, employee_id),
            task_assignments(
                id,
                status,
                assigned_at,
                responded_at,
                employee:employees!employee_id(id, name, employee_id, avatar_url)
            )
        `)
        .order('created_at', { ascending: false })

    if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`)
    }

    if (roleLevel && roleLevel > 3 && emp) {
        const { data: assignments } = await supabase.from('task_assignments').select('task_id').eq('employee_id', emp.id)
        const taskIds = (assignments || []).map(a => a.task_id)
        
        if (taskIds.length > 0) {
            query = query.or(`created_by.eq.${emp.id},id.in.(${taskIds.join(',')})`)
        } else {
            query = query.eq('created_by', emp.id)
        }
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}

// POST /api/tasks - create a task with assignments
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const emp = auth.employee

    const body = await request.json()
    const { title, description, due_date, priority, assignee_ids } = body

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    // Auto-generate task number (TSK-XXXX)
    const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true })
    const taskNo = `TSK-${String((count || 0) + 1).padStart(4, '0')}`

    let taskResult = await supabase
        .from('tasks')
        .insert({
            title,
            description: description || null,
            due_date: due_date || null,
            priority: priority || 'medium',
            created_by: emp!.id,
            task_no: taskNo,
        })
        .select()
        .single()

    // Resilient fallback: if column task_no doesn't exist, retry without it
    if (taskResult.error && (taskResult.error.message.includes('task_no') || taskResult.error.message.includes('column'))) {
        taskResult = await supabase
            .from('tasks')
            .insert({
                title,
                description: description || null,
                due_date: due_date || null,
                priority: priority || 'medium',
                created_by: emp!.id,
            })
            .select()
            .single()
    }

    if (taskResult.error) return NextResponse.json({ error: taskResult.error.message }, { status: 500 })
    const task = taskResult.data

    // Create assignments and notifications
    if (assignee_ids && assignee_ids.length > 0) {
        const assignments = assignee_ids.map((eid: string) => ({
            task_id: task.id,
            employee_id: eid,
        }))
        await supabase.from('task_assignments').insert(assignments)

        const notifications = assignee_ids.map((eid: string) => ({
            recipient_id: eid,
            title: 'New Task Assigned 📋',
            message: `You have been assigned a new task: ${title}`,
            type: 'task_assignment',
            related_entity_type: 'tasks',
            related_entity_id: task.id,
            is_read: false
        }))
        await supabase.from('notifications').insert(notifications)
    }

    // Log task creation
    const { data: creator } = await supabase.from('employees').select('id, name').eq('id', emp!.id).single()
    await supabase.from('audit_log').insert({
        actor_id: emp!.id,
        module: 'tasks',
        action: 'task_created',
        target_id: task.id,
        new_value: title,
        details: { actor_name: creator?.name || 'Unknown' },
    }).then(() => { })

    return NextResponse.json(task, { status: 201 })
}

// PUT /api/tasks - update a task
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { id, assignee_ids, ...updates } = body

    if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

    // If this is an assignment response (accept/reject)
    if (updates.assignment_response) {
        const emp = auth.employee

        const { error } = await supabase
            .from('task_assignments')
            .update({
                status: updates.assignment_response,
                responded_at: new Date().toISOString(),
            })
            .eq('task_id', id)
            .eq('employee_id', emp.id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Log acceptance (no points)
        if (updates.assignment_response === 'accepted') {
            await supabase.from('audit_log').insert({
                actor_id: emp.id,
                module: 'tasks',
                action: 'task_accepted',
                target_id: id,
                details: { actor_name: emp.name },
            }).then(() => { })
        }

        // Log rejection
        if (updates.assignment_response === 'rejected') {
            await supabase.from('audit_log').insert({
                actor_id: emp.id,
                module: 'tasks',
                action: 'task_rejected',
                target_id: id,
                details: { actor_name: emp.name },
            }).then(() => { })
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
        const { data: myAssignment } = await supabase
            .from('task_assignments')
            .select('status')
            .eq('task_id', id)
            .eq('employee_id', actor.id)
            .maybeSingle()
        if (!myAssignment || myAssignment.status !== 'accepted') {
            return NextResponse.json({ error: 'You can only complete a task you have accepted' }, { status: 403 })
        }
    }

    const { data: oldTask } = await supabase.from('tasks').select('status').eq('id', id).single()

    const { data, error } = await supabase
        .from('tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Re-sync assignees (admin edit only) — add newly checked members, remove unchecked ones.
    if (isAdmin && Array.isArray(assignee_ids)) {
        const { data: existingAssignments } = await supabase.from('task_assignments').select('employee_id').eq('task_id', id)
        const existingIds = new Set((existingAssignments || []).map(a => a.employee_id))
        const newIds = new Set(assignee_ids as string[])

        const toAdd = [...newIds].filter(eid => !existingIds.has(eid))
        const toRemove = [...existingIds].filter(eid => !newIds.has(eid))

        if (toRemove.length > 0) {
            await supabase.from('task_assignments').delete().eq('task_id', id).in('employee_id', toRemove)
        }
        if (toAdd.length > 0) {
            await supabase.from('task_assignments').insert(toAdd.map(eid => ({ task_id: id, employee_id: eid })))
            await supabase.from('notifications').insert(toAdd.map(eid => ({
                recipient_id: eid,
                title: 'New Task Assigned 📋',
                message: `You have been assigned a task: ${data.title}`,
                type: 'task_assignment',
                related_entity_type: 'tasks',
                related_entity_id: id,
                is_read: false,
            })))
        }
    }

    // Log status change
    if (updates.status && oldTask && updates.status !== oldTask.status && actor) {
        await supabase.from('audit_log').insert({
            actor_id: actor.id,
            module: 'tasks',
            action: 'status_change',
            target_id: id,
            old_value: oldTask.status,
            new_value: updates.status,
            details: { actor_name: actor.name },
        }).then(() => { })
    }

    let awardedPoints = 0
    // Award 10 points to all accepted assignees when task is completed
    if (updates.status === 'completed' && oldTask?.status !== 'completed') {
        const { data: assignments } = await supabase
            .from('task_assignments')
            .select('employee_id')
            .eq('task_id', id)
            .eq('status', 'accepted')

        if (assignments) {
            for (const a of assignments) {
                const { error: rpcErr } = await supabase.rpc('increment_points', { emp_id: a.employee_id, pts: 10 })
                if (rpcErr) {
                    const { data: empData } = await supabase.from('employees').select('total_points').eq('id', a.employee_id).single()
                    if (empData) {
                        await supabase.from('employees').update({ total_points: (empData.total_points || 0) + 10 }).eq('id', a.employee_id)
                    }
                }
                // Log to point_transactions
                await supabase.from('point_transactions').insert({
                    employee_id: a.employee_id, points: 10, source: 'task', source_id: id,
                    description: 'Task completed', awarded_by: null,
                })
                const { data: empName } = await supabase.from('employees').select('name').eq('id', a.employee_id).single()
                await supabase.from('audit_log').insert({
                    actor_id: a.employee_id,
                    module: 'tasks',
                    action: 'task_completed',
                    target_id: id,
                    details: { actor_name: empName?.name || 'Unknown', points: 10 },
                }).then(() => { })
                // Only return awardedPoints if the current user is an assignee
                if (a.employee_id === auth.employee.id) {
                    awardedPoints = 10
                }
            }
        }
    }

    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/tasks - delete a task (super admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

    await supabase.from('task_assignments').delete().eq('task_id', id)
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ message: 'Task deleted' })
}
