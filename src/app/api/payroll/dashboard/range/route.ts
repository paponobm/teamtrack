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
// Total Employees is dynamic per the selected From/To range — the count of distinct employees
// who actually have a visible salary entry (Basic Salary Starting Month reached) somewhere in
// range, i.e. "how many people get paid this month/range," not the system's whole headcount.
// Summing each month's own count would double-count someone paid every month in the range, so
// it's a distinct-employee count instead — "how many people this range covers."
export async function GET(request: Request) {
    const auth = await requireAuth(2) // Super Admin only — salary data
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to || !MONTH_RE.test(from) || !MONTH_RE.test(to)) {
        return NextResponse.json({ error: 'from and to are required (YYYY-MM)' }, { status: 400 })
    }
    if (from > to) {
        return NextResponse.json({ error: 'from must not be after to' }, { status: 400 })
    }

    const { rows: sheetRows } = await db.query(
        `SELECT id, month FROM salary_sheets WHERE month >= $1 AND month <= $2 ORDER BY month ASC`,
        [from, to]
    )
    const distinctEmployeeIds = new Set<string>()

    let totalSalaryExpense = 0
    let paidEmployees = 0
    let paidAmount = 0
    let unpaidEmployees = 0
    let unpaidAmount = 0
    let totalBasicSalary = 0
    let totalBasicSalaryPaid = 0
    let totalBasicSalaryUnpaid = 0
    let totalTransportationBill = 0
    let totalTransportationBillPaid = 0
    let totalTransportationBillUnpaid = 0
    let totalSnacksBill = 0
    let totalSnacksBillPaid = 0
    let totalSnacksBillUnpaid = 0
    let totalExtraDuty = 0
    let totalExtraDutyPaid = 0
    let totalExtraDutyUnpaid = 0
    let totalPerformanceBonus = 0
    let totalPerformanceBonusPaid = 0
    let totalPerformanceBonusUnpaid = 0
    let totalFestivalBonus = 0
    let totalFestivalBonusPaid = 0
    let totalFestivalBonusUnpaid = 0
    let totalAdvance = 0
    let totalProductBuy = 0
    let totalLoan = 0
    let totalProvidentFund = 0
    let totalFine = 0

    for (const sheet of sheetRows) {
        const { rows: entries } = await db.query(
            `SELECT se.employee_id, se.basic_salary, se.extra_duty, se.transportation_bill, se.snacks_bill,
                se.performance_bonus, se.festival_bonus, se.other_deduction, se.payment_status,
                json_build_object('basic_salary_effective_month', e.basic_salary_effective_month) AS employee
             FROM salary_entries se LEFT JOIN employees e ON e.id = se.employee_id
             WHERE se.salary_sheet_id = $1`,
            [sheet.id]
        )

        // Same visibility rule as the Salary Sheet itself (see buildSheetResponse in
        // src/app/api/payroll/salary-sheets/route.ts): an employee whose Basic Salary Starting
        // Month isn't configured yet, or hasn't been reached by this sheet's month, doesn't
        // count here either.
        const rows = entries.filter(r => {
            const startMonth: string | null = r.employee?.basic_salary_effective_month || null
            return !!startMonth && sheet.month >= startMonth
        })
        if (rows.length === 0) continue

        const employeeIds = rows.map((r: { employee_id: string }) => r.employee_id)
        employeeIds.forEach((id: string) => distinctEmployeeIds.add(id))

        const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails] = await Promise.all([
            getFineTotalsForMonth(db, employeeIds, sheet.month),
            getAdvanceDetailsForMonth(db, employeeIds, sheet.month),
            getProductBuyDetailsForMonth(db, employeeIds, sheet.month),
            getEmiLoanDetailsForMonth(db, employeeIds, sheet.month),
            getProvidentFundDetailsForMonth(db, employeeIds, sheet.month),
        ])

        rows.forEach((r) => {
            const advance = advanceDetails[r.employee_id]?.total || 0
            const productBuy = productBuyDetails[r.employee_id]?.total || 0
            const loan = emiDetails[r.employee_id]?.total || 0
            const providentFund = providentFundDetails[r.employee_id]?.total || 0
            const fine = fineTotals[r.employee_id] || 0
            const net = computeNetPayable(r, fine, advance, productBuy, loan, providentFund)
            const isPaid = r.payment_status === 'Paid'

            // Basic Salary/Transportation Bill/Snacks Bill/Festival Bonus/Extra Duty/Performance
            // Bonus now total every entry regardless of payment status — each one's Paid/Unpaid
            // split moves into its own pair of counts instead of being folded into the total.
            if (Number(r.basic_salary) > 0) {
                totalBasicSalary += Number(r.basic_salary)
                if (isPaid) totalBasicSalaryPaid++; else totalBasicSalaryUnpaid++
            }
            if (Number(r.transportation_bill) > 0) {
                totalTransportationBill += Number(r.transportation_bill)
                if (isPaid) totalTransportationBillPaid++; else totalTransportationBillUnpaid++
            }
            if (Number(r.snacks_bill) > 0) {
                totalSnacksBill += Number(r.snacks_bill)
                if (isPaid) totalSnacksBillPaid++; else totalSnacksBillUnpaid++
            }
            if (Number(r.extra_duty) > 0) {
                totalExtraDuty += Number(r.extra_duty)
                if (isPaid) totalExtraDutyPaid++; else totalExtraDutyUnpaid++
            }
            if (Number(r.performance_bonus) > 0) {
                totalPerformanceBonus += Number(r.performance_bonus)
                if (isPaid) totalPerformanceBonusPaid++; else totalPerformanceBonusUnpaid++
            }
            if (Number(r.festival_bonus) > 0) {
                totalFestivalBonus += Number(r.festival_bonus)
                if (isPaid) totalFestivalBonusPaid++; else totalFestivalBonusUnpaid++
            }

            if (isPaid) {
                totalSalaryExpense += net
                paidEmployees++
                paidAmount += net
            } else {
                unpaidEmployees++
                unpaidAmount += net
            }

            // Salary Advance/Loan/Provident Fund/Product Buy/Monthly Fine are live-computed
            // from their own modules (not stored on the salary entry), so they've always
            // reflected the full paid+unpaid total already — no change needed here, and per
            // the request they don't get a Paid/Unpaid badge like the fields above do.
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
        totalBasicSalaryPaid,
        totalBasicSalaryUnpaid,
        totalTransportationBill,
        totalTransportationBillPaid,
        totalTransportationBillUnpaid,
        totalSnacksBill,
        totalSnacksBillPaid,
        totalSnacksBillUnpaid,
        totalExtraDuty,
        totalExtraDutyPaid,
        totalExtraDutyUnpaid,
        totalPerformanceBonus,
        totalPerformanceBonusPaid,
        totalPerformanceBonusUnpaid,
        totalFestivalBonus,
        totalFestivalBonusPaid,
        totalFestivalBonusUnpaid,
        totalAdvance,
        totalProductBuy,
        totalLoan,
        totalProvidentFund,
        totalFine,
    })
}
