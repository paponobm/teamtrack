import { requireAuth, isAuthed } from '@/lib/auth'
import { getAttendanceStatsForMonth, getFineTotalsForMonth, getAdvanceDetailsForMonth, computeNetPayable } from '@/lib/payroll'
import { getProductBuyDetailsForMonth } from '@/lib/productBuys'
import { getEmiLoanDetailsForMonth } from '@/lib/emis'
import { getProvidentFundDetailsForMonth } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'
import type { Pool, PoolClient } from 'pg'

type Db = Pool | PoolClient

interface EmployeePayrollFields {
    id: string
    payroll_basic_salary: number
    payroll_transportation_bill: number
    payroll_snacks_bill: number
    basic_salary_effective_month: string | null
    festival_bonus_percentage: number
    festival_bonus_months: number[]
    salary_increment_amount: number
    salary_increment_effective_month: string | null
}

// Builds one salary_entries insert row from an employee's saved payroll defaults for a given
// sheet month. Shared by initial sheet creation and the backfill sync below so both paths
// apply Basic Salary Starting Month / Salary Increment / Festival Bonus identically. An
// employee whose Basic Salary Starting Month hasn't been configured yet (still empty) is
// treated as not-yet-active — basic_salary computes to ৳0 here, and buildSheetResponse below
// hides the row entirely until a starting month is set and reached.
function buildSeedRow(sheetId: string, month: string, e: EmployeePayrollFields) {
    const monthNumber = Number(month.split('-')[1])
    const baseBasicSalary = Number(e.payroll_basic_salary) || 0
    const basicSalaryStartMonth: string | null = e.basic_salary_effective_month || null
    const basicSalaryActive = !!basicSalaryStartMonth && month >= basicSalaryStartMonth
    const incrementAmount = Number(e.salary_increment_amount) || 0
    const incrementEffectiveMonth: string | null = e.salary_increment_effective_month || null
    const incrementActive = basicSalaryActive && !!incrementEffectiveMonth && month >= incrementEffectiveMonth
    const basicSalary = (basicSalaryActive ? baseBasicSalary : 0) + (incrementActive ? incrementAmount : 0)
    const bonusMonths: number[] = e.festival_bonus_months || []
    const festivalBonus = bonusMonths.includes(monthNumber)
        ? basicSalary * ((Number(e.festival_bonus_percentage) || 0) / 100)
        : 0
    return {
        salary_sheet_id: sheetId,
        employee_id: e.id,
        basic_salary: basicSalary,
        transportation_bill: Number(e.payroll_transportation_bill) || 0,
        snacks_bill: Number(e.payroll_snacks_bill) || 0,
        festival_bonus: festivalBonus,
    }
}

const EMPLOYEE_PAYROLL_FIELDS = 'id, payroll_basic_salary, payroll_transportation_bill, payroll_snacks_bill, basic_salary_effective_month, festival_bonus_percentage, festival_bonus_months, salary_increment_amount, salary_increment_effective_month'

