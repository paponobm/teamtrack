import type { Pool, PoolClient } from 'pg'

type Db = Pool | PoolClient

// Unlike EMI (a loan, where interest is added on top of what's repaid), the employee's
// Provident Fund contribution — what's deducted from salary month to month (and therefore
// Paid/Due) — is their own principal only, split evenly across the duration. Interest never
// inflates the deduction/installment.
export function computeTotalPayable(principal: number): number {
    return principal
}

export function computeMonthlyInstallment(principal: number, durationMonths: number): number {
    return principal / durationMonths
}

// Total Amount is a *separate* figure from the above: what the employee ultimately receives
// back from the company at maturity — shown for reference only, with no bearing on Paid/Due,
// which track the principal-only deduction against payroll (computeMonthlyInstallment above).
//
// The contribution is a *recurring* monthly deposit (the same amount already deducted from
// salary each month), not a lump sum invested once on day one — so maturity value is the
// future value of that whole stream of monthly deposits compounding at the fund's interest
// rate, not a single flat interest add-on applied once to the full principal.
//
// Contributions are treated as landing at the END of the month they're deducted for: a given
// month's deduction only exists once that month's Salary Sheet entry is actually marked Paid
// (see getProvidentFundPaidSummaries below) — there's no beginning-of-month advance
// contribution anywhere in this flow — so this uses the ordinary-annuity future-value formula:
// FV = P × [((1+r)^n − 1) / r], where P is the monthly contribution, r is the monthly rate
// (annual interestRate ÷ 12 ÷ 100), and n is durationMonths. A 0% rate degenerates to
// FV = P × n = the total principal contributed, matching what the formula converges to as r → 0.
export function computeMaturityAmount(monthlyContribution: number, interestRate: number, durationMonths: number): number {
    if (!monthlyContribution || !durationMonths) return 0
    const r = (interestRate || 0) / 12 / 100
    if (r === 0) return monthlyContribution * durationMonths
    return monthlyContribution * ((Math.pow(1 + r, durationMonths) - 1) / r)
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

export interface ProvidentFundRecord {
    id: string
    monthly_installment: number
    month_number: number
    duration_months: number
}

export interface EmployeeProvidentFundDetail {
    total: number
    records: ProvidentFundRecord[]
}

// Live-computed monthly Provident Fund deduction for the Salary Sheet — same "reuse, don't
// duplicate" pattern as getEmiLoanDetailsForMonth: sums every record's monthly_installment
// for employees whose term (start_date's month through start_date's month + duration - 1)
// covers the requested month. Never manually typed once a Provident Fund record exists.
export async function getProvidentFundDetailsForMonth(db: Db, employeeIds: string[], month: string): Promise<Record<string, EmployeeProvidentFundDetail>> {
    const details: Record<string, EmployeeProvidentFundDetail> = {}
    employeeIds.forEach(id => { details[id] = { total: 0, records: [] } })
    if (employeeIds.length === 0) return details

    const { rows } = await db.query(
        `SELECT id, employee_id, start_date, duration_months, monthly_installment FROM provident_funds WHERE employee_id = ANY($1)`,
        [employeeIds]
    )

    const targetIndex = monthKeyToIndex(month)

    rows.forEach((r: { id: string; employee_id: string; start_date: string; duration_months: number; monthly_installment: number }) => {
        const d = details[r.employee_id]
        if (!d) return
        const startIndex = monthKeyToIndex(String(r.start_date).slice(0, 7))
        const monthNumber = targetIndex - startIndex + 1
        if (monthNumber < 1 || monthNumber > r.duration_months) return
        const installment = Number(r.monthly_installment) || 0
        d.total += installment
        d.records.push({ id: r.id, monthly_installment: installment, month_number: monthNumber, duration_months: r.duration_months })
    })
    return details
}

export interface ProvidentFundPaidSummary {
    total_payable: number
    total_amount: number
    paid: number
    due: number
    paid_installments: number
    total_installments: number
    remaining_installments: number
}

interface ProvidentFundForSummary {
    id: string
    employee_id: string
    start_date: string
    duration_months: number
    principal_amount: number
    interest_rate: number
    monthly_installment: number
}

// Paid/Due tracking deliberately reuses the Salary Sheet's own Paid mechanism instead of a
// separate payment ledger: an installment counts as "paid" once that employee's
// salary_entries row for that calendar month is marked payment_status = 'Paid' (the same
// trigger the Mark-as-Paid flow already uses) — no new payment-recording UI, matching the
// "reuse, don't duplicate" pattern used by Advance/Product Buy/EMI throughout Payroll.
export async function getProvidentFundPaidSummaries(db: Db, pfRecords: ProvidentFundForSummary[]): Promise<Record<string, ProvidentFundPaidSummary>> {
    const summaries: Record<string, ProvidentFundPaidSummary> = {}
    if (pfRecords.length === 0) return summaries

    // One batched lookup covering every month any record's term touches, rather than a
    // per-record query — the whole point of the batch is to avoid N+1 round trips here.
    let minIndex = Infinity
    let maxIndex = -Infinity
    const employeeIds = new Set<string>()
    pfRecords.forEach(r => {
        const startIndex = monthKeyToIndex(String(r.start_date).slice(0, 7))
        minIndex = Math.min(minIndex, startIndex)
        maxIndex = Math.max(maxIndex, startIndex + r.duration_months - 1)
        employeeIds.add(r.employee_id)
    })
    const startMonth = indexToMonthKey(minIndex)
    const endMonth = indexToMonthKey(maxIndex)

    const { rows: sheetRows } = await db.query(
        `SELECT id, month FROM salary_sheets WHERE month >= $1 AND month <= $2`,
        [startMonth, endMonth]
    )

    const sheetIds = sheetRows.map((s: { id: string }) => s.id)
    const sheetMonthById: Record<string, string> = {}
    sheetRows.forEach((s: { id: string; month: string }) => { sheetMonthById[s.id] = s.month })

    const paidMonthsByEmployee: Record<string, Set<string>> = {}
    if (sheetIds.length > 0 && employeeIds.size > 0) {
        const { rows: entries } = await db.query(
            `SELECT employee_id, salary_sheet_id FROM salary_entries
             WHERE salary_sheet_id = ANY($1) AND employee_id = ANY($2) AND payment_status = 'Paid'`,
            [sheetIds, Array.from(employeeIds)]
        )

        entries.forEach((e: { employee_id: string; salary_sheet_id: string }) => {
            const month = sheetMonthById[e.salary_sheet_id]
            if (!month) return
            if (!paidMonthsByEmployee[e.employee_id]) paidMonthsByEmployee[e.employee_id] = new Set()
            paidMonthsByEmployee[e.employee_id].add(month)
        })
    }

    pfRecords.forEach(r => {
        const startIndex = monthKeyToIndex(String(r.start_date).slice(0, 7))
        const installment = Number(r.monthly_installment) || 0
        // Total Payable is the employee's exact Provident Amount, not installment × duration
        // — that would re-introduce rounding drift, since monthly_installment is stored
        // rounded to 2 decimals (e.g. ৳8,333.33 × 12 = ৳99,999.96, not the actual ৳100,000).
        const totalPayable = Number(r.principal_amount) || 0
        const totalAmount = computeMaturityAmount(Number(r.monthly_installment) || 0, Number(r.interest_rate) || 0, Number(r.duration_months) || 0)
        const paidSet = paidMonthsByEmployee[r.employee_id] || new Set<string>()

        let paid = 0
        let paidInstallments = 0
        for (let i = 0; i < r.duration_months; i++) {
            if (paidSet.has(indexToMonthKey(startIndex + i))) {
                paid += installment
                paidInstallments++
            }
        }

        summaries[r.id] = {
            total_payable: totalPayable,
            total_amount: totalAmount,
            paid,
            due: totalPayable - paid,
            paid_installments: paidInstallments,
            total_installments: r.duration_months,
            remaining_installments: r.duration_months - paidInstallments,
        }
    })

    return summaries
}
