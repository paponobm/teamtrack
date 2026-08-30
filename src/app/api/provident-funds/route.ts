import { requireAuth, isAuthed } from '@/lib/auth'
import { computeMonthlyInstallment, computeMaturityAmount, getProvidentFundPaidSummaries } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'

const PF_SELECT = `f.id, f.employee_id, f.principal_amount, f.duration_months, f.interest_rate, f.monthly_installment, f.start_date, f.note, f.created_at,
    json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url,
        'department', json_build_object('id', d.id, 'name', d.name)) AS employee,
    json_build_object('id', c.id, 'name', c.name) AS created_by_employee`
const PF_JOINS = `LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN employees c ON c.id = f.created_by`

// GET /api/provident-funds?start_date=&end_date= — list Provident Fund records, optionally
// filtered by start_date falling within the range (Admin+), each enriched with a live
// Paid/Due summary (see getProvidentFundPaidSummaries — derived from the Salary Sheet's own
// Paid status per covered month, not a separate payment ledger).
export async function GET(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []
    if (startDate) { params.push(startDate); conditions.push(`f.start_date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`f.start_date <= $${params.length}`) }

    const { rows } = await db.query(
        `SELECT ${PF_SELECT} FROM provident_funds f ${PF_JOINS}
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY f.start_date DESC`,
        params
    )

    const summaries = await getProvidentFundPaidSummaries(db, rows.map(r => ({
        id: r.id, employee_id: r.employee_id, start_date: r.start_date, duration_months: r.duration_months, principal_amount: r.principal_amount, interest_rate: r.interest_rate, monthly_installment: r.monthly_installment,
    })))

    const providentFunds = rows.map(r => ({ ...r, ...summaries[r.id] }))

    return NextResponse.json({ provident_funds: providentFunds })
}

// POST /api/provident-funds — create a new Provident Fund record (Admin+). Duration is
// intentionally not restricted to a fixed set server-side (the Add form's dropdown offers
// 3/6/12/18/24 months, but any positive integer is accepted) so new duration options can be
// added later without a migration. monthly_installment is computed once here (principal split
// evenly across the duration — interest never inflates it, see computeMonthlyInstallment in
// src/lib/providentFunds.ts) and stored, so it never silently drifts if amount/rate/duration
// are edited later without recomputing it.
export async function POST(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { employee_id, principal_amount, duration_months, start_date, interest_rate, note } = body

    if (!employee_id) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })

    const numPrincipal = Number(principal_amount)
    if (!Number.isFinite(numPrincipal) || numPrincipal <= 0) {
        return NextResponse.json({ error: 'principal_amount must be a positive number' }, { status: 400 })
    }

    const numDuration = Number(duration_months)
    if (!Number.isInteger(numDuration) || numDuration <= 0) {
        return NextResponse.json({ error: 'duration_months must be a positive whole number' }, { status: 400 })
    }

    if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
        return NextResponse.json({ error: 'start_date is required in YYYY-MM-DD format' }, { status: 400 })
    }

    const numRate = interest_rate !== undefined ? Number(interest_rate) : 0
    if (!Number.isFinite(numRate) || numRate < 0) {
        return NextResponse.json({ error: 'interest_rate must be a non-negative number' }, { status: 400 })
    }

    // interest_rate is stored as reference data only — it does not affect what's payable or
    // deducted per month (see src/lib/providentFunds.ts): the employee only pays back their
    // own principal, split evenly across the duration.
    const monthlyInstallment = computeMonthlyInstallment(numPrincipal, numDuration)

    const { rows: [inserted] } = await db.query(
        `INSERT INTO provident_funds (employee_id, principal_amount, duration_months, start_date, interest_rate, monthly_installment, note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [employee_id, numPrincipal, numDuration, start_date, numRate, monthlyInstallment, note || null, auth.employee.id]
    )

    const { rows: [data] } = await db.query(
        `SELECT ${PF_SELECT} FROM provident_funds f ${PF_JOINS} WHERE f.id = $1`,
        [inserted.id]
    )

    // A brand-new record has no salary sheets touching it yet, so Paid is always 0 here.
    // Total Payable is the exact principal, not installment × duration (which would carry the
    // same 2-decimal rounding drift monthly_installment is stored with). Total Amount
    // (principal + interest — what the employee ultimately receives back) is a separate,
    // informational figure with no bearing on Paid/Due.
    const totalPayable = numPrincipal
    const totalAmount = computeMaturityAmount(monthlyInstallment, numRate, numDuration)
    return NextResponse.json({
        provident_fund: {
            ...data,
            total_payable: totalPayable,
            total_amount: totalAmount,
            paid: 0,
            due: totalPayable,
            paid_installments: 0,
            total_installments: numDuration,
            remaining_installments: numDuration,
        },
    }, { status: 201 })
}
