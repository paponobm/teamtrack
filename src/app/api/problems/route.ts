import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Helper: get current employee from auth context
async function getCurrentEmployee(supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>, userId: string) {
    const { data } = await supabase.from('employees').select('id, name, role:roles(level)').eq('user_id', userId).single()
    return data
}

// GET /api/problems (any employee can view)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
        .from('problems')
        .select(`
            *,
            peek:employees!problem_peek(id, name, employee_id),
            solver:employees!problem_solver(id, name, employee_id),
            manager:employees!management_check(id, name),
            authority:employees!authority_check(id, name)
        `)
        .order('created_at', { ascending: false })

    if (status && status !== 'all') query = query.eq('status', status)
    if (priority && priority !== 'all') query = query.eq('priority', priority)
    if (startDate) query = query.gte('entry_date', startDate)
    if (endDate) query = query.lte('entry_date', endDate)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const problems = data || []
    const categoryCounts: Record<string, number> = {}
    problems.forEach(p => {
        const cat = (p as Record<string, unknown>).category as string || 'uncategorized'
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

    const supabase = auth.supabase
    const body = await request.json()

    // Auto-generate problem number
    const { count } = await supabase.from('problems').select('*', { count: 'exact', head: true })
    const problemNo = `PRB-${String((count || 0) + 1).padStart(4, '0')}`

    // NOTE: problem_peek (the picker who earns the solve award) is set only when explicitly
    // provided — i.e. when someone actually picks the problem. We deliberately do NOT auto-assign
    // it from matching work_entries: doing so made every new problem look "picked" by whoever
    // took the order, which read as work-log silently syncing into the problem box (V3 #8c glitch).
    const problemPeek = body.problem_peek || null

    const { data, error } = await supabase
        .from('problems')
        .insert({
            problem_no: problemNo,
            entry_date: body.entry_date || new Date().toISOString().split('T')[0],
            customer_name: body.customer_name,
            customer_phone: body.customer_phone,
            problem_details: body.problem_details,
            problem_peek: problemPeek,
            priority: body.priority || 'medium',
            status: 'open',
            notes: body.notes || null,
            payment_gateway: body.payment_gateway || null,
            business_name: body.business_name || null,
            category: body.category || null,
        })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Give 5 points for entering the problem
    await awardPoints(supabase, auth.employee.id, 5, 'problem', data.id, 'Entered problem', auth.employee.id)

    // Log creation
    await supabase.from('audit_log').insert({
        actor_id: auth.employee.id,
        module: 'problems',
        action: 'created',
        target_id: data.id,
        new_value: problemNo,
        details: { actor_name: auth.employee.name },
    }).then(() => { })

    return NextResponse.json({ ...data, awardedPoints: 5 }, { status: 201 })
}

// PUT /api/problems - update (any employee can update, points logic preserved)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
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
    const { data: oldProblem } = await supabase
        .from('problems')
        .select('status, priority, problem_peek, problem_solver')
        .eq('id', id)
        .single()

    if (updates.status === 'resolved' && !updates.solved_date) {
        updates.solved_date = new Date().toISOString().split('T')[0]
    }

    const { data, error } = await supabase
        .from('problems')
        .update(updates)
        .eq('id', id)
        // Re-join the related employees so the response carries solver/peek names
        // (otherwise the resolver's name is blank until a full refetch).
        .select(`
            *,
            peek:employees!problem_peek(id, name, employee_id),
            solver:employees!problem_solver(id, name, employee_id),
            manager:employees!management_check(id, name),
            authority:employees!authority_check(id, name)
        `)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log changes and handle points
    if (updates.status && oldProblem && updates.status !== oldProblem.status) {
        await supabase.from('audit_log').insert({
            actor_id: auth.employee.id, module: 'problems', action: 'status_change', target_id: id,
            old_value: oldProblem.status, new_value: updates.status,
            details: { actor_name: auth.employee.name, status_note: status_note || null },
        }).then(() => { })
    }

    if (updates.priority && oldProblem && updates.priority !== oldProblem.priority) {
        await supabase.from('audit_log').insert({
            actor_id: auth.employee.id, module: 'problems', action: 'priority_change', target_id: id,
            old_value: oldProblem.priority, new_value: updates.priority,
            details: { actor_name: auth.employee.name },
        }).then(() => { })
    }

    // Handle pick
    if (updates.problem_peek && (!oldProblem?.problem_peek || updates.problem_peek !== oldProblem.problem_peek)) {
        await supabase.from('audit_log').insert({
            actor_id: auth.employee.id, module: 'problems', action: 'pick', target_id: id,
            new_value: updates.problem_peek, details: { actor_name: auth.employee.name },
        }).then(() => { })
    }

    // Handle unpick
    if (updates.problem_peek === null && oldProblem?.problem_peek) {
        await supabase.from('audit_log').insert({
            actor_id: auth.employee.id, module: 'problems', action: 'unpick', target_id: id,
            old_value: oldProblem.problem_peek, details: { actor_name: auth.employee.name },
        }).then(() => { })
    }

    // Handle solve - award 10 points to solver
    let awardedPoints = 0
    if (updates.status === 'resolved' && oldProblem?.status !== 'resolved') {
        const solverId = updates.problem_solver || data.problem_solver
        if (solverId) {
            await awardPoints(supabase, solverId, 10, 'problem', id, 'Solved problem', auth.employee.id)
            awardedPoints = 10
            await supabase.from('audit_log').insert({
                actor_id: auth.employee.id, module: 'problems', action: 'solve', target_id: id,
                new_value: solverId, details: { actor_name: auth.employee.name, points: 10 },
            }).then(() => { })
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

    const { error } = await auth.supabase.from('problems').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
