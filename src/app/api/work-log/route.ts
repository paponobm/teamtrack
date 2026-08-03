import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/work-log - list work entries by date range and optional filters
export async function GET(request: Request) {
    const auth = await requireAuth(0) // any employee
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
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

    let query = supabase
        .from('work_entries')
        .select(`
            *,
            employee:employees!employee_id(id, name, employee_id),
            manager_checked:employees!management_check(id, name),
            authority_checked:employees!authority_check(id, name),
            verifier:employees!verified_by(id, name)
        `)
        .order('created_at', { ascending: false })

    // Date filtering: support single date or range
    if (startDate && endDate) {
        query = query.gte('date', startDate).lte('date', endDate)
    } else {
        const singleDate = date || new Date().toISOString().split('T')[0]
        query = query.eq('date', singleDate)
    }

    // Members can only see their own entries
    if (!isAdmin) {
        query = query.eq('employee_id', auth.employee.id)
    } else if (employeeId) {
        query = query.eq('employee_id', employeeId)
    }

    if (orderType && orderType !== 'all') {
        query = query.eq('order_type', orderType)
    }
    if (source && source !== 'all') {
        query = query.eq('source', source)
    }
    if (deliveryStatus && deliveryStatus !== 'all') {
        query = query.eq('delivery_status', deliveryStatus)
    }
    if (advanceStatus === 'with_advance') {
        query = query.gt('advance', 0)
    } else if (advanceStatus === 'verified') {
        query = query.gt('advance', 0).eq('advance_verified', true)
    } else if (advanceStatus === 'pending_verification') {
        query = query.gt('advance', 0).eq('advance_verified', false)
    } else if (advanceStatus === 'no_advance') {
        query = query.or('advance.is.null,advance.eq.0')
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Compute summary stats
    const entries = data || []
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
    const orderTypes = entries.reduce((acc: Record<string, number>, e) => {
        const ot = e.order_type || 'normal'
        acc[ot] = (acc[ot] || 0) + 1
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

    const supabase = auth.supabase
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
        const adminSupabase = createAdminClient()
        const { data: fraudContacts } = await adminSupabase
            .from('courier_issues')
            .select('id, contact_number')
            .eq('fraud_note', true)
            .not('contact_number', 'is', null)
        
        const isFraudContact = (fraudContacts || []).some(r => String(r.contact_number || '').trim() === trimmedContact)
        if (isFraudContact) {
            return NextResponse.json({ error: 'This customer contact is flagged as fraud in Courier Issues and cannot be used for new orders.' }, { status: 409 })
        }
    }

    // Auto-generate SL number
    const { count } = await supabase
        .from('work_entries')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', targetEmployeeId)
        .eq('date', date)

    const sl = (count || 0) + 1

    const { data, error } = await supabase
        .from('work_entries')
        .insert({
            employee_id: targetEmployeeId,
            date,
            sl,
            customer_phone,
            customer_name: customer_name || null,
            invoice_no,
            courier_id,
            source: source || 'direct',
            amount: amount || 0,
            suggested_amount: suggested_amount || null,
            advance: advance || null,
            note,
            order_type: order_type || 'normal',
            delivery_status: delivery_status || 'confirmed',
            payment_gateway: payment_gateway || null,
            business_name: business_name || null,
            transaction_id: transaction_id || null,
        })
        .select(`
            *,
            employee:employees!employee_id(id, name, employee_id)
        `)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

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
        const pts = pointMap[order_type || 'normal'] || 0
        if (pts > 0) {
            await awardPoints(supabase, targetEmployeeId, pts, 'work_log', data.id, `Order delivered (${order_type || 'normal'})`, auth.employee.id)
            awardedPoints = pts
        }
    }

    return NextResponse.json({ ...data, awardedPoints }, { status: 201 })
}
