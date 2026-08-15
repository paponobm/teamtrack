import { requireAuth, isAuthed } from '@/lib/auth'
import { getMonthRangeFromString } from '@/lib/dateRange'
import { advanceToExpenseStatus } from '@/lib/advances'
import { productBuyToExpenseStatus } from '@/lib/productBuys'
import { NextResponse } from 'next/server'

// 'advance' is intentionally not editable here — it's computed live from the Advance
// Management module (see getAdvanceDetailsForMonth in src/lib/payroll.ts), same as 'fine'.
const NUMERIC_FIELDS = ['basic_salary', 'extra_duty', 'transportation_bill', 'snacks_bill', 'performance_bonus', 'festival_bonus', 'loan', 'other_deduction'] as const
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
        .select('id, employee_id, salary_sheet_id')
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Salary entry not found' }, { status: 404 })

    // Marking the salary as Paid means that month's advance was recovered through this
    // payout, so settle any still-Unpaid advance records for that employee/month too — keeps
    // the Salary Sheet and Advance Management module in sync without a manual second step.
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
            // from Advance, so it's settled and synced independently here.
            const { data: settledProductBuys } = await supabase
                .from('product_buys')
                .update({ payment_status: 'Paid' })
                .eq('employee_id', data.employee_id)
                .eq('payment_status', 'Unpaid')
                .gte('purchase_date', start)
                .lte('purchase_date', end)
                .select('expense_id')

            const productBuyExpenseIds = (settledProductBuys || []).map((p: { expense_id: string | null }) => p.expense_id).filter((x: string | null): x is string => !!x)
            if (productBuyExpenseIds.length > 0) {
                await supabase
                    .from('expenses')
                    .update({ payment_status: productBuyToExpenseStatus('Paid'), approved_by: auth.employee.id })
                    .in('id', productBuyExpenseIds)
            }
        }
    }

    return NextResponse.json({ success: true })
}
