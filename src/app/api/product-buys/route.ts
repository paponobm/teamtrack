import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PB_SELECT = `p.id, p.employee_id, p.amount, p.product_price, p.discount_price, p.purchase_date, p.item, p.note, p.payment_status, p.expense_id, p.created_at,
    json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url) AS employee,
    json_build_object('id', c.id, 'name', c.name) AS created_by_employee`
const PB_JOINS = `LEFT JOIN employees e ON e.id = p.employee_id LEFT JOIN employees c ON c.id = p.created_by`

// GET /api/product-buys?start_date=&end_date= — list product-buy records, optionally
// date-filtered (Admin+). A separate table/endpoint from /api/advances — Product Buy and
// Advance are independent deduction types, never merged.
export async function GET(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []
    if (startDate) { params.push(startDate); conditions.push(`p.purchase_date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`p.purchase_date <= $${params.length}`) }

    const { rows: productBuys } = await db.query(
        `SELECT ${PB_SELECT} FROM product_buys p ${PB_JOINS}
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY p.purchase_date DESC`,
        params
    )

    return NextResponse.json({ productBuys })
}

// POST /api/product-buys — create a new product-buy record (Admin+). The form collects
// Product Price and Discount Price rather than a single lump amount; `amount` (what every
// downstream consumer — Salary Sheet's Product Buy column, Paid/Due, Finance Hub summaries —
// actually reads) is computed here as product_price - discount_price so it can never drift
// from the two inputs that produced it.
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

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

    const { rows: [inserted] } = await db.query(
        `INSERT INTO product_buys (employee_id, amount, product_price, discount_price, purchase_date, item, note, payment_status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [employee_id, numAmount, numProductPrice, numDiscountPrice, purchase_date, item || null, note || null, finalPaymentStatus, auth.employee.id]
    )

    const { rows: [data] } = await db.query(
        `SELECT ${PB_SELECT} FROM product_buys p ${PB_JOINS} WHERE p.id = $1`,
        [inserted.id]
    )

    return NextResponse.json({ productBuy: data }, { status: 201 })
}
