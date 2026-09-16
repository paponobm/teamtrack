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

// Default paid Leave days per month, used only as a fallback for the rare row that predates
// the per-employee `employees.monthly_leave_allowance` column (which itself defaults to this
// same value, see the Prisma migration) — every employee normally has their own configurable
// allowance now (Members → Edit Member → Duty Schedule), not a single shared quota.
export const MONTHLY_FREE_LEAVE_DAYS = 4

// Standard payroll month length used for the per-day salary rate — a fixed 30 days every month
// (the usual payroll convention), not the calendar's actual 28-31, so the same Basic Salary
// docks the same amount per excess Leave day in February as it does in August.
export const STANDARD_MONTH_DAYS = 30

// The whole "Present-days-vs-required" leave system (per-employee Monthly Leave Allowance,
// Leave Surplus Bonus, real days-in-month) launched this month — applying it retroactively
// would silently change already-agreed, possibly already-Paid, historical salary sheets for
// months nobody asked to recompute. So it only applies to this cutover month and any month
// after it; every earlier sheet keeps computing Leave Deduction exactly as it always did
// (a flat, global 4-free-days-per-month rule based on Leave count alone, no per-employee
// allowance, no Present-day shortfall/absence docking, no surplus bonus at all) — see the
// `month < LEAVE_LOGIC_V2_CUTOVER_MONTH` branches below. Update this constant only if a future
// change should get its own new cutover, never move it backward.
export const LEAVE_LOGIC_V2_CUTOVER_MONTH = '2026-09'

export function usesPresentDayLeaveLogic(month: string): boolean {
    return month >= LEAVE_LOGIC_V2_CUTOVER_MONTH
}

// Same reasoning as LEAVE_LOGIC_V2_CUTOVER_MONTH above, for the Paid Amount/Due Amount/Partial
// Paid feature (paid_amount tracking, the Mark as Paid modal's Partial Payment tab, and the
// dashboard's paid/unpaid split by actual amount disbursed) — launched this month, so it only
// applies to sheets from this cutover month onward. An older month's sheet never had Paid
// Amount tracked against it (paid_amount defaults to 0 for every pre-existing row, see migration
// 20260916094833_salary_entries_paid_amount), so showing "Due Amount" or offering Partial
// Payment there would either be meaningless noise or, worse, silently misrepresent an
// already-settled historical payout as still owing money. Older sheets keep the original simple
// Paid/Non-Paid badge and single "Mark as Paid" action instead — see usesPaidAmountFeature call
// sites in SalarySheet.tsx.
export const PAID_AMOUNT_FEATURE_CUTOVER_MONTH = '2026-09'

export function usesPaidAmountFeature(month: string): boolean {
    return month >= PAID_AMOUNT_FEATURE_CUTOVER_MONTH
}

// Leave Deduction. From LEAVE_LOGIC_V2_CUTOVER_MONTH onward: Basic Salary is meant to cover
// (STANDARD_MONTH_DAYS - allowedLeaveDays) worked days every month — e.g. with a 4-day free
// Leave allowance, Basic Salary pays for 26 worked days out of a standard 30 (the other 4 being
// paid Leave), the SAME 26 whether that particular month is a 28-day February or a 31-day
// August. Any day short of that required count — whether it's an excess Leave day beyond the
// allowance, an unexcused Absence, or simply a day with no attendance record at all — is one day
// the employee neither worked nor was on approved paid Leave for, and gets docked at Basic
// Salary / STANDARD_MONTH_DAYS per short day (e.g. an employee who only shows up 25 of a 26-day
// requirement is docked (26-25) × Basic Salary/30 = one day's pay, regardless of whether that
// missing day shows up as Absent or as an extra Leave day — deliberately NOT limited to counting
// excess Leave alone, since an employee who's simply Absent shouldn't be paid in full either).
// Deliberately uses the same fixed STANDARD_MONTH_DAYS baseline as the per-day rate below (not
// the sheet's own actual calendar day count) — otherwise the same employee with the same
// allowance would have a different "required days" threshold in a 31-day month than in a 30-day
// one, silently docking an extra day's pay in every longer month for no real reason.
// Before the cutover: the original flat rule — only Leave days beyond a fixed
// MONTHLY_FREE_LEAVE_DAYS (never the per-employee allowance, which didn't exist yet) are
// docked, `presentDays` is ignored entirely, matching exactly what every already-created sheet
// for an earlier month was already computing before this feature existed.
// `presentDays`/`leaveDays` should be the same effective values shown in the Attendance (Day)
// column — attendance_present_override/attendance_leave_override when a Super Admin has set
// one, otherwise the live-computed count from the attendance log (see
// getAttendanceStatsForMonth and EditAttendanceModal in src/components/payroll/SalarySheet.tsx)
// — so this can never silently disagree with what the sheet displays. `month` is the sheet's own
// 'YYYY-MM', used only to pick which rule above applies. Kept to 2 decimal places (paisa), same
// precision every salary_entries amount column is stored at (Decimal(10,2)) — a per-day rate
// rarely divides evenly, so rounding to a whole taka here would silently over/under-charge the
// employee by a few paisa.
export function computeLeaveDeduction(basicSalary: number, presentDays: number, leaveDays: number, allowedLeaveDays: number, month: string): number {
    const rate = (Number(basicSalary) || 0) / STANDARD_MONTH_DAYS
    if (!usesPresentDayLeaveLogic(month)) {
        const excessLeave = leaveDays - MONTHLY_FREE_LEAVE_DAYS
        if (excessLeave <= 0) return 0
        return Math.round(excessLeave * rate * 100) / 100
    }
    const requiredWorkingDays = STANDARD_MONTH_DAYS - allowedLeaveDays
    const shortfall = requiredWorkingDays - presentDays
    if (shortfall <= 0) return 0
    return Math.round(shortfall * rate * 100) / 100
}

