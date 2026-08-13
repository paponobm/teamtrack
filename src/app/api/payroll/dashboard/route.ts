import { requireAuth, isAuthed } from '@/lib/auth'
import { getFineTotalsForMonth, computeNetPayable } from '@/lib/payroll'
import { NextResponse } from 'next/server'

// GET /api/payroll/dashboard?month=YYYY-MM — monthly payroll summary (Super Admin only).
// Total Employees is a lifetime/current count (active employees); the money figures only
// exist once a salary sheet has been created for that month — until then they're 0 with
// sheetExists:false so the UI can prompt "Create Salary Sheet" instead of showing stale data.
export async function GET(request: Request) {
    const auth = await requireAuth(2) // Super Admin only — salary data
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const month = new URL(request.url).searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 })

    const { count: totalEmployees } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

    const { data: sheet } = await supabase
        .from('salary_sheets')
        .select('id')
        .eq('month', month)
        .maybeSingle()

    if (!sheet) {
        return NextResponse.json({
            sheetExists: false,
            totalEmployees: totalEmployees || 0,
            totalPayroll: 0,
            paidEmployees: 0,
            paidAmount: 0,
            unpaidEmployees: 0,
            unpaidAmount: 0,
            totalBasicSalary: 0,
            totalAdvance: 0,
            totalLoan: 0,
            totalPerformanceBonus: 0,
            totalFestivalBonus: 0,
        })
    }

    const { data: entries } = await supabase
        .from('salary_entries')
        .select('employee_id, basic_salary, extra_duty, transportation_bill, snacks_bill, performance_bonus, festival_bonus, advance, loan, other_deduction, payment_status')
        .eq('salary_sheet_id', sheet.id)

    const rows = entries || []
    const fineTotals = await getFineTotalsForMonth(supabase, rows.map(r => r.employee_id), month)

    // Total Payroll reflects money actually paid out this month, not the projected cost of
    // unpaid entries — it only grows as employees are marked Paid.
    let totalPayroll = 0
    let paidEmployees = 0
    let paidAmount = 0
    let unpaidEmployees = 0
    let unpaidAmount = 0
    let totalBasicSalary = 0
    let totalAdvance = 0
    let totalLoan = 0
    let totalPerformanceBonus = 0
    let totalFestivalBonus = 0

    rows.forEach(r => {
        const net = computeNetPayable(r, fineTotals[r.employee_id] || 0)
        totalBasicSalary += Number(r.basic_salary) || 0
        totalAdvance += Number(r.advance) || 0
        totalLoan += Number(r.loan) || 0
        totalPerformanceBonus += Number(r.performance_bonus) || 0
        totalFestivalBonus += Number(r.festival_bonus) || 0
        if (r.payment_status === 'Paid') { paidEmployees++; paidAmount += net; totalPayroll += net }
        else { unpaidEmployees++; unpaidAmount += net }
    })

    return NextResponse.json({
        sheetExists: true,
        totalEmployees: totalEmployees || 0,
        totalPayroll,
        paidEmployees,
        paidAmount,
        unpaidEmployees,
        unpaidAmount,
        totalBasicSalary,
        totalAdvance,
        totalLoan,
        totalPerformanceBonus,
        totalFestivalBonus,
    })
}
