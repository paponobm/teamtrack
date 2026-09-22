import { requireAuth, isAuthed } from '@/lib/auth'
import { createSalaryPaymentExpense } from '@/lib/salaryPayments'
import { NextResponse } from 'next/server'

const SALARY_PAYMENT_SELECT = `s.id, s.employee_id, s.amount, s.payment_date, s.note, s.expense_id, s.created_at,
    json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url) AS employee,
    json_build_object('id', c.id, 'name', c.name) AS created_by_employee`
const SALARY_PAYMENT_JOINS = `LEFT JOIN employees e ON e.id = s.employee_id LEFT JOIN employees c ON c.id = s.created_by`

// GET /api/salary-payments?start_date=&end_date= — list manual/off-cycle salary payment
// records, optionally date-filtered (Admin+). Mirrors GET /api/advances exactly — see
// src/components/finance/AdvanceManager.tsx (the Finance Hub "Salary" tab).
export async function GET(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []
    if (startDate) { params.push(startDate); conditions.push(`s.payment_date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`s.payment_date <= $${params.length}`) }

    const { rows: salaryPayments } = await db.query(
        `SELECT ${SALARY_PAYMENT_SELECT} FROM salary_payments s ${SALARY_PAYMENT_JOINS}
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY s.payment_date DESC`,
        params
    )

    return NextResponse.json({ salaryPayments })
}

// POST /api/salary-payments — create a new manual salary payment record (Admin+).
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { employee_id, amount, payment_date, note } = body

    if (!employee_id) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })

    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    if (!payment_date || !/^\d{4}-\d{2}-\d{2}$/.test(payment_date)) {
        return NextResponse.json({ error: 'payment_date is required in YYYY-MM-DD format' }, { status: 400 })
    }

    const { rows: [inserted] } = await db.query(
        `INSERT INTO salary_payments (employee_id, amount, payment_date, note, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [employee_id, numAmount, payment_date, note || null, auth.employee.id]
    )

    // Mirror into Finance Hub as a real Expense (category "Salary Payment"), always 'paid'
    // immediately — the company has disbursed this money the moment the record exists —
    // best-effort: a failed link doesn't block the payment record itself.
    const expenseId = await createSalaryPaymentExpense(db, {
        employeeId: employee_id,
        amount: numAmount,
        date: payment_date,
        note: note || null,
        submittedBy: auth.employee.id,
    })
    if (expenseId) {
        await db.query(`UPDATE salary_payments SET expense_id = $1 WHERE id = $2`, [expenseId, inserted.id])
    }

    const { rows: [data] } = await db.query(
        `SELECT ${SALARY_PAYMENT_SELECT} FROM salary_payments s ${SALARY_PAYMENT_JOINS} WHERE s.id = $1`,
        [inserted.id]
    )

    return NextResponse.json({ salaryPayment: data }, { status: 201 })
}
