import { requireAuth, isAuthed } from '@/lib/auth'
import { getFineTotalsForMonth, getAdvanceDetailsForMonth, computeNetPayable } from '@/lib/payroll'
import { getProductBuyDetailsForMonth } from '@/lib/productBuys'
import { getEmiLoanDetailsForMonth } from '@/lib/emis'
import { getProvidentFundDetailsForMonth } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// All-time total of every Paid salary_entries row across every month a salary sheet has ever
// existed for — independent of the selected Month filter (the dashboard card built from this
// stays the same figure no matter which month is picked). Walks each sheet's own month to
// compute that month's live deductions (fine/advance/product buy/loan/provident fund) the same
// way the per-month total on /api/payroll/dashboard does, so a historical month's Paid total
// never drifts from what the Salary Sheet itself would show for that month.
async function getAllTimeSalaryExpense(supabase: SupabaseClient) {
    const { data: sheets } = await supabase.from('salary_sheets').select('id, month').order('month', { ascending: true })
    const sheetRows: { id: string; month: string }[] = sheets || []

    let total = 0
    let startMonth: string | null = null
    let endMonth: string | null = null

    for (const sheet of sheetRows) {
        const { data: entries } = await supabase
            .from('salary_entries')
            .select('employee_id, basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus, other_deduction, payment_status')
            .eq('salary_sheet_id', sheet.id)
            .eq('payment_status', 'Paid')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = entries || []
        if (rows.length === 0) continue

        const employeeIds = rows.map(r => r.employee_id)
        const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails] = await Promise.all([
            getFineTotalsForMonth(supabase, employeeIds, sheet.month),
            getAdvanceDetailsForMonth(supabase, employeeIds, sheet.month),
            getProductBuyDetailsForMonth(supabase, employeeIds, sheet.month),
            getEmiLoanDetailsForMonth(supabase, employeeIds, sheet.month),
            getProvidentFundDetailsForMonth(supabase, employeeIds, sheet.month),
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rows.forEach((r: any) => {
            const advance = advanceDetails[r.employee_id]?.total || 0
            const productBuy = productBuyDetails[r.employee_id]?.total || 0
            const loan = emiDetails[r.employee_id]?.total || 0
            const providentFund = providentFundDetails[r.employee_id]?.total || 0
            total += computeNetPayable(r, fineTotals[r.employee_id] || 0, advance, productBuy, loan, providentFund)
        })

        if (!startMonth || sheet.month < startMonth) startMonth = sheet.month
        if (!endMonth || sheet.month > endMonth) endMonth = sheet.month
    }

    return { totalSalaryExpense: total, salaryExpenseStartMonth: startMonth, salaryExpenseEndMonth: endMonth }
}

// GET /api/payroll/dashboard/salary-expense — the all-time running total of every Paid salary
// entry ever recorded (Super Admin only). Split out from /api/payroll/dashboard because this
// figure doesn't depend on the selected Month filter but is expensive to compute (walks every
// sheet ever created) — bundling it into the month-scoped endpoint meant every month switch
// re-ran this full-history scan and made the whole dashboard wait on it. The frontend fetches
// this once on mount instead of on every month change.
export async function GET() {
    const auth = await requireAuth(2) // Super Admin only — salary data
    if (!isAuthed(auth)) return auth

    const result = await getAllTimeSalaryExpense(auth.supabase)
    return NextResponse.json(result)
}
