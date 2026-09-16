import { requireAuth, isAuthed } from '@/lib/auth'
import { getMonthRangeFromString } from '@/lib/dateRange'
import { getAttendanceStatsForMonth, getFineTotalsForMonth, getAdvanceDetailsForMonth, computeNetPayable, computeLeaveDeduction, computeLeaveSurplusBonus, createOrSyncSalaryExpense, SALARY_EXPENSE_CATEGORY, usesPaidAmountFeature } from '@/lib/payroll'
import { getProductBuyDetailsForMonth } from '@/lib/productBuys'
import { getEmiLoanDetailsForMonth } from '@/lib/emis'
import { getProvidentFundDetailsForMonth } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'

// 'advance'/'product_buy'/'loan' are intentionally not editable here — computed live from
// their own modules (advances/product_buys/emis), same as 'fine'. 'basic_salary'/
// 'transportation_bill'/'snacks_bill'/'festival_bonus' are also excluded — frozen at
// salary-sheet-creation time from the employee's saved payroll defaults (Super Admin, via
// Members → Edit Member), not editable per month here.
const NUMERIC_FIELDS = ['extra_duty', 'performance_bonus', 'other_deduction', 'paid_amount'] as const
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

    // Fetched once up front — used both for the Paid-guard check below and for the Activity
    // Log's before/after comparison once the update actually runs.
    const { rows: [oldRecord] } = await db.query(
        `SELECT se.extra_duty, se.performance_bonus, se.other_deduction, se.paid_amount, se.payment_status,
             se.payment_method, se.payment_date, se.attendance_present_override, se.attendance_leave_override,
             ss.month
         FROM salary_entries se JOIN salary_sheets ss ON ss.id = se.salary_sheet_id
         WHERE se.id = $1`,
        [id]
    )

    // Once an entry is marked Paid it's a settled payout — attempting to flip it back to
    // Unpaid (e.g. via a stale form still open after another update) is rejected here too,
    // not just hidden in the UI, since Paid triggers side effects (advance/product buy
    // settlement below) that don't have a matching "undo" on reversal.
    if (body.payment_status === 'Unpaid' && oldRecord?.payment_status === 'Paid') {
        return NextResponse.json({ error: 'A Paid entry cannot be changed back to Unpaid' }, { status: 400 })
    }

    // Recording a Partial Payment (the "Mark as Paid" modal's own second tab, distinct from
    // fully settling the entry) — installment-based: `amount` is how much is being handed over
    // *right now*, added on top of whatever was already paid, not a replacement total. This is
    // deliberately never allowed to touch payment_status itself (stays Unpaid/"Partial Paid"
    // display state — see paymentStatusInfo in SalarySheet.tsx) — only a full "Mark as Paid"
    // (the first tab) settles the entry and runs the advance/fine/expense-sync side effects
    // further down. Rewritten into the same paid_amount/payment_method/payment_date fields the
    // rest of this route already handles, so nothing else below needs to know this came from a
    // different form.
    let partialPaymentAmount: number | undefined
    if (body.partial_payment) {
        // Only offered for sheets from PAID_AMOUNT_FEATURE_CUTOVER_MONTH onward — see that
        // constant in src/lib/payroll.ts. The frontend already hides the Partial Payment tab
        // for an older sheet, but this guard covers a stale form/direct API call too.
        if (!oldRecord?.month || !usesPaidAmountFeature(oldRecord.month)) {
            return NextResponse.json({ error: 'Partial Payment is not available for this month' }, { status: 400 })
        }
        const amount = Number(body.partial_payment.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ error: 'Partial payment amount must be a positive number' }, { status: 400 })
        }
        if (body.partial_payment.method !== undefined && body.partial_payment.method !== null && !PAYMENT_METHODS.includes(body.partial_payment.method)) {
            return NextResponse.json({ error: `payment_method must be one of ${PAYMENT_METHODS.join(', ')}` }, { status: 400 })
        }
        if (!body.partial_payment.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.partial_payment.date)) {
            return NextResponse.json({ error: 'Partial payment date is required (YYYY-MM-DD)' }, { status: 400 })
        }
        partialPaymentAmount = amount
        body.paid_amount = (Number(oldRecord?.paid_amount) || 0) + amount
        body.payment_method = body.partial_payment.method || null
        body.payment_date = body.partial_payment.date
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

    // Manual correction of the live-computed Present/Leave day counts for this month (e.g. the
    // daily attendance log missed an entry) — null clears the override and falls back to the
    // computed value again, same as every other nullable field here.
    for (const field of ['attendance_present_override', 'attendance_leave_override'] as const) {
        if (body[field] === undefined) continue
        if (body[field] !== null) {
            const num = Number(body[field])
            if (!Number.isFinite(num) || num < 0) {
                return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 })
            }
            update[field] = num
        } else {
            update[field] = null
        }
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    update.updated_by = auth.employee.id

    const keys = Object.keys(update)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE salary_entries SET ${setClauses.join(', ')} WHERE id = $1
         RETURNING id, employee_id, salary_sheet_id, expense_id, payment_date, payment_status,
             basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus, other_deduction,
             attendance_present_override, attendance_leave_override, paid_amount`,
        [id, ...keys.map(k => update[k])]
    )

    if (!data) return NextResponse.json({ error: 'Salary entry not found' }, { status: 404 })

    // Activity Log — one entry per save, listing exactly which fields changed (before → after),
    // same shape/module-agnostic table the Daily Attendance edit modal already writes to and
    // reads back from (see PATCH /api/attendance/[id] and GET /api/activity-log). Only the
    // fields actually present in this request are compared — untouched fields (e.g. an
    // attendance-only save never touching extra_duty) never show up as a false "no change".
    const FIELD_LABELS: Record<string, string> = {
        extra_duty: 'Extra Duty', performance_bonus: 'Performance Bonus', other_deduction: 'Other Deduction',
        paid_amount: 'Paid Amount', payment_status: 'Payment Status', payment_method: 'Payment Method',
        payment_date: 'Payment Date', attendance_present_override: 'Present Days (override)',
        attendance_leave_override: 'Leave Days (override)',
    }
    const changes: string[] = []
    for (const key of keys) {
        if (key === 'updated_by') continue
        const oldVal = oldRecord?.[key] ?? null
        const newVal = update[key]
        if (String(oldVal ?? '') === String(newVal ?? '')) continue
        const label = FIELD_LABELS[key] || key
        changes.push(`${label}: ${oldVal ?? 'none'} → ${newVal ?? 'none'}`)
    }
    if (changes.length > 0) {
        await db.query(
            `INSERT INTO audit_log (actor_id, module, action, target_id, details)
             VALUES ($1, 'payroll', 'update', $2, $3)`,
            [auth.employee.id, id, JSON.stringify({ actor_name: auth.employee.name, changes })]
        )
    }

    // A Partial Payment books its own standalone Finance Hub Expense right away — deliberately
    // separate from createOrSyncSalaryExpense below, which maintains exactly ONE synced expense
    // per entry for the final full settlement. Each partial installment instead becomes its own
    // permanent 'Employee Salary' expense row dated on the day it was actually paid, so multiple
    // partial payments across a month show up as multiple line items in Finance Hub, and the
    // later full "Mark as Paid" settlement (above/below) tops up on top of them instead of
    // double-booking the money already recorded here.
    if (partialPaymentAmount !== undefined) {
        const { rows: [sheet] } = await db.query(`SELECT month FROM salary_sheets WHERE id = $1`, [data.salary_sheet_id])
        const { rows: [employee] } = await db.query(`SELECT name FROM employees WHERE id = $1`, [data.employee_id])
        await db.query(
            `INSERT INTO expenses (date, category, description, amount, payment_method, payment_status, submitted_by, approved_by)
             VALUES ($1, $2, $3, $4, $5, 'paid', $6, $6)`,
            [
                body.partial_payment.date,
                SALARY_EXPENSE_CATEGORY,
                `Partial salary payment - ${employee?.name || 'Employee'} - ${sheet?.month || ''}`,
                partialPaymentAmount,
                body.partial_payment.method || null,
                auth.employee.id,
            ]
        )
    }

    // The employee's own configured free Leave days per month (Members → Edit Member → Duty
    // Schedule) — looked up once here since both the attendance-override recompute below and
    // the Paid-settlement block further down need it for computeLeaveDeduction.
    const { rows: [employeeRow] } = await db.query(`SELECT monthly_leave_allowance FROM employees WHERE id = $1`, [data.employee_id])
    const monthlyLeaveAllowance = Number(employeeRow?.monthly_leave_allowance) || 0

    // Present/Leave were touched (most notably "Delete Record" clearing an adjustment back to
    // null) — recompute the live attendance-log value here so the client can show the real
    // number immediately, instead of needing a full page reload to see what's left once the
    // override is gone. Leave Deduction and Net Payable are recomputed alongside it since both
    // depend directly on the effective Present count (see computeLeaveDeduction).
    let attendance: { present: number; late: number; absent: number; leave: number } | undefined
    let leaveDeductionForResponse: number | undefined
    let leaveSurplusBonusForResponse: number | undefined
    let netPayableForResponse: number | undefined
    if ('attendance_present_override' in update || 'attendance_leave_override' in update) {
        const { rows: [sheet] } = await db.query(`SELECT month FROM salary_sheets WHERE id = $1`, [data.salary_sheet_id])
        if (sheet) {
            const stats = await getAttendanceStatsForMonth(db, [data.employee_id], sheet.month)
            const computed = stats[data.employee_id] || { present: 0, late: 0, absent: 0, leave: 0 }
            attendance = {
                ...computed,
                present: data.attendance_present_override ?? computed.present,
                leave: data.attendance_leave_override ?? computed.leave,
            }
            leaveDeductionForResponse = computeLeaveDeduction(Number(data.basic_salary) || 0, attendance.present, attendance.leave, monthlyLeaveAllowance, sheet.month)
            leaveSurplusBonusForResponse = computeLeaveSurplusBonus(Number(data.basic_salary) || 0, attendance.leave, monthlyLeaveAllowance, sheet.month)

            const employeeIds = [data.employee_id]
            const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails] = await Promise.all([
                getFineTotalsForMonth(db, employeeIds, sheet.month),
                getAdvanceDetailsForMonth(db, employeeIds, sheet.month),
                getProductBuyDetailsForMonth(db, employeeIds, sheet.month),
                getEmiLoanDetailsForMonth(db, employeeIds, sheet.month),
                getProvidentFundDetailsForMonth(db, employeeIds, sheet.month),
            ])
            netPayableForResponse = computeNetPayable(
                data,
                fineTotals[data.employee_id] || 0,
                advanceDetails[data.employee_id]?.total || 0,
                productBuyDetails[data.employee_id]?.total || 0,
                emiDetails[data.employee_id]?.total || 0,
                providentFundDetails[data.employee_id]?.total || 0,
                leaveDeductionForResponse,
                leaveSurplusBonusForResponse,
            )
        }
    }

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
            const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails, attendanceStats] = await Promise.all([
                getFineTotalsForMonth(db, employeeIds, sheet.month),
                getAdvanceDetailsForMonth(db, employeeIds, sheet.month),
                getProductBuyDetailsForMonth(db, employeeIds, sheet.month),
                getEmiLoanDetailsForMonth(db, employeeIds, sheet.month),
                getProvidentFundDetailsForMonth(db, employeeIds, sheet.month),
                getAttendanceStatsForMonth(db, employeeIds, sheet.month),
            ])
            // Same effective Present/Leave counts the Attendance (Day) column shows (override,
            // else computed) — the linked Finance expense amount must match Payable Salary exactly.
            const effectivePresent = data.attendance_present_override ?? (attendanceStats[data.employee_id]?.present || 0)
            const effectiveLeave = data.attendance_leave_override ?? (attendanceStats[data.employee_id]?.leave || 0)
            const leaveDeduction = computeLeaveDeduction(Number(data.basic_salary) || 0, effectivePresent, effectiveLeave, monthlyLeaveAllowance, sheet.month)
            const leaveSurplusBonus = computeLeaveSurplusBonus(Number(data.basic_salary) || 0, effectiveLeave, monthlyLeaveAllowance, sheet.month)
            const netPayable = computeNetPayable(
                data,
                fineTotals[data.employee_id] || 0,
                advanceDetails[data.employee_id]?.total || 0,
                productBuyDetails[data.employee_id]?.total || 0,
                emiDetails[data.employee_id]?.total || 0,
                providentFundDetails[data.employee_id]?.total || 0,
                leaveDeduction,
                leaveSurplusBonus,
            )

            // Paid Amount/Due Amount (see the Salary Sheet columns) must never contradict a
            // 'Paid' status — if this same request didn't already set a specific Paid Amount
            // (e.g. the quick "Mark as Paid" flow, which only ever sends payment_status), treat
            // the full Payable Salary as settled so Due Amount reads ৳0 instead of still
            // showing the whole payout outstanding under a green "Paid" badge.
            if (!('paid_amount' in update)) {
                await db.query(`UPDATE salary_entries SET paid_amount = $1 WHERE id = $2`, [netPayable, id])
                data.paid_amount = netPayable
            }

            // Paid on time (within the sheet's own month, or even early) → book the expense on
            // the actual date it was paid. Paid late (settled in a month after the one it's
            // for) → book it on the sheet month's last day instead, so a late August payout
            // still shows up as an August expense rather than leaking into whatever month it
            // was actually settled in.
            const paymentMonth = (data.payment_date || end).slice(0, 7)
            const isLatePayment = paymentMonth > sheet.month

            // If this entry already had money paid against it via one or more standalone
            // Partial Payment expenses (see the `partial_payment` block above) BEFORE this
            // request settled it, that money has already been booked in Finance Hub — the
            // synced settlement expense below must only cover the remaining top-up, not the
            // full Payable Salary again, or the payout would be double-counted. Only applies
            // the very first time an entry transitions into 'Paid' (isFirstTimePaid); a later
            // re-sync of an already-Paid entry (e.g. editing extra_duty afterwards) correctly
            // keeps using the full current netPayable, matching existing behavior.
            const isFirstTimePaid = oldRecord?.payment_status !== 'Paid'
            const alreadyPaidBeforeThisAction = isFirstTimePaid ? (Number(oldRecord?.paid_amount) || 0) : 0
            const salaryExpenseId = await createOrSyncSalaryExpense(db, {
                expenseId: data.expense_id,
                employeeId: data.employee_id,
                month: sheet.month,
                amount: Math.max(0, netPayable - alreadyPaidBeforeThisAction),
                date: isLatePayment ? end : (data.payment_date || end),
                submittedBy: auth.employee.id,
            })
            if (salaryExpenseId && salaryExpenseId !== data.expense_id) {
                await db.query(`UPDATE salary_entries SET expense_id = $1 WHERE id = $2`, [salaryExpenseId, id])
            }
        }
    }

    return NextResponse.json({
        success: true,
        paid_amount: Number(data.paid_amount) || 0,
        ...(attendance ? {
            attendance,
            attendance_present_override: data.attendance_present_override,
            attendance_leave_override: data.attendance_leave_override,
            leave_deduction: leaveDeductionForResponse,
            leave_surplus_bonus: leaveSurplusBonusForResponse,
            net_payable: netPayableForResponse,
        } : {}),
    })
}