// Leave Surplus Bonus: the flip side of Leave Deduction, and entirely new as of
// LEAVE_LOGIC_V2_CUTOVER_MONTH — no equivalent existed before, so any earlier month always
// returns 0 here, same as if the feature had simply never been applied to that sheet. From the
// cutover onward: an employee who takes FEWER Leave days than their monthly allowance is
// credited one day's pay (Basic Salary / STANDARD_MONTH_DAYS) for each such day given up — e.g.
// an 8-day-allowance employee who only takes 7 Leave days gets 1 day's bonus, regardless of the
// actual calendar month length or how many of the remaining days were genuinely worked vs.
// Absent (Absences are already docked separately by Leave Deduction's present-vs-required check
// above — deliberately NOT re-derived from presentDays here, since doing so would tie this bonus
// to the sheet month's actual day count and silently hand out an extra "free" bonus day in every
// 31-day month purely from the calendar being longer than the STANDARD_MONTH_DAYS baseline, even
// for an employee who used their leave exactly down to the allowance and did nothing "extra").
// Shown as an addition to Extra Duty on the sheet (see SalarySheet.tsx), but deliberately kept as
// its own separate live-computed value rather than being merged into the stored `extra_duty`
// column itself — that column is also a manually-typed admin field (real extra-duty work), and
// baking a live-computed bonus into it would double-count on the next edit/save round-trip.
// `leaveDays` should be the same effective value shown in the Attendance (Day) column
// (attendance_leave_override when set, otherwise the live-computed count) — same rule
// computeLeaveDeduction's `leaveDays` param already follows.
export function computeLeaveSurplusBonus(basicSalary: number, leaveDays: number, allowedLeaveDays: number, month: string): number {
    if (!usesPresentDayLeaveLogic(month)) return 0
    const surplus = allowedLeaveDays - leaveDays
    if (surplus <= 0) return 0
    const perDayRate = (Number(basicSalary) || 0) / STANDARD_MONTH_DAYS
    return Math.round(surplus * perDayRate * 100) / 100
}

// Net Payable = Basic Salary + Extra Duty + Leave Surplus Bonus + Transportation Bill + Snacks
// Bill + Performance Bonus + Festival Bonus - Fine - Advance - Product Buy - Loan - Provident
// Fund - Leave Deduction - Other Deduction. The one place this formula lives — every API route
// imports it, so the dashboard totals and the salary sheet rows can never disagree with each
// other. Fine, Advance, Product Buy, Loan, Provident Fund, Leave Deduction, and Leave Surplus
// Bonus are all live-computed (never stored per salary entry), so they're passed in explicitly.
// Loan comes from active EMIs (src/lib/emis.ts), Provident Fund from active Provident Fund
// records (src/lib/providentFunds.ts) — neither is ever manually typed once the corresponding
// record exists for that employee/month. leaveDeduction/leaveSurplusBonus default to 0 so older
// callers that haven't been updated yet don't silently break.
export function computeNetPayable(entry: SalaryAmounts, fine: number, advance: number, productBuy: number, loan: number, providentFund: number, leaveDeduction: number = 0, leaveSurplusBonus: number = 0): number {
    return (Number(entry.basic_salary) || 0)
        + (Number(entry.extra_duty) || 0)
        + leaveSurplusBonus
        + (Number(entry.transportation_bill) || 0)
        + (Number(entry.snacks_bill) || 0)
        + (Number(entry.performance_bonus) || 0)
        + (Number(entry.festival_bonus) || 0)
        - fine
        - advance
        - productBuy
        - loan
        - providentFund
        - leaveDeduction
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
