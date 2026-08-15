import { createAdminClient } from './supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

// Flat interest, split evenly across the term: Total repayment = Amount × (1 + rate/100),
// Monthly Installment = Total repayment ÷ term months. Same installment every month.
export function computeMonthlyInstallment(amount: number, interestRate: number, termMonths: number): number {
    const total = amount * (1 + (interestRate || 0) / 100)
    return total / termMonths
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
