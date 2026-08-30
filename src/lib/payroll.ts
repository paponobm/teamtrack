import { getMonthRangeFromString } from './dateRange'
import type { Pool, PoolClient } from 'pg'

type Db = Pool | PoolClient

export interface EmployeeAttendanceStats {
    present: number
    late: number
    absent: number
    leave: number
}

// Reuses the exact same `attendance.status` values/rules the Attendance Report already
// uses (present/late/absent/leave, with "late" also counting toward "present") — see
// src/app/api/attendance/report/route.ts. Never a second/duplicate attendance system.
export async function getAttendanceStatsForMonth(db: Db, employeeIds: string[], month: string): Promise<Record<string, EmployeeAttendanceStats>> {
    const { start, end } = getMonthRangeFromString(month)
    const stats: Record<string, EmployeeAttendanceStats> = {}
    employeeIds.forEach(id => { stats[id] = { present: 0, late: 0, absent: 0, leave: 0 } })
    if (employeeIds.length === 0) return stats

    const { rows } = await db.query(
        `SELECT employee_id, status FROM attendance WHERE employee_id = ANY($1) AND date >= $2 AND date <= $3`,
        [employeeIds, start, end]
    )

    rows.forEach((r: { employee_id: string; status: string }) => {
        const s = stats[r.employee_id]
        if (!s) return
        if (r.status === 'present') s.present++
        else if (r.status === 'late') { s.present++; s.late++ }
        else if (r.status === 'absent') s.absent++
        else if (r.status === 'leave') s.leave++
    })
    return stats
}

// Only 'Active' fines count as a confirmed deduction — 'Waived' fines were forgiven and
// 'Appealed' ones are still under dispute, so neither should reduce pay. Reuses the
// existing `fines` table (see src/app/api/fines/route.ts) rather than a new one.
//
// Still-Unpaid fines roll forward into every month after the one they were issued in, not just
// their own — an August fine that's still Unpaid keeps counting against September, October,
// etc. until it's actually settled. Once settled, a fine keeps counting for every month up to
// and including settled_month (the month it was actually recovered in — set alongside
// payment_status='Paid', see the payroll settlement in
// src/app/api/payroll/salary-entries/route.ts and the manual toggle in
// src/app/api/fines/[id]/route.ts), then stops counting after that. This is deliberately NOT
// just "payment_status='Unpaid'" — that would make a fine vanish from its OWN settlement
// month's total the instant it's marked Paid (corrupting that month's already-computed Payable
// Salary/linked Expense), since settlement and this computation can happen in the same request.
export async function getFineTotalsForMonth(db: Db, employeeIds: string[], month: string): Promise<Record<string, number>> {
    const { end } = getMonthRangeFromString(month)
    const totals: Record<string, number> = {}
    employeeIds.forEach(id => { totals[id] = 0 })
    if (employeeIds.length === 0) return totals

    const { rows } = await db.query(
        `SELECT member_id, amount, payment_status, settled_month
         FROM fines
         WHERE member_id = ANY($1) AND status = 'Active' AND created_at <= $2`,
        [employeeIds, `${end}T23:59:59`]
    )

    rows.forEach((r: { member_id: string; amount: number; payment_status: string; settled_month: string | null }) => {
        const counts = r.payment_status === 'Unpaid' || (!!r.settled_month && r.settled_month >= month)
        if (!counts) return
        totals[r.member_id] = (totals[r.member_id] || 0) + Number(r.amount || 0)
    })
    return totals
}

export interface AdvanceRecord {
    date: string
    amount: number
}

export interface EmployeeAdvanceDetail {
    total: number
    records: AdvanceRecord[]
}

