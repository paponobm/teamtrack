import { requireAuth, isAuthed } from '@/lib/auth'
import { createLinkedExpense } from '@/lib/productBuys'
import { NextResponse } from 'next/server'

// GET /api/product-buys?start_date=&end_date= — list product-buy records, optionally
// date-filtered (Admin+). A separate table/endpoint from /api/advances — Product Buy and
// Advance are independent deduction types, never merged.
export async function GET(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
        .from('product_buys')
        .select(`
            id, employee_id, amount, purchase_date, item, note, payment_status, expense_id, created_at,
            employee:employees!employee_id(id, name, employee_id, avatar_url),
            created_by_employee:employees!created_by(id, name)
        `)
        .order('purchase_date', { ascending: false })

    if (startDate) query = query.gte('purchase_date', startDate)
    if (endDate) query = query.lte('purchase_date', endDate)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ productBuys: data || [] })
}

// POST /api/product-buys — create a new product-buy record (Admin+).
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { employee_id, amount, purchase_date, item, note, payment_status } = body

    if (!employee_id) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })

    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    if (!purchase_date || !/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) {
        return NextResponse.json({ error: 'purchase_date is required in YYYY-MM-DD format' }, { status: 400 })
    }

    if (payment_status !== undefined && payment_status !== 'Paid' && payment_status !== 'Unpaid') {
        return NextResponse.json({ error: 'payment_status must be Paid or Unpaid' }, { status: 400 })
    }

    const finalPaymentStatus: 'Paid' | 'Unpaid' = payment_status || 'Unpaid'

    const { data: inserted, error } = await supabase
        .from('product_buys')
        .insert({
            employee_id,
            amount: numAmount,
            purchase_date,
            item: item || null,
            note: note || null,
            payment_status: finalPaymentStatus,
            created_by: auth.employee.id,
        })
        .select('id')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Mirror into Finance Hub as a real Expense (category "Employee Product Buy") — best
    // effort: a failed link doesn't block the record itself, since the product_buys row is
    // the record of truth for Payroll.
    const expenseId = await createLinkedExpense(supabase, {
        employeeId: employee_id,
        amount: numAmount,
        date: purchase_date,
        item: item || null,
        note: note || null,
        paymentStatus: finalPaymentStatus,
        submittedBy: auth.employee.id,
    })
    if (expenseId) {
        await supabase.from('product_buys').update({ expense_id: expenseId }).eq('id', inserted.id)
    }

    const { data, error: fetchError } = await supabase
        .from('product_buys')
        .select(`
            id, employee_id, amount, purchase_date, item, note, payment_status, expense_id, created_at,
            employee:employees!employee_id(id, name, employee_id, avatar_url),
            created_by_employee:employees!created_by(id, name)
        `)
        .eq('id', inserted.id)
        .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    return NextResponse.json({ productBuy: data }, { status: 201 })
}
