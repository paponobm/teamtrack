import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/advances?start_date=&end_date= — list advance records, optionally date-filtered
// (Admin+). Employee-text search and the Paid/Unpaid summary are computed client-side from
// this list so combined filters (date + employee) always stay consistent — see
// src/app/(dashboard)/advance-management/page.tsx.
export async function GET(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
        .from('advances')
        .select(`
            id, employee_id, amount, advance_date, note, payment_status, created_at,
            employee:employees!employee_id(id, name, employee_id, avatar_url),
            created_by_employee:employees!created_by(id, name)
        `)
        .order('advance_date', { ascending: false })

    if (startDate) query = query.gte('advance_date', startDate)
    if (endDate) query = query.lte('advance_date', endDate)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ advances: data || [] })
}

// POST /api/advances — create a new advance record (Admin+).
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { employee_id, amount, advance_date, note, payment_status } = body

    if (!employee_id) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })

    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    if (!advance_date || !/^\d{4}-\d{2}-\d{2}$/.test(advance_date)) {
        return NextResponse.json({ error: 'advance_date is required in YYYY-MM-DD format' }, { status: 400 })
    }

    if (payment_status !== undefined && payment_status !== 'Paid' && payment_status !== 'Unpaid') {
        return NextResponse.json({ error: 'payment_status must be Paid or Unpaid' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('advances')
        .insert({
            employee_id,
            amount: numAmount,
            advance_date,
            note: note || null,
            payment_status: payment_status || 'Unpaid',
            created_by: auth.employee.id,
        })
        .select(`
            id, employee_id, amount, advance_date, note, payment_status, created_at,
            employee:employees!employee_id(id, name, employee_id, avatar_url),
            created_by_employee:employees!created_by(id, name)
        `)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ advance: data }, { status: 201 })
}
