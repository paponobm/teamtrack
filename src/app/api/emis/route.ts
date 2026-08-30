import { requireAuth, isAuthed } from '@/lib/auth'
import { computeMonthlyInstallment, computeTotalPayable, getEmiPaidSummaries, createLinkedExpense } from '@/lib/emis'
import { NextResponse } from 'next/server'

const TERM_OPTIONS = [3, 6, 12, 24] as const

const EMI_SELECT = `m.id, m.employee_id, m.amount, m.term_months, m.start_date, m.interest_rate, m.monthly_installment, m.expense_id, m.created_at,
    json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url) AS employee,
    json_build_object('id', c.id, 'name', c.name) AS created_by_employee`
const EMI_JOINS = `LEFT JOIN employees e ON e.id = m.employee_id LEFT JOIN employees c ON c.id = m.created_by`

// GET /api/emis?start_date=&end_date= — list EMI records, optionally filtered by
// start_date falling within the range (Admin+). Combined with Advance records client-side
// into one "Advance & EMI" list — see src/components/finance/AdvanceManager.tsx. Each record
// is enriched with a live Paid/Due summary (see getEmiPaidSummaries — derived from the Salary
// Sheet's own Paid status per covered month, not a separate payment ledger), same pattern as
// Provident Fund.
export async function GET(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []
    if (startDate) { params.push(startDate); conditions.push(`m.start_date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`m.start_date <= $${params.length}`) }

    const { rows } = await db.query(
        `SELECT ${EMI_SELECT} FROM emis m ${EMI_JOINS}
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY m.start_date DESC`,
        params
    )

    const summaries = await getEmiPaidSummaries(db, rows.map(r => ({
        id: r.id, employee_id: r.employee_id, start_date: r.start_date, term_months: r.term_months, amount: r.amount, interest_rate: r.interest_rate, monthly_installment: r.monthly_installment,
    })))

    const emis = rows.map(r => ({ ...r, ...summaries[r.id] }))

    return NextResponse.json({ emis })
}

// POST /api/emis — create a new EMI (installment loan) record (Admin+). monthly_installment
// is computed once here (reducing-balance EMI — see computeMonthlyInstallment in
// src/lib/emis.ts) and stored, so it never silently drifts if amount/rate/term are edited
// later without recomputing it.
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { employee_id, amount, term_months, start_date, interest_rate } = body

    if (!employee_id) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })

    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    const numTerm = Number(term_months)
    if (!TERM_OPTIONS.includes(numTerm as 3 | 6 | 12 | 24)) {
        return NextResponse.json({ error: 'term_months must be 3, 6, 12, or 24' }, { status: 400 })
    }

    if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
        return NextResponse.json({ error: 'start_date is required in YYYY-MM-DD format' }, { status: 400 })
    }

    const numRate = interest_rate !== undefined ? Number(interest_rate) : 0
    if (!Number.isFinite(numRate) || numRate < 0) {
        return NextResponse.json({ error: 'interest_rate must be a non-negative number' }, { status: 400 })
    }

    const monthlyInstallment = computeMonthlyInstallment(numAmount, numRate, numTerm)

    const { rows: [inserted] } = await db.query(
        `INSERT INTO emis (employee_id, amount, term_months, start_date, interest_rate, monthly_installment, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [employee_id, numAmount, numTerm, start_date, numRate, monthlyInstallment, auth.employee.id]
    )

    // Mirror this EMI into Finance Hub as a real Expense (category "Employee Loan") so Total
    // Expenses/Net Balance reflect the loan principal disbursed — best-effort: a failed link
    // doesn't block the EMI itself, since the EMI is the record of truth for Payroll.
    const expenseId = await createLinkedExpense(db, {
        employeeId: employee_id,
        amount: numAmount,
        date: start_date,
        submittedBy: auth.employee.id,
    })
    if (expenseId) {
        await db.query(`UPDATE emis SET expense_id = $1 WHERE id = $2`, [expenseId, inserted.id])
    }

    const { rows: [data] } = await db.query(
        `SELECT ${EMI_SELECT} FROM emis m ${EMI_JOINS} WHERE m.id = $1`,
        [inserted.id]
    )

    // A brand-new record has no salary sheets touching it yet, so Paid is always 0 here.
    const totalPayable = computeTotalPayable(numAmount, numRate, numTerm)
    return NextResponse.json({
        emi: {
            ...data,
            total_payable: totalPayable,
            paid: 0,
            due: totalPayable,
            paid_installments: 0,
            total_installments: numTerm,
            remaining_installments: numTerm,
            interest_paid: 0,
        },
    }, { status: 201 })
}
