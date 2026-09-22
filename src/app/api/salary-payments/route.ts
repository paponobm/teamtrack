import { requireAuth, isAuthed } from '@/lib/auth'
import { createSalaryPaymentExpense } from '@/lib/salaryPayments'
import {
    getAttendanceStatsForMonth, getFineTotalsForMonth, getAdvanceDetailsForMonth, computeNetPayable,
    computeLeaveDeduction, computeLeaveSurplusBonus, usesPaidAmountFeature, effectiveLeaveDays,
} from '@/lib/payroll'
import { getProductBuyDetailsForMonth } from '@/lib/productBuys'
import { getEmiLoanDetailsForMonth } from '@/lib/emis'
import { getProvidentFundDetailsForMonth } from '@/lib/providentFunds'
import { getMonthRangeFromString } from '@/lib/dateRange'
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

    // Reflect this payment into the employee's own Payroll Salary Sheet entry for the month it
    // falls in, if that sheet/entry exists — same "paid_amount tracks cumulative money actually
    // handed over" model the Payroll "Mark as Paid" modal's own Partial Payment tab already uses
    // (see PUT /api/payroll/salary-entries). Only applies from PAID_AMOUNT_FEATURE_CUTOVER_MONTH
    // onward (paid_amount isn't tracked for older sheets), and never touches an entry that's
    // already fully Paid — that's a settled, permanent record (the payroll route itself refuses
    // to unsettle one), so a further off-cycle Salary payment on top of it stays purely its own
    // independent expense rather than reopening that month.
    const month = payment_date.slice(0, 7)
    if (usesPaidAmountFeature(month)) {
        const { rows: [sheet] } = await db.query(`SELECT id FROM salary_sheets WHERE month = $1`, [month])
        if (sheet) {
            const { rows: [entry] } = await db.query(
                `SELECT id, payment_status, paid_amount, basic_salary, extra_duty, transportation_bill, snacks_bill,
                     performance_bonus, festival_bonus, other_deduction, attendance_present_override, attendance_leave_override
                 FROM salary_entries WHERE salary_sheet_id = $1 AND employee_id = $2`,
                [sheet.id, employee_id]
            )
            if (entry && entry.payment_status !== 'Paid') {
                const oldPaidAmount = Number(entry.paid_amount) || 0
                const newPaidAmount = oldPaidAmount + numAmount
                await db.query(`UPDATE salary_entries SET paid_amount = $1 WHERE id = $2`, [newPaidAmount, entry.id])

                // Activity Log — same generic audit_log table/shape the payroll edit form and
                // Daily Attendance already write to (see PUT /api/payroll/salary-entries), so it
                // shows up in that entry's own "Log" button: who, when, and how much.
                await db.query(
                    `INSERT INTO audit_log (actor_id, module, action, target_id, details)
                     VALUES ($1, 'payroll', 'update', $2, $3)`,
                    [auth.employee.id, entry.id, JSON.stringify({
                        actor_name: auth.employee.name,
                        changes: [`Salary Payment: ৳${numAmount.toLocaleString()} on ${payment_date} (Finance Hub) → Paid Amount now ৳${newPaidAmount.toLocaleString()}`],
                    })]
                )

                const { rows: [employeeRow] } = await db.query(`SELECT monthly_leave_allowance FROM employees WHERE id = $1`, [employee_id])
                const monthlyLeaveAllowance = Number(employeeRow?.monthly_leave_allowance) || 0

                const employeeIds = [employee_id]
                const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails, attendanceStats] = await Promise.all([
                    getFineTotalsForMonth(db, employeeIds, month),
                    getAdvanceDetailsForMonth(db, employeeIds, month),
                    getProductBuyDetailsForMonth(db, employeeIds, month),
                    getEmiLoanDetailsForMonth(db, employeeIds, month),
                    getProvidentFundDetailsForMonth(db, employeeIds, month),
                    getAttendanceStatsForMonth(db, employeeIds, month),
                ])
                const effectivePresent = entry.attendance_present_override ?? (attendanceStats[employee_id]?.present || 0)
                const effectiveLeave = effectiveLeaveDays(attendanceStats[employee_id]?.leave || 0, attendanceStats[employee_id]?.absent || 0, entry.attendance_leave_override, month)
                const leaveDeduction = computeLeaveDeduction(Number(entry.basic_salary) || 0, effectivePresent, effectiveLeave, monthlyLeaveAllowance, month)
                const leaveSurplusBonus = computeLeaveSurplusBonus(Number(entry.basic_salary) || 0, effectiveLeave, monthlyLeaveAllowance, month)
                const netPayable = computeNetPayable(
                    entry,
                    fineTotals[employee_id] || 0,
                    advanceDetails[employee_id]?.total || 0,
                    productBuyDetails[employee_id]?.total || 0,
                    emiDetails[employee_id]?.total || 0,
                    providentFundDetails[employee_id]?.total || 0,
                    leaveDeduction,
                    leaveSurplusBonus,
                )

                // This payment brought the running total to (or past) the full Payable Salary —
                // settle the entry exactly like the payroll "Mark as Paid" flow does: recover
                // any still-Unpaid Advance/Product Buy/Fine for this employee/month. Deliberately
                // does NOT also create/sync a linked "Employee Salary" settlement expense the way
                // that flow does — this money has already been individually booked via this
                // record's own "Salary Payment" expense above (and any earlier partial/salary
                // payments' own expenses), so a further linked expense here would double-count
                // the exact same disbursement under a second category.
                if (newPaidAmount >= netPayable) {
                    const { start, end } = getMonthRangeFromString(month)
                    await db.query(
                        `UPDATE advances SET payment_status = 'Paid'
                         WHERE employee_id = $1 AND payment_status = 'Unpaid' AND advance_date >= $2 AND advance_date <= $3`,
                        [employee_id, start, end]
                    )
                    const { rows: settledProductBuys } = await db.query(
                        `UPDATE product_buys SET payment_status = 'Paid'
                         WHERE employee_id = $1 AND payment_status = 'Unpaid' AND purchase_date >= $2 AND purchase_date <= $3
                         RETURNING id, item, amount`,
                        [employee_id, start, end]
                    )
                    if (settledProductBuys.length > 0) {
                        for (const pb of settledProductBuys) {
                            await db.query(
                                `INSERT INTO income (date, description, amount, source, product_buy_id, added_by)
                                 VALUES ($1, $2, $3, 'Product Sell', $4, $5)`,
                                [payment_date, `Product sale — ${pb.item || 'Product'}`, pb.amount, pb.id, auth.employee.id]
                            )
                        }
                    }
                    await db.query(
                        `UPDATE fines SET payment_status = 'Paid', settled_month = $1
                         WHERE member_id = $2 AND status = 'Active' AND payment_status = 'Unpaid' AND created_at <= $3`,
                        [month, employee_id, `${end}T23:59:59`]
                    )
                    await db.query(`UPDATE salary_entries SET payment_status = 'Paid', payment_date = $1 WHERE id = $2`, [payment_date, entry.id])
                    await db.query(
                        `INSERT INTO audit_log (actor_id, module, action, target_id, details)
                         VALUES ($1, 'payroll', 'update', $2, $3)`,
                        [auth.employee.id, entry.id, JSON.stringify({
                            actor_name: auth.employee.name,
                            changes: [`Payment Status: Unpaid → Paid (fully settled via Salary Payment)`],
                        })]
                    )
                }
            }
        }
    }

    const { rows: [data] } = await db.query(
        `SELECT ${SALARY_PAYMENT_SELECT} FROM salary_payments s ${SALARY_PAYMENT_JOINS} WHERE s.id = $1`,
        [inserted.id]
    )

    return NextResponse.json({ salaryPayment: data }, { status: 201 })
}