// Adds a salary_entries row for any currently-active employee who doesn't have one yet on
// this sheet — covers members added (or reactivated) after the sheet was first created, who
// would otherwise never appear on it. Safe to call every time the sheet is loaded: employees
// already on the sheet are left untouched (their row stays frozen as-is).
async function syncNewEmployeesIntoSheet(db: Db, sheetId: string, month: string) {
    const [{ rows: existingEntries }, { rows: activeEmployees }] = await Promise.all([
        db.query(`SELECT employee_id FROM salary_entries WHERE salary_sheet_id = $1`, [sheetId]),
        db.query(`SELECT ${EMPLOYEE_PAYROLL_FIELDS} FROM employees WHERE is_active = true`),
    ])

    const existingIds = new Set(existingEntries.map((r: { employee_id: string }) => r.employee_id))
    const missing = (activeEmployees as EmployeePayrollFields[]).filter(e => !existingIds.has(e.id))
    if (missing.length === 0) return

    const rows = missing.map(e => buildSeedRow(sheetId, month, e))
    for (const row of rows) {
        await db.query(
            `INSERT INTO salary_entries (salary_sheet_id, employee_id, basic_salary, transportation_bill, snacks_bill, festival_bonus)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [row.salary_sheet_id, row.employee_id, row.basic_salary, row.transportation_bill, row.snacks_bill, row.festival_bonus]
        )
    }
}

// Refreshes Basic Salary/Transportation Bill/Snacks Bill/Festival Bonus on any still-Unpaid
// entry from the employee's *current* payroll settings (Members → Edit Member → Payroll /
// Festival Bonus tabs) — so editing Basic Salary, Salary Increment, or Festival Bonus shows up
// on an already-created month's sheet right away, instead of staying stuck at whatever value
// was seeded when the sheet was first created. Reuses buildSeedRow so the recomputed value is
// always identical to what a brand-new row would get. Once an entry is marked Paid it's a
// historical record of what was actually paid and is never touched here again.
async function syncUnpaidEntriesWithEmployeeDefaults(db: Db, sheetId: string, month: string) {
    const { rows } = await db.query(
        `SELECT id, employee_id, basic_salary, transportation_bill, snacks_bill, festival_bonus
         FROM salary_entries WHERE salary_sheet_id = $1 AND payment_status = 'Unpaid'`,
        [sheetId]
    )

    if (rows.length === 0) return

    const employeeIds = rows.map((r: { employee_id: string }) => r.employee_id)
    const { rows: employees } = await db.query(
        `SELECT ${EMPLOYEE_PAYROLL_FIELDS} FROM employees WHERE id = ANY($1)`,
        [employeeIds]
    )

    const employeeById: Record<string, EmployeePayrollFields> = {}
    ;(employees as EmployeePayrollFields[]).forEach(e => { employeeById[e.id] = e })

    for (const r of rows) {
        const e = employeeById[r.employee_id]
        if (!e) continue
        const seeded = buildSeedRow(sheetId, month, e)
        const changed = Number(r.basic_salary) !== seeded.basic_salary
            || Number(r.transportation_bill) !== seeded.transportation_bill
            || Number(r.snacks_bill) !== seeded.snacks_bill
            || Number(r.festival_bonus) !== seeded.festival_bonus
        if (!changed) continue

        await db.query(
            `UPDATE salary_entries SET basic_salary = $1, transportation_bill = $2, snacks_bill = $3, festival_bonus = $4 WHERE id = $5`,
            [seeded.basic_salary, seeded.transportation_bill, seeded.snacks_bill, seeded.festival_bonus, r.id]
        )
    }
}

// Shared by GET and POST — fetches a sheet's entries joined with employee info, plus the
// live-computed attendance/fine numbers and derived net_payable for each row.
async function buildSheetResponse(db: Db, sheetId: string, month: string) {
    const { rows: entries } = await db.query(
        `SELECT se.id, se.employee_id, se.basic_salary, se.extra_duty, se.transportation_bill, se.snacks_bill,
            se.performance_bonus, se.festival_bonus, se.other_deduction, se.payment_status, se.payment_method,
            se.payment_date, se.updated_at,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url,
                'joining_date', e.joining_date, 'festival_bonus_percentage', e.festival_bonus_percentage,
                'basic_salary_effective_month', e.basic_salary_effective_month,
                'department', json_build_object('id', d.id, 'name', d.name)) AS employee
         FROM salary_entries se
         LEFT JOIN employees e ON e.id = se.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE se.salary_sheet_id = $1
         ORDER BY e.sort_order ASC NULLS LAST, se.updated_at ASC`,
        [sheetId]
    )

    // An employee is only shown on a sheet once their Basic Salary Starting Month is actually
    // configured (Members → Edit Member → Payroll tab) and this sheet's month has reached it —
    // an employee whose payroll hasn't been set up yet (still empty) or whose start month is
    // still in the future is left off the sheet entirely, not shown with ৳0. Filtered here (not
    // at insert time) so it also self-corrects rows already created before this was configured.
    const rows = entries.filter(r => {
        const startMonth: string | null = r.employee?.basic_salary_effective_month || null
        return !!startMonth && month >= startMonth
    })
    const employeeIds = rows.map((r: { employee_id: string }) => r.employee_id)
    const [attendance, fines, advances, productBuys, emis, providentFunds] = await Promise.all([
        getAttendanceStatsForMonth(db, employeeIds, month),
        getFineTotalsForMonth(db, employeeIds, month),
        getAdvanceDetailsForMonth(db, employeeIds, month),
        getProductBuyDetailsForMonth(db, employeeIds, month),
        getEmiLoanDetailsForMonth(db, employeeIds, month),
        getProvidentFundDetailsForMonth(db, employeeIds, month),
    ])

    return rows.map(r => {
        const fine = fines[r.employee_id] || 0
        const advanceDetail = advances[r.employee_id] || { total: 0, records: [] }
        const productBuyDetail = productBuys[r.employee_id] || { total: 0, records: [] }
        const emiDetail = emis[r.employee_id] || { total: 0, records: [] }
        const providentFundDetail = providentFunds[r.employee_id] || { total: 0, records: [] }
        return {
            id: r.id,
            employee_id: r.employee_id,
            employee: {
                id: r.employee?.id,
                name: r.employee?.name,
                employee_id: r.employee?.employee_id,
                avatar_url: r.employee?.avatar_url,
                joining_date: r.employee?.joining_date || null,
                department: r.employee?.department?.name || null,
            },
            basic_salary: Number(r.basic_salary) || 0,
            extra_duty: Number(r.extra_duty) || 0,
            transportation_bill: Number(r.transportation_bill) || 0,
            snacks_bill: Number(r.snacks_bill) || 0,
            performance_bonus: Number(r.performance_bonus) || 0,
            festival_bonus: Number(r.festival_bonus) || 0,
            // The employee's *current* configured percentage (Members → Edit Member →
            // Festival Bonus) — shown next to the amount for reference. The frozen
            // festival_bonus amount above doesn't change if this is edited later, so on an
            // older sheet these two can legitimately show a different rate than the amount.
            festival_bonus_percentage: Number(r.employee?.festival_bonus_percentage) || 0,
            advance: advanceDetail.total,
            advance_records: advanceDetail.records,
            product_buy: productBuyDetail.total,
            product_buy_records: productBuyDetail.records,
            loan: emiDetail.total,
            loan_records: emiDetail.records,
            provident_fund: providentFundDetail.total,
            provident_fund_records: providentFundDetail.records,
            other_deduction: Number(r.other_deduction) || 0,
            payment_status: r.payment_status,
            payment_method: r.payment_method,
            payment_date: r.payment_date,
            attendance: attendance[r.employee_id] || { present: 0, late: 0, absent: 0, leave: 0 },
            fine,
            net_payable: computeNetPayable(r, fine, advanceDetail.total, productBuyDetail.total, emiDetail.total, providentFundDetail.total),
            updated_at: r.updated_at,
        }
    })
}

// GET /api/payroll/salary-sheets?month=YYYY-MM (Super Admin only)
export async function GET(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const month = new URL(request.url).searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 })

    const { rows: [sheet] } = await db.query(`SELECT id, month, created_at FROM salary_sheets WHERE month = $1`, [month])

    if (!sheet) return NextResponse.json({ sheet: null, entries: [] })

    try {
        // Backfills any employee added/reactivated after this sheet already existed, so a
        // newly-added member with a Basic Salary Starting Month shows up as soon as this
        // month's sheet is next viewed, without needing to recreate the sheet.
        await syncNewEmployeesIntoSheet(db, sheet.id, month)
        // Refreshes still-Unpaid rows from each employee's current payroll settings.
        await syncUnpaidEntriesWithEmployeeDefaults(db, sheet.id, month)
        const entries = await buildSheetResponse(db, sheet.id, month)
        return NextResponse.json({ sheet, entries })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load salary sheet' }, { status: 500 })
    }
}

// POST /api/payroll/salary-sheets — create this month's sheet from current active
// employees (Super Admin only). Idempotent: if a sheet already exists for the month, just
// returns it as-is rather than erroring, so the "Create Salary Sheet" button is always safe
// to click. Never overwrites another month's sheet — each month is its own row.
export async function POST(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const month: string = body.month
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: 'month is required in YYYY-MM format' }, { status: 400 })
    }

    const { rows: [existing] } = await db.query(`SELECT id, month, created_at FROM salary_sheets WHERE month = $1`, [month])
    if (existing) {
        try {
            // Backfills any employee added/reactivated after this sheet was first created —
            // clicking "Create Salary Sheet" again for an existing month is how a Super Admin
            // would naturally retry after adding a new member, so this must catch them up too.
            await syncNewEmployeesIntoSheet(db, existing.id, month)
            // Refreshes still-Unpaid rows from each employee's current payroll settings.
            await syncUnpaidEntriesWithEmployeeDefaults(db, existing.id, month)
            const entries = await buildSheetResponse(db, existing.id, month)
            return NextResponse.json({ sheet: existing, entries })
        } catch (e) {
            return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load salary sheet' }, { status: 500 })
        }
    }

    const { rows: [sheet] } = await db.query(
        `INSERT INTO salary_sheets (month, created_by) VALUES ($1, $2) RETURNING id, month, created_at`,
        [month, auth.employee.id]
    )

    // Basic Salary/Transportation Bill/Snacks Bill are seeded from each employee's saved
    // payroll defaults (Members → Edit Member → Payroll tab) rather than starting at 0 — and
    // frozen into this row at creation time, so a later change to an employee's default never
    // rewrites an already-created month's sheet. If Basic Salary Starting Month is set and
    // this sheet's month is before it (string comparison works since both are 'YYYY-MM'),
    // Basic Salary is ৳0 for this sheet — the employee's salary hasn't started yet. If a
    // Salary Increment is configured (and Basic Salary is active this month), it's added on
    // top once the sheet's month reaches its own effective month — a permanent raise, not a
    // one-off bonus. Festival Bonus is similarly seeded: percentage × (post-increment) Basic
    // Salary, but only when this sheet's calendar month is one of the employee's configured
    // Festival Bonus months (Members → Edit Member → Festival Bonus tab) — otherwise 0.
    // Attendance/leave/fine/advance/product buy/loan are never stored here, they're computed
    // live on every read.
    const { rows: activeEmployees } = await db.query(`SELECT ${EMPLOYEE_PAYROLL_FIELDS} FROM employees WHERE is_active = true`)

    if (activeEmployees.length > 0) {
        const rows = (activeEmployees as EmployeePayrollFields[]).map(e => buildSeedRow(sheet.id, month, e))
        for (const row of rows) {
            await db.query(
                `INSERT INTO salary_entries (salary_sheet_id, employee_id, basic_salary, transportation_bill, snacks_bill, festival_bonus)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [row.salary_sheet_id, row.employee_id, row.basic_salary, row.transportation_bill, row.snacks_bill, row.festival_bonus]
            )
        }
    }

    try {
        const entries = await buildSheetResponse(db, sheet.id, month)
        return NextResponse.json({ sheet, entries }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load salary sheet' }, { status: 500 })
    }
}
