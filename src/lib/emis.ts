import { createAdminClient } from './supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

function round2(n: number): number {
    return Math.round(n * 100) / 100
}

// Reducing-balance EMI (the standard bank/loan formula): EMI = P × [r(1+r)^n] / [(1+r)^n − 1],
// where P is the principal, r is the *monthly* rate derived from the annual interestRate
// (annual ÷ 12 ÷ 100), and n is termMonths. Interest each month accrues only on the balance
// still outstanding after prior payments — not on the original principal for every month — so
// as the loan is paid down, a growing share of each (constant) installment goes toward
// principal and a shrinking share toward interest. Replaces the old flat/simple-interest split
// (interest on the full original principal, spread evenly across every month regardless of how
// much had already been repaid), which overstated interest on partially-repaid balances.
// A 0% rate degenerates to an even principal-only split (P/n), matching what this formula
// converges to as r → 0 (avoids a 0/0 division at r = 0).
export function computeMonthlyInstallment(principal: number, annualInterestRate: number, termMonths: number): number {
    if (!principal || !termMonths) return 0
    const r = (annualInterestRate || 0) / 12 / 100
    if (r === 0) return round2(principal / termMonths)
    const factor = Math.pow(1 + r, termMonths)
    return round2(principal * (r * factor) / (factor - 1))
}

export interface EmiAmortizationRow {
    month: number
    openingPrincipal: number
    interest: number
    principalPayment: number
    installment: number
    closingPrincipal: number
}

// Full month-by-month reducing-balance breakdown of a single EMI: each month's interest is
// opening balance × monthly rate, the rest of that month's (constant) installment pays down
// principal, and the closing balance carries forward as next month's opening balance. The
// final month's principal payment is whatever balance is still outstanding (rather than the
// installment-minus-interest split used for every other month), so the loan always closes to
// exactly ৳0 — never a positive or negative leftover from rounding monthly_installment to 2
// decimals along the way.
export function computeEmiAmortizationSchedule(principal: number, annualInterestRate: number, termMonths: number): EmiAmortizationRow[] {
    const installment = computeMonthlyInstallment(principal, annualInterestRate, termMonths)
    const r = (annualInterestRate || 0) / 12 / 100
    const schedule: EmiAmortizationRow[] = []
    let balance = principal

    for (let month = 1; month <= termMonths; month++) {
        const opening = round2(balance)
        const interest = round2(opening * r)
        const isLast = month === termMonths
        const principalPayment = isLast ? opening : round2(installment - interest)
        const rowInstallment = isLast ? round2(principalPayment + interest) : installment
        balance = Math.max(0, round2(opening - principalPayment))
        schedule.push({ month, openingPrincipal: opening, interest, principalPayment, installment: rowInstallment, closingPrincipal: balance })
    }

    return schedule
}

// Total repayment (principal + interest) across the full term — summed from the exact
// amortization schedule above (not installment × termMonths), so it reflects the final
// installment's rounding correction instead of drifting a few paisa off the flat, 2-decimal
// per-month figure that's actually deducted from payroll every month.
export function computeTotalPayable(principal: number, annualInterestRate: number, termMonths: number): number {
    if (!principal || !termMonths) return 0
    return round2(computeEmiAmortizationSchedule(principal, annualInterestRate, termMonths).reduce((sum, row) => sum + row.installment, 0))
}

export const EMI_EXPENSE_CATEGORY = 'Employee Loan'

function buildEmiDescription(employeeName: string) {
    return `Loan to ${employeeName}`
}

