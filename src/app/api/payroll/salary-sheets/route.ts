import { requireAuth, isAuthed } from '@/lib/auth'
import { getAttendanceStatsForMonth, getFineTotalsForMonth, computeNetPayable } from '@/lib/payroll'
import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// Shared by GET and POST — fetches a sheet's entries joined with employee info, plus the
// live-computed attendance/fine numbers and derived net_payable for each row.
async function buildSheetResponse(supabase: SupabaseClient, sheetId: string, month: string) {
    const { data: entries, error } = await supabase
        .from('salary_entries')
        .select(`
            id, employee_id, basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus,
            advance, loan, other_deduction, payment_status, payment_method, payment_date, updated_at,
            employee:employees!employee_id(id, name, employee_id, avatar_url, joining_date, department:departments(id, name))
        `)
        .eq('salary_sheet_id', sheetId)
        .order('updated_at', { ascending: true })

    if (error) throw error

    const rows = entries || []
    const employeeIds = rows.map((r: { employee_id: string }) => r.employee_id)
    const [attendance, fines] = await Promise.all([
        getAttendanceStatsForMonth(supabase, employeeIds, month),
        getFineTotalsForMonth(supabase, employeeIds, month),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => {
        const fine = fines[r.employee_id] || 0
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
            advance: Number(r.advance) || 0,
            loan: Number(r.loan) || 0,
            other_deduction: Number(r.other_deduction) || 0,
            payment_status: r.payment_status,
            payment_method: r.payment_method,
            payment_date: r.payment_date,
            attendance: attendance[r.employee_id] || { present: 0, late: 0, absent: 0, leave: 0 },
            fine,
            net_payable: computeNetPayable(r, fine),
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

    const { data: activeEmployees, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('is_active', true)

    if (empError) return NextResponse.json({ error: empError.message }, { status: 500 })

    if ((activeEmployees || []).length > 0) {
        // All manually-entered amounts start at 0 — attendance/leave/fine are never stored
        // here, they're computed live on every read.
        const { error: insertError } = await supabase
            .from('salary_entries')
            .insert(activeEmployees.map((e: { id: string }) => ({ salary_sheet_id: sheet.id, employee_id: e.id })))

        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    try {
        const entries = await buildSheetResponse(supabase, sheet.id, month)
        return NextResponse.json({ sheet, entries }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load salary sheet' }, { status: 500 })
    }
}
