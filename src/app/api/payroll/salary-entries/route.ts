import { requireAuth, isAuthed } from '@/lib/auth'
import { getMonthRangeFromString } from '@/lib/dateRange'
import { advanceToExpenseStatus } from '@/lib/advances'
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
// a month (Super Admin only). Employee/attendance/leave/fine fields are never accepted
// here — they're read-only, derived data that this route has no business touching.
export async function PUT(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Once an entry is marked Paid it's a settled payout — attempting to flip it back to
    // Unpaid (e.g. via a stale form still open after another update) is rejected here too,
    // not just hidden in the UI, since Paid triggers side effects (advance/product buy
    // settlement below) that don't have a matching "undo" on reversal.
    if (body.payment_status === 'Unpaid') {
        const { data: existing } = await supabase.from('salary_entries').select('payment_status').eq('id', id).maybeSingle()
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

    const { data, error } = await supabase
        .from('salary_entries')
        .update(update)
        .eq('id', id)
        .select(`
            id, employee_id, salary_sheet_id, expense_id, payment_date,
            basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus, other_deduction
        `)
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Salary entry not found' }, { status: 404 })

    // Marking the salary as Paid means that month's advance was recovered through this
    // payout, so settle any still-Unpaid advance records for that employee/month too — keeps
    // the Salary Sheet and Advance Management module in sync without a manual second step.
    // This whole block also re-runs on a later edit to an already-Paid entry (the form always
    // resends payment_status:'Paid' once it's locked in), which is exactly what's wanted for
    // re-syncing the linked salary Expense below if extra_duty/performance_bonus changes.
    if (update.payment_status === 'Paid') {
        const { data: sheet } = await supabase.from('salary_sheets').select('month').eq('id', data.salary_sheet_id).maybeSingle()
        if (sheet) {
            const { start, end } = getMonthRangeFromString(sheet.month)
            const { data: settledAdvances } = await supabase
                .from('advances')
                .update({ payment_status: 'Paid' })
                .eq('employee_id', data.employee_id)
                .eq('payment_status', 'Unpaid')
                .gte('advance_date', start)
                .lte('advance_date', end)
                .select('expense_id')

            // Mirror the settlement into each advance's linked Finance Hub Expense too, so
            // Total Expenses/Net Balance stay consistent with what Payroll just marked Paid.
            const expenseIds = (settledAdvances || []).map(a => a.expense_id).filter((x): x is string => !!x)
            if (expenseIds.length > 0) {
                await supabase
                    .from('expenses')
                    .update({ payment_status: advanceToExpenseStatus('Paid'), approved_by: auth.employee.id })
                    .in('id', expenseIds)
            }

            // Same settlement, mirrored for Product Buy — a separate deduction type/table
            // from Advance, so it's settled independently here. Product Buy no longer links
            // into Finance Hub Expenses (see src/lib/productBuys.ts), so this only updates the
            // product_buys row's own status, not a mirrored expense.
            await supabase
                .from('product_buys')
                .update({ payment_status: 'Paid' })
                .eq('employee_id', data.employee_id)
                .eq('payment_status', 'Unpaid')
                .gte('purchase_date', start)
                .lte('purchase_date', end)

            // Same again for Fines — Active, still-Unpaid fines count as "recovered through this
            // payout" (an Appealed or already-Waived fine isn't part of what
            // getFineTotalsForMonth deducted, so it has nothing to settle here). No lower bound
            // on created_at, matching getFineTotalsForMonth's own "rolls forward until paid"
            // rule — a fine from an earlier month that's still Unpaid was included in this
            // month's deduction too, so it needs to settle here, not just fines issued this
            // exact month.
            await supabase
                .from('fines')
                .update({ payment_status: 'Paid' })
                .eq('member_id', data.employee_id)
                .eq('status', 'Active')
                .eq('payment_status', 'Unpaid')
                .lte('created_at', `${end}T23:59:59`)

            // The payout itself also becomes a Finance Hub Expense (category "Employee
            // Salary", amount = Payable Salary) — same live deduction lookups the Salary Sheet
            // and Payroll Summary already use, so the linked amount can never drift from what
            // the sheet shows for this entry.
            const employeeIds = [data.employee_id]
            const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails] = await Promise.all([
                getFineTotalsForMonth(supabase, employeeIds, sheet.month),
                getAdvanceDetailsForMonth(supabase, employeeIds, sheet.month),
                getProductBuyDetailsForMonth(supabase, employeeIds, sheet.month),
                getEmiLoanDetailsForMonth(supabase, employeeIds, sheet.month),
                getProvidentFundDetailsForMonth(supabase, employeeIds, sheet.month),
            ])
            const netPayable = computeNetPayable(
                data,
                fineTotals[data.employee_id] || 0,
                advanceDetails[data.employee_id]?.total || 0,
                productBuyDetails[data.employee_id]?.total || 0,
                emiDetails[data.employee_id]?.total || 0,
                providentFundDetails[data.employee_id]?.total || 0,
            )

            const salaryExpenseId = await createOrSyncSalaryExpense(supabase, {
                expenseId: data.expense_id,
                employeeId: data.employee_id,
                month: sheet.month,
                amount: netPayable,
                date: data.payment_date,
                submittedBy: auth.employee.id,
            })
            if (salaryExpenseId && salaryExpenseId !== data.expense_id) {
                await supabase.from('salary_entries').update({ expense_id: salaryExpenseId }).eq('id', id)
            }
        }
    }

    return NextResponse.json({ success: true })
}
