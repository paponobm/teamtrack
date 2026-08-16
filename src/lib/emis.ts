import { createAdminClient } from './supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

// Flat interest, split evenly across the term: Total repayment = Amount × (1 + rate/100),
// Monthly Installment = Total repayment ÷ term months. Same installment every month.
export function computeTotalPayable(amount: number, interestRate: number): number {
    return amount * (1 + (interestRate || 0) / 100)
}

export function computeMonthlyInstallment(amount: number, interestRate: number, termMonths: number): number {
    return computeTotalPayable(amount, interestRate) / termMonths
}

export const EMI_EXPENSE_CATEGORY = 'Employee Loan'

function buildEmiDescription(employeeName: string) {
    return `Loan to ${employeeName}`
}

// Creates the Expense row an EMI is mirrored into (category "Employee Loan") so the loan
// principal disbursed to the employee counts toward Finance Hub's Total Expenses/Net Balance
// — same pattern as createLinkedExpense in src/lib/advances.ts. The expense amount is the
// principal (the actual cash handed to the employee at disbursement), not the interest-
// inclusive repayment total. Unlike Advance, EMI has no payment_status of its own to mirror,
// so the linked expense is simply left 'pending' (the loan is outstanding) — repayment happens
// via the Salary Sheet's live Loan deduction, not a status flip here. Returns the new expense
// id, or null if the insert fails (EMI creation still proceeds — a missing linked expense is
// recoverable, a blocked EMI is not).
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
            payment_status: 'pending',
            submitted_by: params.submittedBy,
            approved_by: null,
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
        const totalPayable = computeTotalPayable(Number(r.amount) || 0, Number(r.interest_rate) || 0)
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
