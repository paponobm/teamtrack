import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Points map for order types
const ORDER_POINTS: Record<string, number> = {
    normal: 5,
    suggested: 10,
    '2000_plus': 20,
    '3000_plus': 50,
    '5000_plus': 100,
    upsell: 20,
    incomplete: 10,
    retargeting: 15,
}

// Helper: award points and log transaction
async function awardPoints(
    supabase: ReturnType<typeof createAdminClient>,
    employeeId: string, points: number, source: string,
    sourceId: string | null, description: string
) {
    await supabase.from('point_transactions').insert({
        employee_id: employeeId, points, source, source_id: sourceId,
        description, awarded_by: null,
    })
    const { data: emp } = await supabase.from('employees').select('total_points').eq('id', employeeId).single()
    if (emp) {
        await supabase.from('employees').update({ total_points: (emp.total_points || 0) + points }).eq('id', employeeId)
    }
}

// PUT /api/work-log/status - change delivery status and log it (+auto-points on delivered)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { entry_id, delivery_status } = body

    if (!entry_id || !delivery_status) {
        return NextResponse.json({ error: 'entry_id and delivery_status required' }, { status: 400 })
    }

    const actorId: string = auth.employee.id
    const actorName: string = auth.employee.name

    // Get old entry (status + order_type + employee_id)
    const { data: oldEntry } = await supabase
        .from('work_entries')
        .select('delivery_status, order_type, employee_id')
        .eq('id', entry_id)
        .single()

    if (!oldEntry) {
        return NextResponse.json({ error: 'Work entry not found' }, { status: 404 })
    }

    // Members may only change the status of their own entries; admins (<=3) may change any.
    if (auth.employee.roleLevel > 3 && oldEntry.employee_id !== auth.employee.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const oldStatus = oldEntry?.delivery_status || 'unknown'

    // Update status
    const { data, error } = await supabase
        .from('work_entries')
        .update({ delivery_status })
        .eq('id', entry_id)
        .select('*')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the change
    if (actorId) {
        await supabase.from('audit_log').insert({
            actor_id: actorId,
            module: 'work_log',
            action: 'status_change',
            target_id: entry_id,
            old_value: oldStatus,
            new_value: delivery_status,
            details: { actor_name: actorName },
        }).then(() => { })
    }

    // Award auto-points when delivered
    if (delivery_status === 'delivered' && oldStatus !== 'delivered' && oldEntry?.employee_id) {
        const orderType = oldEntry.order_type || 'normal'
        const points = ORDER_POINTS[orderType] || 5
        await awardPoints(
            supabase,
            oldEntry.employee_id,
            points,
            'order',
            entry_id,
            `Order delivered (${orderType}) - ${points} pts`
        )
    }

    return NextResponse.json(data)
}