// Creates the Expense row an EMI is mirrored into (category "Employee Loan") so the loan
// principal disbursed to the employee counts toward Finance Hub's Total Expenses/Net Balance
// — same pattern as createLinkedExpense in src/lib/advances.ts. The expense amount is the
// principal (the actual cash handed to the employee at disbursement), not the interest-
// inclusive repayment total. The company has already disbursed that principal the moment this
// EMI exists, so the linked expense is unconditionally 'paid' from creation — repayment
// (tracked installment-by-installment via getEmiPaidSummaries, live off the Salary Sheet's own
// Paid status) is a separate concern, surfaced as "Receiving Status" wherever this expense is
// shown (see /api/expenses), never by flipping this expense's own payment_status. Returns the
// new expense id, or null if the insert fails (EMI creation still proceeds — a missing linked
// expense is recoverable, a blocked EMI is not).
export async function createLinkedExpense(supabase: SupabaseClient, params: {
    employeeId: string
    amount: number
    date: string
    submittedBy: string
}): Promise<string | null> {
    const { data: employee } = await supabase.from('employees').select('name').eq('id', params.employeeId).maybeSingle()
    const employeeName = employee?.name || 'employee'

    const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
            date: params.date,
            category: EMI_EXPENSE_CATEGORY,
            description: buildEmiDescription(employeeName),
            amount: params.amount,
            payment_status: 'paid',
            submitted_by: params.submittedBy,
            approved_by: params.submittedBy,
        })
        .select('id')
        .single()

    if (error) return null
    return expense.id
}

// Keeps an EMI's linked expense in sync after an edit (amount/date/employee change).
export async function syncLinkedExpense(supabase: SupabaseClient, expenseId: string, params: {
    employeeId: string
    amount: number
    date: string
}) {
    const { data: employee } = await supabase.from('employees').select('name').eq('id', params.employeeId).maybeSingle()
    const employeeName = employee?.name || 'employee'

    await supabase
        .from('expenses')
        .update({
            date: params.date,
            description: buildEmiDescription(employeeName),
            amount: params.amount,
        })
        .eq('id', expenseId)
}

export async function deleteLinkedExpense(supabase: SupabaseClient, expenseId: string) {
    await supabase.from('expenses').delete().eq('id', expenseId)
}

export interface EmiRecord {
    id: string
    monthly_installment: number
    month_number: number // 1-based position within the term (1 = first month)
    term_months: number
}

export interface EmployeeEmiDetail {
    total: number
    records: EmiRecord[]
}

function monthKeyToIndex(month: string): number {
    const [y, m] = month.split('-').map(Number)
    return y * 12 + (m - 1)
}

function indexToMonthKey(index: number): string {
    const y = Math.floor(index / 12)
    const m = (index % 12) + 1
    return `${y}-${String(m).padStart(2, '0')}`
}

// Live-computed monthly Loan deduction for the Salary Sheet — sums every EMI's
// monthly_installment for employees whose EMI term (start_date's calendar month through
// start_date's month + term_months - 1) covers the requested month. Same "reuse, don't
// duplicate" pattern as getAdvanceDetailsForMonth/getProductBuyDetailsForMonth — the Salary
// Sheet's Loan column is never manually typed once an EMI exists for that employee/month.
export async function getEmiLoanDetailsForMonth(supabase: SupabaseClient, employeeIds: string[], month: string): Promise<Record<string, EmployeeEmiDetail>> {
    const details: Record<string, EmployeeEmiDetail> = {}
    employeeIds.forEach(id => { details[id] = { total: 0, records: [] } })
    if (employeeIds.length === 0) return details

    const { data } = await supabase
        .from('emis')
        .select('id, employee_id, start_date, term_months, monthly_installment')
        .in('employee_id', employeeIds)

    const targetIndex = monthKeyToIndex(month)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(data || []).forEach((r: any) => {
        const d = details[r.employee_id]
        if (!d) return
        const startIndex = monthKeyToIndex(String(r.start_date).slice(0, 7))
        const monthNumber = targetIndex - startIndex + 1
        if (monthNumber < 1 || monthNumber > r.term_months) return
        const installment = Number(r.monthly_installment) || 0
        d.total += installment
        d.records.push({ id: r.id, monthly_installment: installment, month_number: monthNumber, term_months: r.term_months })
    })
    return details
}

