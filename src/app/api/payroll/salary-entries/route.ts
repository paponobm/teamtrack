import { requireAuth, isAuthed } from '@/lib/auth'
import { getMonthRangeFromString } from '@/lib/dateRange'
import { getFineTotalsForMonth, getAdvanceDetailsForMonth, computeNetPayable, createOrSyncSalaryExpense } from '@/lib/payroll'
import { getProductBuyDetailsForMonth } from '@/lib/productBuys'
import { getEmiLoanDetailsForMonth } from '@/lib/emis'
import { getProvidentFundDetailsForMonth } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'

// 'advance'/'product_buy'/'loan' are intentionally not editable here — computed live from
// their own modules (advances/product_buys/emis), same as 'fine'. 'basic_salary'/
// 'transportation_bill'/'snacks_bill'/'festival_bonus' are also excluded — frozen at
// salary-sheet-creation time from the employee's saved payroll defaults (Super Admin, via
// Members → Edit Member), not editable per month here.
const NUMERIC_FIELDS = ['extra_duty', 'performance_bonus', 'other_deduction'] as const
const PAYMENT_METHODS = ['bKash', 'Rocket', 'Nagad', 'Bank', 'Cash'] as const

// PUT /api/payroll/salary-entries — edit one employee's salary amounts/payment status for
// a month (Super Admin, or a Member granted the Payroll Management feature). Employee/attendance/leave/fine fields are never accepted
// here — they're read-only, derived data that this route has no business touching.
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Once an entry is marked Paid it's a settled payout — attempting to flip it back to
    // Unpaid (e.g. via a stale form still open after another update) is rejected here too,
    // not just hidden in the UI, since Paid triggers side effects (advance/product buy
    // settlement below) that don't have a matching "undo" on reversal.
    if (body.payment_status === 'Unpaid') {
        const { rows: [existing] } = await db.query(`SELECT payment_status FROM salary_entries WHERE id = $1`, [id])
        if (existing?.payment_status === 'Paid') {
            return NextResponse.json({ error: 'A Paid entry cannot be changed back to Unpaid' }, { status: 400 })
        }
    }

    const update: Record<string, number | string | null> = {}

    for (const field of NUMERIC_FIELDS) {
        if (body[field] === undefined) continue
        const num = Number(body[field])
        if (!Number.isFinite(num) || num < 0) {
            return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 })
        }
        update[field] = num
    }

    if (body.payment_status !== undefined) {
        if (body.payment_status !== 'Paid' && body.payment_status !== 'Unpaid') {
            return NextResponse.json({ error: 'payment_status must be Paid or Unpaid' }, { status: 400 })
        }
        update.payment_status = body.payment_status
    }

    if (body.payment_method !== undefined) {
        if (body.payment_method !== null && !PAYMENT_METHODS.includes(body.payment_method)) {
            return NextResponse.json({ error: `payment_method must be one of ${PAYMENT_METHODS.join(', ')}` }, { status: 400 })
        }
        update.payment_method = body.payment_method
    }

    if (body.payment_date !== undefined) {
        if (body.payment_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.payment_date)) {
            return NextResponse.json({ error: 'payment_date must be in YYYY-MM-DD format' }, { status: 400 })
        }
        update.payment_date = body.payment_date
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    update.updated_by = auth.employee.id

    const keys = Object.keys(update)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE salary_entries SET ${setClauses.join(', ')} WHERE id = $1
         RETURNING id, employee_id, salary_sheet_id, expense_id, payment_date,
             basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus, other_deduction`,
        [id, ...keys.map(k => update[k])]
    )

    if (!data) return NextResponse.json({ error: 'Salary entry not found' }, { status: 404 })

    // Marking the salary as Paid means that month's advance was recovered through this
    // payout, so settle any still-Unpaid advance records for that employee/month too — keeps
    // the Salary Sheet and Advance Management module in sync without a manual second step.
    // This whole block also re-runs on a later edit to an already-Paid entry (the form always
    // resends payment_status:'Paid' once it's locked in), which is exactly what's wanted for
    // re-syncing the linked salary Expense below if extra_duty/performance_bonus changes.
    if (update.payment_status === 'Paid') {
        const { rows: [sheet] } = await db.query(`SELECT month FROM salary_sheets WHERE id = $1`, [data.salary_sheet_id])
        if (sheet) {
            const { start, end } = getMonthRangeFromString(sheet.month)
            // Settling here only updates the advance's own payment_status (employee repayment
            // tracking) — it deliberately does NOT touch the advance's linked Finance Hub
            // Expense. That expense represents the company's original disbursement and is
            // permanently 'paid' from the moment the advance was created (see createLinkedExpense
            // in src/lib/advances.ts); employee repayment is a separate concern, surfaced as
            // "Receiving Status" wherever that expense is shown (see /api/expenses), never by
            // flipping the expense's own payment_status.
            await db.query(
                `UPDATE advances SET payment_status = 'Paid'
                 WHERE employee_id = $1 AND payment_status = 'Unpaid' AND advance_date >= $2 AND advance_date <= $3`,
                [data.employee_id, start, end]
            )

            // Same settlement, mirrored for Product Buy — a separate deduction type/table
            // from Advance, so it's settled independently here. Product Buy no longer links
            // into Finance Hub Expenses (see src/lib/productBuys.ts), so this only updates the
            // product_buys row's own status, not a mirrored expense.
            const { rows: settledProductBuys } = await db.query(
                `UPDATE product_buys SET payment_status = 'Paid'
                 WHERE employee_id = $1 AND payment_status = 'Unpaid' AND purchase_date >= $2 AND purchase_date <= $3
                 RETURNING id, item, amount`,
                [data.employee_id, start, end]
            )

            // Recovering a Product Buy's cost through payroll is, from the company's side,
            // revenue from having sold that product to the employee — mirrored into Finance
            // Hub's Income Hub (source 'Product Sell') the same "linked record" way verified
            // Work Log advances mirror into income too (see
            // src/app/api/work-log/[id]/verify-advance/route.ts). product_buy_id (unique, see
            // migration 069_income_product_buy_link.sql) means a given Product Buy can never
            // be mirrored twice, and the payment_status='Unpaid' filter above already guarantees
            // settledProductBuys only ever contains buys settled for the first time.
            if (settledProductBuys.length > 0) {
                for (const pb of settledProductBuys) {
                    await db.query(
                        `INSERT INTO income (date, description, amount, source, product_buy_id, added_by)
                         VALUES ($1, $2, $3, 'Product Sell', $4, $5)`,
                        [data.payment_date || end, `Product sale — ${pb.item || 'Product'}`, pb.amount, pb.id, auth.employee.id]
                    )
                }
            }

            // Same again for Fines — Active, still-Unpaid fines count as "recovered through this
            // payout" (an Appealed or already-Waived fine isn't part of what
            // getFineTotalsForMonth deducted, so it has nothing to settle here). No lower bound
            // on created_at, matching getFineTotalsForMonth's own "rolls forward until paid"
            // rule — a fine from an earlier month that's still Unpaid was included in this
            // month's deduction too, so it needs to settle here, not just fines issued this
            // exact month. settled_month is stamped with the sheet's own month so
            // getFineTotalsForMonth still counts it for THIS month (and any earlier one it
            // rolled through) even though payment_status flips to 'Paid' in this same request.
            await db.query(
                `UPDATE fines SET payment_status = 'Paid', settled_month = $1
                 WHERE member_id = $2 AND status = 'Active' AND payment_status = 'Unpaid' AND created_at <= $3`,
                [sheet.month, data.employee_id, `${end}T23:59:59`]
            )

            // The payout itself also becomes a Finance Hub Expense (category "Employee
            // Salary", amount = Payable Salary) — same live deduction lookups the Salary Sheet
            // and Payroll Summary already use, so the linked amount can never drift from what
            // the sheet shows for this entry.
            const employeeIds = [data.employee_id]
            const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails] = await Promise.all([
                getFineTotalsForMonth(db, employeeIds, sheet.month),
                getAdvanceDetailsForMonth(db, employeeIds, sheet.month),
                getProductBuyDetailsForMonth(db, employeeIds, sheet.month),
                getEmiLoanDetailsForMonth(db, employeeIds, sheet.month),
                getProvidentFundDetailsForMonth(db, employeeIds, sheet.month),
            ])
            const netPayable = computeNetPayable(
                data,
                fineTotals[data.employee_id] || 0,
                advanceDetails[data.employee_id]?.total || 0,
                productBuyDetails[data.employee_id]?.total || 0,
                emiDetails[data.employee_id]?.total || 0,
                providentFundDetails[data.employee_id]?.total || 0,
            )

            const salaryExpenseId = await createOrSyncSalaryExpense(db, {
                expenseId: data.expense_id,
                employeeId: data.employee_id,
                month: sheet.month,
                amount: netPayable,
                date: data.payment_date,
                submittedBy: auth.employee.id,
            })
            if (salaryExpenseId && salaryExpenseId !== data.expense_id) {
                await db.query(`UPDATE salary_entries SET expense_id = $1 WHERE id = $2`, [salaryExpenseId, id])
            }
        }
    }

    return NextResponse.json({ success: true })
}
