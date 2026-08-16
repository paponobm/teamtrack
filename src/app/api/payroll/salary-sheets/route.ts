import { requireAuth, isAuthed } from '@/lib/auth'
import { getAttendanceStatsForMonth, getFineTotalsForMonth, getAdvanceDetailsForMonth, computeNetPayable } from '@/lib/payroll'
import { getProductBuyDetailsForMonth } from '@/lib/productBuys'
import { getEmiLoanDetailsForMonth } from '@/lib/emis'
import { getProvidentFundDetailsForMonth } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// Builds one salary_entries insert row from an employee's saved payroll defaults for a given
// sheet month. Shared by initial sheet creation and the backfill sync below so both paths
// apply Basic Salary Starting Month / Salary Increment / Festival Bonus identically.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSeedRow(sheetId: string, month: string, e: any) {
    const monthNumber = Number(month.split('-')[1])
    const baseBasicSalary = Number(e.payroll_basic_salary) || 0
    const basicSalaryStartMonth: string | null = e.basic_salary_effective_month || null
    const basicSalaryActive = !basicSalaryStartMonth || month >= basicSalaryStartMonth
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
async function syncNewEmployeesIntoSheet(supabase: SupabaseClient, sheetId: string, month: string) {
    const [{ data: existingEntries }, { data: activeEmployees, error: empError }] = await Promise.all([
        supabase.from('salary_entries').select('employee_id').eq('salary_sheet_id', sheetId),
        supabase.from('employees').select(EMPLOYEE_PAYROLL_FIELDS).eq('is_active', true),
    ])

    if (empError) throw empError

    const existingIds = new Set((existingEntries || []).map((r: { employee_id: string }) => r.employee_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missing = (activeEmployees || []).filter((e: any) => !existingIds.has(e.id))
    if (missing.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = missing.map((e: any) => buildSeedRow(sheetId, month, e))
    const { error: insertError } = await supabase.from('salary_entries').insert(rows)
    if (insertError) throw insertError
}

// Refreshes Basic Salary/Transportation Bill/Snacks Bill/Festival Bonus on any still-Unpaid
// entry from the employee's *current* payroll settings (Members → Edit Member → Payroll /
// Festival Bonus tabs) — so editing Basic Salary, Salary Increment, or Festival Bonus shows up
// on an already-created month's sheet right away, instead of staying stuck at whatever value
// was seeded when the sheet was first created. Reuses buildSeedRow so the recomputed value is
// always identical to what a brand-new row would get. Once an entry is marked Paid it's a
// historical record of what was actually paid and is never touched here again.
async function syncUnpaidEntriesWithEmployeeDefaults(supabase: SupabaseClient, sheetId: string, month: string) {
    const { data: unpaidEntries } = await supabase
        .from('salary_entries')
        .select('id, employee_id, basic_salary, transportation_bill, snacks_bill, festival_bonus')
        .eq('salary_sheet_id', sheetId)
        .eq('payment_status', 'Unpaid')

    const rows = unpaidEntries || []
    if (rows.length === 0) return

    const employeeIds = rows.map((r: { employee_id: string }) => r.employee_id)
    const { data: employees, error: empError } = await supabase
        .from('employees')
        .select(EMPLOYEE_PAYROLL_FIELDS)
        .in('id', employeeIds)

    if (empError) throw empError

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employeeById: Record<string, any> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(employees || []).forEach((e: any) => { employeeById[e.id] = e })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of rows as any[]) {
        const e = employeeById[r.employee_id]
        if (!e) continue
        const seeded = buildSeedRow(sheetId, month, e)
        const changed = Number(r.basic_salary) !== seeded.basic_salary
            || Number(r.transportation_bill) !== seeded.transportation_bill
            || Number(r.snacks_bill) !== seeded.snacks_bill
            || Number(r.festival_bonus) !== seeded.festival_bonus
        if (!changed) continue

        const { error: updateError } = await supabase
            .from('salary_entries')
            .update({
                basic_salary: seeded.basic_salary,
                transportation_bill: seeded.transportation_bill,
                snacks_bill: seeded.snacks_bill,
                festival_bonus: seeded.festival_bonus,
            })
            .eq('id', r.id)
        if (updateError) throw updateError
    }
}

// Shared by GET and POST — fetches a sheet's entries joined with employee info, plus the
// live-computed attendance/fine numbers and derived net_payable for each row.
async function buildSheetResponse(supabase: SupabaseClient, sheetId: string, month: string) {
    const { data: entries, error } = await supabase
        .from('salary_entries')
        .select(`
            id, employee_id, basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus,
            other_deduction, payment_status, payment_method, payment_date, updated_at,
            employee:employees!employee_id(id, name, employee_id, avatar_url, joining_date, festival_bonus_percentage, basic_salary_effective_month, department:departments(id, name))
        `)
        .eq('salary_sheet_id', sheetId)
        .order('updated_at', { ascending: true })

    if (error) throw error

    // An employee whose Basic Salary Starting Month is still in the future relative to this
    // sheet doesn't just show ৳0 — they're left off the sheet entirely, since their salary
    // hasn't started yet. Filtered here (not at insert time) so it also self-corrects rows
    // that were already created before this setting was configured, without a data migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (entries || []).filter((r: any) => {
        const startMonth: string | null = r.employee?.basic_salary_effective_month || null
        return !startMonth || month >= startMonth
    })
    const employeeIds = rows.map((r: { employee_id: string }) => r.employee_id)
    const [attendance, fines, advances, productBuys, emis, providentFunds] = await Promise.all([
        getAttendanceStatsForMonth(supabase, employeeIds, month),
        getFineTotalsForMonth(supabase, employeeIds, month),
        getAdvanceDetailsForMonth(supabase, employeeIds, month),
        getProductBuyDetailsForMonth(supabase, employeeIds, month),
        getEmiLoanDetailsForMonth(supabase, employeeIds, month),
        getProvidentFundDetailsForMonth(supabase, employeeIds, month),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => {
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

    const supabase = auth.supabase
    const month = new URL(request.url).searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 })

    const { data: sheet, error: sheetError } = await supabase
        .from('salary_sheets')
        .select('id, month, created_at')
        .eq('month', month)
        .maybeSingle()

    if (sheetError) return NextResponse.json({ error: sheetError.message }, { status: 500 })
    if (!sheet) return NextResponse.json({ sheet: null, entries: [] })

    try {
        // Backfills any employee added/reactivated after this sheet already existed, so a
        // newly-added member with a Basic Salary Starting Month shows up as soon as this
        // month's sheet is next viewed, without needing to recreate the sheet.
        await syncNewEmployeesIntoSheet(supabase, sheet.id, month)
        // Refreshes still-Unpaid rows from each employee's current payroll settings.
        await syncUnpaidEntriesWithEmployeeDefaults(supabase, sheet.id, month)
        const entries = await buildSheetResponse(supabase, sheet.id, month)
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

    const supabase = auth.supabase
    const body = await request.json()
    const month: string = body.month
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: 'month is required in YYYY-MM format' }, { status: 400 })
    }

    const { data: existing } = await supabase.from('salary_sheets').select('id, month, created_at').eq('month', month).maybeSingle()
    if (existing) {
        try {
            // Backfills any employee added/reactivated after this sheet was first created —
            // clicking "Create Salary Sheet" again for an existing month is how a Super Admin
            // would naturally retry after adding a new member, so this must catch them up too.
            await syncNewEmployeesIntoSheet(supabase, existing.id, month)
            // Refreshes still-Unpaid rows from each employee's current payroll settings.
            await syncUnpaidEntriesWithEmployeeDefaults(supabase, existing.id, month)
            const entries = await buildSheetResponse(supabase, existing.id, month)
            return NextResponse.json({ sheet: existing, entries })
        } catch (e) {
            return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load salary sheet' }, { status: 500 })
        }
    }

    const { data: sheet, error: createError } = await supabase
        .from('salary_sheets')
        .insert({ month, created_by: auth.employee.id })
        .select('id, month, created_at')
        .single()

    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })

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
    const { data: activeEmployees, error: empError } = await supabase
        .from('employees')
        .select(EMPLOYEE_PAYROLL_FIELDS)
        .eq('is_active', true)

    if (empError) return NextResponse.json({ error: empError.message }, { status: 500 })

    if ((activeEmployees || []).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = activeEmployees.map((e: any) => buildSeedRow(sheet.id, month, e))

        const { error: insertError } = await supabase.from('salary_entries').insert(rows)

        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    try {
        const entries = await buildSheetResponse(supabase, sheet.id, month)
        return NextResponse.json({ sheet, entries }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load salary sheet' }, { status: 500 })
    }
}
