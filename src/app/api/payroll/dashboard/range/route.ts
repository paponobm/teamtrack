import { requireAuth, isAuthed } from '@/lib/auth'
import { getFineTotalsForMonth, getAdvanceDetailsForMonth, computeNetPayable } from '@/lib/payroll'
import { getProductBuyDetailsForMonth } from '@/lib/productBuys'
import { getEmiLoanDetailsForMonth } from '@/lib/emis'
import { getProvidentFundDetailsForMonth } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'

const MONTH_RE = /^\d{4}-\d{2}$/

// GET /api/payroll/dashboard/range?from=YYYY-MM&to=YYYY-MM — Payroll Summary cards, combined
// across every salary sheet whose month falls within [from, to] (Super Admin only). Replaces
// the old single-month /api/payroll/dashboard + all-time /api/payroll/dashboard/salary-expense
// pair now that the summary cards have their own From/To range filter (separate from the Salary
// Sheet table's single Month filter below them) — a single month is just a range where from===to,
// so one endpoint covers both cases.
//
// Each sheet in range is walked with the exact same per-sheet logic the old single-month route
// used (same visibility rule, same live deduction lookups, same computeNetPayable formula),
// just accumulated across every sheet instead of one — so a given month's contribution here
// never drifts from what the Salary Sheet itself shows for that month.
//
// Total Employees is the one field that isn't a straight sum: summing each month's visible-
// employee count would double-count someone paid every month in the range, so it's the count of
// distinct employees who appear on any sheet in range instead — "how many people this range
// covers," not "how many employee-months."
export async function GET(request: Request) {
    const auth = await requireAuth(2) // Super Admin only — salary data
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to || !MONTH_RE.test(from) || !MONTH_RE.test(to)) {
        return NextResponse.json({ error: 'from and to are required (YYYY-MM)' }, { status: 400 })
    }
    if (from > to) {
        return NextResponse.json({ error: 'from must not be after to' }, { status: 400 })
    }

    const { data: sheets } = await supabase
        .from('salary_sheets')
        .select('id, month')
        .gte('month', from)
        .lte('month', to)
        .order('month', { ascending: true })
    const sheetRows: { id: string; month: string }[] = sheets || []

    let totalSalaryExpense = 0
    let paidEmployees = 0
    let paidAmount = 0
    let unpaidEmployees = 0
    let unpaidAmount = 0
    let totalBasicSalary = 0
    let totalTransportationBill = 0
    let totalTransportationBillEmployees = 0
    let totalSnacksBill = 0
    let totalSnacksBillEmployees = 0
    let totalExtraDuty = 0
    let totalExtraDutyEmployees = 0
    let totalPerformanceBonus = 0
    let totalPerformanceBonusEmployees = 0
    let totalFestivalBonus = 0
    let totalFestivalBonusEmployees = 0
    let totalAdvance = 0
    let totalProductBuy = 0
    let totalLoan = 0
    let totalProvidentFund = 0
    let totalFine = 0
    const distinctEmployeeIds = new Set<string>()

    for (const sheet of sheetRows) {
        const { data: entries } = await supabase
            .from('salary_entries')
            .select(`
                employee_id, basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus, other_deduction, payment_status,
                employee:employees!employee_id(basic_salary_effective_month)
            `)
            .eq('salary_sheet_id', sheet.id)

        // Same visibility rule as the Salary Sheet itself (see buildSheetResponse in
        // src/app/api/payroll/salary-sheets/route.ts): an employee whose Basic Salary Starting
        // Month isn't configured yet, or hasn't been reached by this sheet's month, doesn't
        // count here either.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = (entries || []).filter((r: any) => {
            const startMonth: string | null = r.employee?.basic_salary_effective_month || null
            return !!startMonth && sheet.month >= startMonth
        })
        if (rows.length === 0) continue

        const employeeIds = rows.map((r: { employee_id: string }) => r.employee_id)
        employeeIds.forEach((id: string) => distinctEmployeeIds.add(id))

        const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails] = await Promise.all([
            getFineTotalsForMonth(supabase, employeeIds, sheet.month),
            getAdvanceDetailsForMonth(supabase, employeeIds, sheet.month),
            getProductBuyDetailsForMonth(supabase, employeeIds, sheet.month),
            getEmiLoanDetailsForMonth(supabase, employeeIds, sheet.month),
            getProvidentFundDetailsForMonth(supabase, employeeIds, sheet.month),
        ])

        rows.forEach((r) => {
            const advance = advanceDetails[r.employee_id]?.total || 0
            const productBuy = productBuyDetails[r.employee_id]?.total || 0
            const loan = emiDetails[r.employee_id]?.total || 0
            const providentFund = providentFundDetails[r.employee_id]?.total || 0
            const fine = fineTotals[r.employee_id] || 0
            const net = computeNetPayable(r, fine, advance, productBuy, loan, providentFund)

            if (r.payment_status === 'Paid') {
                totalSalaryExpense += net
                totalBasicSalary += Number(r.basic_salary) || 0
                if (Number(r.transportation_bill) > 0) { totalTransportationBill += Number(r.transportation_bill); totalTransportationBillEmployees++ }
                if (Number(r.snacks_bill) > 0) { totalSnacksBill += Number(r.snacks_bill); totalSnacksBillEmployees++ }
                if (Number(r.extra_duty) > 0) { totalExtraDuty += Number(r.extra_duty); totalExtraDutyEmployees++ }
                if (Number(r.performance_bonus) > 0) { totalPerformanceBonus += Number(r.performance_bonus); totalPerformanceBonusEmployees++ }
                if (Number(r.festival_bonus) > 0) { totalFestivalBonus += Number(r.festival_bonus); totalFestivalBonusEmployees++ }
                paidEmployees++
                paidAmount += net
            } else {
                unpaidEmployees++
                unpaidAmount += net
            }

            totalAdvance += advance
            totalProductBuy += productBuy
            totalLoan += loan
            totalProvidentFund += providentFund
            totalFine += fine
        })
    }

    return NextResponse.json({
        from,
        to,
        sheetCount: sheetRows.length,
        totalEmployees: distinctEmployeeIds.size,
        totalSalaryExpense,
        totalMonthExpense: paidAmount + unpaidAmount,
        paidEmployees,
        paidAmount,
        unpaidEmployees,
        unpaidAmount,
        totalBasicSalary,
        totalTransportationBill,
        totalTransportationBillEmployees,
        totalSnacksBill,
        totalSnacksBillEmployees,
        totalExtraDuty,
        totalExtraDutyEmployees,
        totalPerformanceBonus,
        totalPerformanceBonusEmployees,
        totalFestivalBonus,
        totalFestivalBonusEmployees,
        totalAdvance,
        totalProductBuy,
        totalLoan,
        totalProvidentFund,
        totalFine,
    })
}
