import { requireAuth, isAuthed } from '@/lib/auth'
import { getFineTotalsForMonth, getAdvanceDetailsForMonth, computeNetPayable } from '@/lib/payroll'
import { getProductBuyDetailsForMonth } from '@/lib/productBuys'
import { getEmiLoanDetailsForMonth } from '@/lib/emis'
import { getProvidentFundDetailsForMonth } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'

// GET /api/payroll/dashboard?month=YYYY-MM — monthly payroll summary (Super Admin only).
// Total Employees is scoped to this month: only employees actually visible on this month's
// Salary Sheet (Basic Salary Starting Month reached — same rule as buildSheetResponse in
// src/app/api/payroll/salary-sheets/route.ts) count, so it reads as "how many people get paid
// this month," not a static headcount. The money figures only exist once a salary sheet has
// been created for that month — until then they're 0 with sheetExists:false so the UI can
// prompt "Create Salary Sheet" instead of showing stale data.
// Total Salary Expense (the all-time running total) lives in its own endpoint — see
// /api/payroll/dashboard/salary-expense — since it's month-independent and expensive to compute
// (walks every sheet ever created), so it shouldn't be recomputed on every month switch here.
export async function GET(request: Request) {
    const auth = await requireAuth(2) // Super Admin only — salary data
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const month = new URL(request.url).searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 })

    const { data: sheet } = await supabase
        .from('salary_sheets')
        .select('id')
        .eq('month', month)
        .maybeSingle()

    if (!sheet) {
        return NextResponse.json({
            sheetExists: false,
            totalEmployees: 0,
            totalMonthExpense: 0,
            totalPayroll: 0,
            paidEmployees: 0,
            paidAmount: 0,
            unpaidEmployees: 0,
            unpaidAmount: 0,
            totalBasicSalary: 0,
            totalTransportationBill: 0,
            totalTransportationBillEmployees: 0,
            totalSnacksBill: 0,
            totalSnacksBillEmployees: 0,
            totalExtraDuty: 0,
            totalExtraDutyEmployees: 0,
            totalPerformanceBonus: 0,
            totalPerformanceBonusEmployees: 0,
            totalFestivalBonus: 0,
            totalFestivalBonusEmployees: 0,
            totalAdvance: 0,
            totalProductBuy: 0,
            totalLoan: 0,
            totalProvidentFund: 0,
            totalFine: 0,
        })
    }

    const { data: entries } = await supabase
        .from('salary_entries')
        .select(`
            employee_id, basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus, other_deduction, payment_status,
            employee:employees!employee_id(basic_salary_effective_month)
        `)
        .eq('salary_sheet_id', sheet.id)

    // Same visibility rule as the Salary Sheet itself (see buildSheetResponse in
    // src/app/api/payroll/salary-sheets/route.ts): an employee whose Basic Salary Starting
    // Month isn't configured yet, or hasn't been reached, doesn't count here either — otherwise
    // these totals (and Paid/Unpaid Employees) would include people invisible on the sheet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (entries || []).filter((r: any) => {
        const startMonth: string | null = r.employee?.basic_salary_effective_month || null
        return !!startMonth && month >= startMonth
    })
    const employeeIds = rows.map((r: { employee_id: string }) => r.employee_id)
    const [fineTotals, advanceDetails, productBuyDetails, emiDetails, providentFundDetails] = await Promise.all([
        getFineTotalsForMonth(supabase, employeeIds, month),
        getAdvanceDetailsForMonth(supabase, employeeIds, month),
        getProductBuyDetailsForMonth(supabase, employeeIds, month),
        getEmiLoanDetailsForMonth(supabase, employeeIds, month),
        getProvidentFundDetailsForMonth(supabase, employeeIds, month),
    ])

    // Total Payroll reflects money actually paid out this month, not the projected cost of
    // unpaid entries — it only grows as employees are marked Paid.
    let totalPayroll = 0
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

    rows.forEach(r => {
        const advance = advanceDetails[r.employee_id]?.total || 0
        const productBuy = productBuyDetails[r.employee_id]?.total || 0
        const loan = emiDetails[r.employee_id]?.total || 0
        const providentFund = providentFundDetails[r.employee_id]?.total || 0
        const fine = fineTotals[r.employee_id] || 0
        const net = computeNetPayable(r, fine, advance, productBuy, loan, providentFund)
        // Basic Salary/Transportation Bill/Snacks Bill/Festival Bonus/Extra Duty/Performance
        // Bonus totals (and counts) only include employees actually marked Paid this month —
        // an Unpaid entry hasn't been disbursed yet, so it shouldn't inflate these figures.
        if (r.payment_status === 'Paid') {
            totalBasicSalary += Number(r.basic_salary) || 0
            if (Number(r.transportation_bill) > 0) { totalTransportationBill += Number(r.transportation_bill); totalTransportationBillEmployees++ }
            if (Number(r.snacks_bill) > 0) { totalSnacksBill += Number(r.snacks_bill); totalSnacksBillEmployees++ }
            if (Number(r.extra_duty) > 0) { totalExtraDuty += Number(r.extra_duty); totalExtraDutyEmployees++ }
            if (Number(r.performance_bonus) > 0) { totalPerformanceBonus += Number(r.performance_bonus); totalPerformanceBonusEmployees++ }
            if (Number(r.festival_bonus) > 0) { totalFestivalBonus += Number(r.festival_bonus); totalFestivalBonusEmployees++ }
        }
        totalAdvance += advance
        totalProductBuy += productBuy
        totalLoan += loan
        totalProvidentFund += providentFund
        totalFine += fine
        if (r.payment_status === 'Paid') { paidEmployees++; paidAmount += net; totalPayroll += net }
        else { unpaidEmployees++; unpaidAmount += net }
    })

    return NextResponse.json({
        sheetExists: true,
        totalEmployees: rows.length,
        totalMonthExpense: paidAmount + unpaidAmount,
        totalPayroll,
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
