import { requireAuth, isAuthed } from '@/lib/auth'
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
            id, employee_id, amount, product_price, discount_price, purchase_date, item, note, payment_status, expense_id, created_at,
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

// POST /api/product-buys — create a new product-buy record (Admin+). The form collects
// Product Price and Discount Price rather than a single lump amount; `amount` (what every
// downstream consumer — Salary Sheet's Product Buy column, Paid/Due, Finance Hub summaries —
// actually reads) is computed here as product_price - discount_price so it can never drift
// from the two inputs that produced it.
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { employee_id, product_price, discount_price, purchase_date, item, note, payment_status } = body

    if (!employee_id) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })

    const numProductPrice = Number(product_price)
    if (!Number.isFinite(numProductPrice) || numProductPrice <= 0) {
        return NextResponse.json({ error: 'product_price must be a positive number' }, { status: 400 })
    }

    const numDiscountPrice = discount_price !== undefined ? Number(discount_price) : 0
    if (!Number.isFinite(numDiscountPrice) || numDiscountPrice < 0) {
        return NextResponse.json({ error: 'discount_price must be a non-negative number' }, { status: 400 })
    }
    if (numDiscountPrice > numProductPrice) {
        return NextResponse.json({ error: 'discount_price cannot exceed product_price' }, { status: 400 })
    }

    if (!purchase_date || !/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) {
        return NextResponse.json({ error: 'purchase_date is required in YYYY-MM-DD format' }, { status: 400 })
    }

    if (payment_status !== undefined && payment_status !== 'Paid' && payment_status !== 'Unpaid') {
        return NextResponse.json({ error: 'payment_status must be Paid or Unpaid' }, { status: 400 })
    }

    const finalPaymentStatus: 'Paid' | 'Unpaid' = payment_status || 'Unpaid'
    const numAmount = numProductPrice - numDiscountPrice

    const { data: inserted, error } = await supabase
        .from('product_buys')
        .insert({
            employee_id,
            amount: numAmount,
            product_price: numProductPrice,
            discount_price: numDiscountPrice,
            purchase_date,
            item: item || null,
            note: note || null,
            payment_status: finalPaymentStatus,
            created_by: auth.employee.id,
        })
        .select('id')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data, error: fetchError } = await supabase
        .from('product_buys')
        .select(`
            id, employee_id, amount, product_price, discount_price, purchase_date, item, note, payment_status, expense_id, created_at,
            employee:employees!employee_id(id, name, employee_id, avatar_url),
            created_by_employee:employees!created_by(id, name)
        `)
        .eq('id', inserted.id)
        .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    return NextResponse.json({ productBuy: data }, { status: 201 })
}