// Advance is no longer a manually-entered salary_entries field — it's computed live from the
// standalone `advances` table (Advance Management module), summed for the selected month.
// Same "reuse, don't duplicate" pattern as attendance/fines. Returns the per-record breakdown
// too, since the Salary Sheet shows a hover tooltip listing each advance date/amount.
export async function getAdvanceDetailsForMonth(db: Db, employeeIds: string[], month: string): Promise<Record<string, EmployeeAdvanceDetail>> {
    const { start, end } = getMonthRangeFromString(month)
    const details: Record<string, EmployeeAdvanceDetail> = {}
    employeeIds.forEach(id => { details[id] = { total: 0, records: [] } })
    if (employeeIds.length === 0) return details

    const { rows } = await db.query(
        `SELECT employee_id, amount, advance_date FROM advances
         WHERE employee_id = ANY($1) AND advance_date >= $2 AND advance_date <= $3
         ORDER BY advance_date ASC`,
        [employeeIds, start, end]
    )

    rows.forEach((r: { employee_id: string; amount: number; advance_date: string }) => {
        const d = details[r.employee_id]
        if (!d) return
        const amount = Number(r.amount) || 0
        d.total += amount
        d.records.push({ date: r.advance_date, amount })
    })
    return details
}

export interface SalaryAmounts {
    basic_salary: number
    extra_duty: number
    transportation_bill: number
    snacks_bill: number
    performance_bonus: number
    festival_bonus: number
    other_deduction: number
}

// Net Payable = Basic Salary + Extra Duty + Transportation Bill + Snacks Bill + Performance Bonus
// + Festival Bonus - Fine - Advance - Product Buy - Loan - Provident Fund - Other Deduction.
// The one place this formula lives — every API route imports it, so the dashboard totals
// and the salary sheet rows can never disagree with each other. Fine, Advance, Product Buy,
// Loan, and Provident Fund are all live-computed (never stored per salary entry), so they're
// passed in explicitly. Loan comes from active EMIs (src/lib/emis.ts), Provident Fund from
// active Provident Fund records (src/lib/providentFunds.ts) — neither is ever manually typed
// once the corresponding record exists for that employee/month.
export function computeNetPayable(entry: SalaryAmounts, fine: number, advance: number, productBuy: number, loan: number, providentFund: number): number {
    return (Number(entry.basic_salary) || 0)
        + (Number(entry.extra_duty) || 0)
        + (Number(entry.transportation_bill) || 0)
        + (Number(entry.snacks_bill) || 0)
        + (Number(entry.performance_bonus) || 0)
        + (Number(entry.festival_bonus) || 0)
        - fine
        - advance
        - productBuy
        - loan
        - providentFund
        - (Number(entry.other_deduction) || 0)
}

export const SALARY_EXPENSE_CATEGORY = 'Employee Salary'

// Mirrors a Paid salary entry into Finance Hub as a real Expense — same "linked expense"
// pattern as Advance/EMI (src/lib/advances.ts, src/lib/emis.ts), just always at 'paid' status
// since this only ever fires once a salary entry is Paid (it can't be reverted to Unpaid, see
// src/app/api/payroll/salary-entries/route.ts). Creates the expense the first time an entry is
// marked Paid; re-syncs the same expense (by expenseId) if a later edit changes the amount
// while it's already Paid, so the two never drift apart.
export async function createOrSyncSalaryExpense(db: Db, params: {
    expenseId: string | null
    employeeId: string
    month: string
    amount: number
    date: string | null
    submittedBy: string
}): Promise<string | null> {
    const { rows: [employee] } = await db.query(`SELECT name FROM employees WHERE id = $1`, [params.employeeId])
    const employeeName = employee?.name || 'employee'
    const date = params.date || new Date().toISOString().slice(0, 10)
    const description = `Salary for ${employeeName} - ${params.month}`

    if (params.expenseId) {
        await db.query(
            `UPDATE expenses SET date = $1, description = $2, amount = $3, payment_status = 'paid', approved_by = $4 WHERE id = $5`,
            [date, description, params.amount, params.submittedBy, params.expenseId]
        )
        return params.expenseId
    }

    try {
        const { rows: [expense] } = await db.query(
            `INSERT INTO expenses (date, category, description, amount, payment_status, submitted_by, approved_by)
             VALUES ($1, $2, $3, $4, 'paid', $5, $5) RETURNING id`,
            [date, SALARY_EXPENSE_CATEGORY, description, params.amount, params.submittedBy]
        )
        return expense.id
    } catch {
        return null
    }
}
