import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET /api/work-log - list work entries by date range and optional filters
export async function GET(request: Request) {
    const auth = await requireAuth(0) // any employee
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3

    const date = searchParams.get('date')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const employeeId = searchParams.get('employee_id')
    const orderType = searchParams.get('order_type')
    const source = searchParams.get('source')
    const deliveryStatus = searchParams.get('delivery_status')
    const advanceStatus = searchParams.get('advance_status')

    const conditions: string[] = []
    const params: unknown[] = []

    // Date filtering: support single date or range
    if (startDate && endDate) {
        params.push(startDate); conditions.push(`w.date >= $${params.length}`)
        params.push(endDate); conditions.push(`w.date <= $${params.length}`)
    } else {
        const singleDate = date || new Date().toISOString().split('T')[0]
        params.push(singleDate); conditions.push(`w.date = $${params.length}`)
    }

    // Members can only see their own entries
    if (!isAdmin) {
        params.push(auth.employee.id); conditions.push(`w.employee_id = $${params.length}`)
    } else if (employeeId) {
        params.push(employeeId); conditions.push(`w.employee_id = $${params.length}`)
    }

    if (orderType && orderType !== 'all') { params.push(orderType); conditions.push(`$${params.length} = ANY(w.order_type)`) }
    if (source && source !== 'all') { params.push(source); conditions.push(`w.source = $${params.length}`) }
    if (deliveryStatus && deliveryStatus !== 'all') { params.push(deliveryStatus); conditions.push(`w.delivery_status = $${params.length}`) }
    if (advanceStatus === 'with_advance') {
        conditions.push(`w.advance > 0`)
    } else if (advanceStatus === 'verified') {
        conditions.push(`w.advance > 0 AND w.advance_verified = true`)
    } else if (advanceStatus === 'pending_verification') {
        conditions.push(`w.advance > 0 AND w.advance_verified = false`)
    } else if (advanceStatus === 'no_advance') {
        conditions.push(`(w.advance IS NULL OR w.advance = 0)`)
    }

    const { rows: entries } = await db.query(
        `SELECT w.*,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id) AS employee,
            json_build_object('id', mc.id, 'name', mc.name) AS manager_checked,
            json_build_object('id', ac.id, 'name', ac.name) AS authority_checked,
            json_build_object('id', vf.id, 'name', vf.name) AS verifier
         FROM work_entries w
         LEFT JOIN employees e ON e.id = w.employee_id
         LEFT JOIN employees mc ON mc.id = w.management_check
         LEFT JOIN employees ac ON ac.id = w.authority_check
         LEFT JOIN employees vf ON vf.id = w.verified_by
         WHERE ${conditions.join(' AND ')}
         ORDER BY w.created_at DESC`,
        params
    )

    // Compute summary stats
    const totalOrders = entries.length
    // Total = base amount + suggested (the actual order total, not just the base).
    const totalAmount = entries.reduce((s, e) => s + (Number(e.amount) || 0) + (Number(e.suggested_amount) || 0), 0)
    const totalAdvance = entries.reduce((s, e) => s + (Number(e.advance) || 0), 0)
    const advanceOrders = entries.filter(e => Number(e.advance) > 0)
    const verifiedAdvanceOrders = advanceOrders.filter(e => e.advance_verified)
    const verifiedAdvanceAmount = verifiedAdvanceOrders.reduce((s, e) => s + (Number(e.advance) || 0), 0)
    const verifiedAdvanceCount = verifiedAdvanceOrders.length
    const pendingAdvanceOrders = advanceOrders.filter(e => !e.advance_verified)
    const pendingAdvanceAmount = pendingAdvanceOrders.reduce((s, e) => s + (Number(e.advance) || 0), 0)
    const pendingAdvanceCount = pendingAdvanceOrders.length
    const advanceOrderCount = advanceOrders.length
    // Only verified advance payments count toward the gateway breakdown — matches
    // verifiedAdvanceAmount's own filter so the two stay consistent with each other.
    const paymentGatewaySummary = verifiedAdvanceOrders.reduce((acc: Record<string, number>, e) => {
        const gw = e.payment_gateway || 'Other'
        acc[gw] = (acc[gw] || 0) + (Number(e.advance) || 0)
        return acc
    }, {})
    const sources = entries.reduce((acc: Record<string, number>, e) => {
        const src = e.source || 'other'
        acc[src] = (acc[src] || 0) + 1
        return acc
    }, {})
    // An order tagged with multiple types (e.g. both Suggested and 2000+) counts toward each
    // type's bucket here, since it genuinely belongs to both.
    const orderTypes = entries.reduce((acc: Record<string, number>, e) => {
        const types: string[] = (e.order_type && e.order_type.length > 0) ? e.order_type : ['normal']
        for (const ot of types) acc[ot] = (acc[ot] || 0) + 1
        return acc
    }, {})
    const statusBreakdown = entries.reduce((acc: Record<string, number>, e) => {
        const st = e.delivery_status || 'pending'
        acc[st] = (acc[st] || 0) + 1
        return acc
    }, {})

    return NextResponse.json({
        entries,
        stats: {
            totalOrders, totalAmount, totalAdvance, sources, orderTypes, statusBreakdown,
            verifiedAdvanceAmount, verifiedAdvanceCount, pendingAdvanceAmount, pendingAdvanceCount, advanceOrderCount,
            paymentGatewaySummary,
        },
    })
}

