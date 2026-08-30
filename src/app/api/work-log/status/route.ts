import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
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

// PUT /api/work-log/status - change delivery status and log it (+auto-points on delivered)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { entry_id, delivery_status } = body

    if (!entry_id || !delivery_status) {
        return NextResponse.json({ error: 'entry_id and delivery_status required' }, { status: 400 })
    }

    const actorId: string = auth.employee.id
    const actorName: string = auth.employee.name

    // Get old entry (status + order_type + employee_id)
    const { rows: [oldEntry] } = await db.query(
        `SELECT delivery_status, order_type, employee_id FROM work_entries WHERE id = $1`,
        [entry_id]
    )

    if (!oldEntry) {
        return NextResponse.json({ error: 'Work entry not found' }, { status: 404 })
    }

    // Members may only change the status of their own entries; admins (<=3) may change any.
    if (auth.employee.roleLevel > 3 && oldEntry.employee_id !== auth.employee.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const oldStatus = oldEntry?.delivery_status || 'unknown'

    // Update status
    const { rows: [data] } = await db.query(
        `UPDATE work_entries SET delivery_status = $1 WHERE id = $2 RETURNING *`,
        [delivery_status, entry_id]
    )

    // Log the change
    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, old_value, new_value, details)
         VALUES ($1, 'work_log', 'status_change', $2, $3, $4, $5)`,
        [actorId, entry_id, oldStatus, delivery_status, JSON.stringify({ actor_name: actorName })]
    )

    // Award auto-points when delivered
    if (delivery_status === 'delivered' && oldStatus !== 'delivered' && oldEntry?.employee_id) {
        const orderType = oldEntry.order_type || 'normal'
        const points = ORDER_POINTS[orderType] || 5
        await awardPoints(
            db,
            oldEntry.employee_id,
            points,
            'order',
            entry_id,
            `Order delivered (${orderType}) - ${points} pts`,
            null
        )
    }

    return NextResponse.json(data)
}