export interface EmiPaidSummary {
    total_payable: number
    paid: number
    due: number
    paid_installments: number
    total_installments: number
    remaining_installments: number
}

interface EmiForSummary {
    id: string
    employee_id: string
    start_date: string
    term_months: number
    amount: number
    interest_rate: number
    monthly_installment: number
}

// Paid/Due tracking for the Advance & EMI list — same pattern as
// getProvidentFundPaidSummaries (src/lib/providentFunds.ts): an installment counts as "paid"
// once that employee's salary_entries row for that calendar month is marked
// payment_status = 'Paid' (the same trigger the Salary Sheet's Mark-as-Paid flow already
// uses), reusing that existing mechanism instead of a separate payment ledger. Unlike
// Provident Fund, Total Payable here legitimately includes interest — EMI is a loan the
// employee repays in full via payroll, not a principal-only contribution.
export async function getEmiPaidSummaries(supabase: SupabaseClient, emiRecords: EmiForSummary[]): Promise<Record<string, EmiPaidSummary>> {
    const summaries: Record<string, EmiPaidSummary> = {}
    if (emiRecords.length === 0) return summaries

    // One batched lookup covering every month any record's term touches, rather than a
    // per-record query — the whole point of the batch is to avoid N+1 round trips here.
    let minIndex = Infinity
    let maxIndex = -Infinity
    const employeeIds = new Set<string>()
    emiRecords.forEach(r => {
        const startIndex = monthKeyToIndex(String(r.start_date).slice(0, 7))
        minIndex = Math.min(minIndex, startIndex)
        maxIndex = Math.max(maxIndex, startIndex + r.term_months - 1)
        employeeIds.add(r.employee_id)
    })
    const startMonth = indexToMonthKey(minIndex)
    const endMonth = indexToMonthKey(maxIndex)

    const { data: sheets } = await supabase
        .from('salary_sheets')
        .select('id, month')
        .gte('month', startMonth)
        .lte('month', endMonth)

    const sheetRows = sheets || []
    const sheetIds = sheetRows.map((s: { id: string }) => s.id)
    const sheetMonthById: Record<string, string> = {}
    sheetRows.forEach((s: { id: string; month: string }) => { sheetMonthById[s.id] = s.month })

    const paidMonthsByEmployee: Record<string, Set<string>> = {}
    if (sheetIds.length > 0 && employeeIds.size > 0) {
        const { data: entries } = await supabase
            .from('salary_entries')
            .select('employee_id, salary_sheet_id, payment_status')
            .in('salary_sheet_id', sheetIds)
            .in('employee_id', Array.from(employeeIds))
            .eq('payment_status', 'Paid')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(entries || []).forEach((e: any) => {
            const month = sheetMonthById[e.salary_sheet_id]
            if (!month) return
            if (!paidMonthsByEmployee[e.employee_id]) paidMonthsByEmployee[e.employee_id] = new Set()
            paidMonthsByEmployee[e.employee_id].add(month)
        })
    }

    emiRecords.forEach(r => {
        const startIndex = monthKeyToIndex(String(r.start_date).slice(0, 7))
        const installment = Number(r.monthly_installment) || 0
        // Total Payable is the exact formula result, not installment × term — that would
        // re-introduce rounding drift since monthly_installment is stored rounded to 2 decimals.
        const totalPayable = computeTotalPayable(Number(r.amount) || 0, Number(r.interest_rate) || 0, Number(r.term_months) || 0)
        const paidSet = paidMonthsByEmployee[r.employee_id] || new Set<string>()

        let paid = 0
        let paidInstallments = 0
        for (let i = 0; i < r.term_months; i++) {
            if (paidSet.has(indexToMonthKey(startIndex + i))) {
                paid += installment
                paidInstallments++
            }
        }

        summaries[r.id] = {
            total_payable: totalPayable,
            paid,
            due: totalPayable - paid,
            paid_installments: paidInstallments,
            total_installments: r.term_months,
            remaining_installments: r.term_months - paidInstallments,
        }
    })

    return summaries
}