// POST /api/work-log - create new work entry
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const isAdmin = auth.employee.roleLevel <= 3

    const {
        employee_id, date, customer_phone, customer_name, invoice_no, courier_id,
        source, amount, suggested_amount, advance, note,
        order_type, delivery_status, payment_gateway, business_name, transaction_id
    } = body

    // Members can only create entries for themselves
    const targetEmployeeId = isAdmin ? (employee_id || auth.employee.id) : auth.employee.id

    // Check if the customer phone is flagged as fraud in courier_issues
    const trimmedContact = customer_phone ? String(customer_phone).trim() : null
    if (trimmedContact) {
        const { rows: fraudContacts } = await db.query(
            `SELECT id, contact_number FROM courier_issues WHERE fraud_note = true AND contact_number IS NOT NULL`
        )

        const isFraudContact = fraudContacts.some(r => String(r.contact_number || '').trim() === trimmedContact)
        if (isFraudContact) {
            return NextResponse.json({ error: 'This customer contact is flagged as fraud in Courier Issues and cannot be used for new orders.' }, { status: 409 })
        }
    }

    // Auto-generate SL number
    const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*)::int AS count FROM work_entries WHERE employee_id = $1 AND date = $2`,
        [targetEmployeeId, date]
    )

    const sl = (count || 0) + 1

    // order_type is now multi-select (an order can be both e.g. "Suggested" and "2000+" at
    // once) — accept either an array from the current UI or a bare string for safety.
    const orderTypes: string[] = Array.isArray(order_type) ? order_type : (order_type ? [order_type] : [])
    const orderTypesToStore = orderTypes.length > 0 ? orderTypes : ['normal']

    const { rows: [data] } = await db.query(
        `WITH ins AS (
            INSERT INTO work_entries (
                employee_id, date, sl, customer_phone, customer_name, invoice_no, courier_id,
                source, amount, suggested_amount, advance, note, order_type, delivery_status,
                payment_gateway, business_name, transaction_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            RETURNING *
         )
         SELECT w.*, json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id) AS employee
         FROM ins w LEFT JOIN employees e ON e.id = w.employee_id`,
        [
            targetEmployeeId, date, sl, customer_phone, customer_name || null, invoice_no, courier_id,
            source || 'direct', amount || 0, suggested_amount || null, advance || null, note,
            orderTypesToStore, delivery_status || 'confirmed', payment_gateway || null,
            business_name || null, transaction_id || null,
        ]
    )

    await logAudit(auth.employee.id, 'Added new work entry', 'work_log', data.id, { invoice_no })

    let awardedPoints = 0
    if (delivery_status === 'delivered') {
        const pointMap: Record<string, number> = {
            'normal': 5,
            'suggested': 10,
            '2000_plus': 20,
            '3000_plus': 50,
            '5000_plus': 100,
            'upsell': 20,
            'incomplete': 10,
        }
        // Points are summed across every type tagged on the order — being both e.g. Suggested
        // and 2000+ earns both bonuses, not just one.
        const pts = orderTypesToStore.reduce((sum, ot) => sum + (pointMap[ot] || 0), 0)
        if (pts > 0) {
            await awardPoints(db, targetEmployeeId, pts, 'work_log', data.id, `Order delivered (${orderTypesToStore.join(', ')})`, auth.employee.id)
            awardedPoints = pts
        }
    }

    return NextResponse.json({ ...data, awardedPoints }, { status: 201 })
}
