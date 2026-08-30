import { requireAuth, isAuthed } from '@/lib/auth'
import { createLinkedExpense } from '@/lib/advances'
import { NextResponse } from 'next/server'

const ADVANCE_SELECT = `a.id, a.employee_id, a.amount, a.advance_date, a.note, a.payment_status, a.expense_id, a.created_at,
    json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url) AS employee,
    json_build_object('id', c.id, 'name', c.name) AS created_by_employee`
const ADVANCE_JOINS = `LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN employees c ON c.id = a.created_by`

// GET /api/advances?start_date=&end_date= — list advance records, optionally date-filtered
// (Admin+). Employee-text search and the Paid/Unpaid summary are computed client-side from
// this list so combined filters (date + employee) always stay consistent — see
// src/components/finance/AdvanceManager.tsx (the Finance Hub "Advance" tab).
export async function GET(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []
    if (startDate) { params.push(startDate); conditions.push(`a.advance_date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`a.advance_date <= $${params.length}`) }

    const { rows: advances } = await db.query(
        `SELECT ${ADVANCE_SELECT} FROM advances a ${ADVANCE_JOINS}
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY a.advance_date DESC`,
        params
    )

    return NextResponse.json({ advances })
}

// POST /api/advances — create a new advance record (Admin+).
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

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

    const finalPaymentStatus: 'Paid' | 'Unpaid' = payment_status || 'Unpaid'

    const { rows: [inserted] } = await db.query(
        `INSERT INTO advances (employee_id, amount, advance_date, note, payment_status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [employee_id, numAmount, advance_date, note || null, finalPaymentStatus, auth.employee.id]
    )

    // Mirror this advance into Finance Hub as a real Expense (category "Salary Advance"),
    // always 'paid' immediately — the company has disbursed this money regardless of the
    // advance's own payment_status (that tracks employee repayment separately, see
    // createLinkedExpense's doc comment in src/lib/advances.ts) — best-effort: a failed link
    // doesn't block the advance itself, since the advance is the record of truth for Payroll.
    const expenseId = await createLinkedExpense(db, {
        employeeId: employee_id,
        amount: numAmount,
        date: advance_date,
        note: note || null,
        submittedBy: auth.employee.id,
    })
    if (expenseId) {
        await db.query(`UPDATE advances SET expense_id = $1 WHERE id = $2`, [expenseId, inserted.id])
    }

    const { rows: [data] } = await db.query(
        `SELECT ${ADVANCE_SELECT} FROM advances a ${ADVANCE_JOINS} WHERE a.id = $1`,
        [inserted.id]
    )

    return NextResponse.json({ advance: data }, { status: 201 })
}
