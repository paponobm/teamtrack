import { getMonthRangeFromString } from './dateRange'
import { createAdminClient } from './supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

export interface EmployeeAttendanceStats {
    present: number
    late: number
    absent: number
    leave: number
}

// Reuses the exact same `attendance.status` values/rules the Attendance Report already
// uses (present/late/absent/leave, with "late" also counting toward "present") — see
// src/app/api/attendance/report/route.ts. Never a second/duplicate attendance system.
export async function getAttendanceStatsForMonth(supabase: SupabaseClient, employeeIds: string[], month: string): Promise<Record<string, EmployeeAttendanceStats>> {
    const { start, end } = getMonthRangeFromString(month)
    const stats: Record<string, EmployeeAttendanceStats> = {}
    employeeIds.forEach(id => { stats[id] = { present: 0, late: 0, absent: 0, leave: 0 } })
    if (employeeIds.length === 0) return stats

    const { data } = await supabase
        .from('attendance')
        .select('employee_id, status')
        .in('employee_id', employeeIds)
        .gte('date', start)
        .lte('date', end)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(data || []).forEach((r: any) => {
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
export async function getFineTotalsForMonth(supabase: SupabaseClient, employeeIds: string[], month: string): Promise<Record<string, number>> {
    const { start, end } = getMonthRangeFromString(month)
    const totals: Record<string, number> = {}
    employeeIds.forEach(id => { totals[id] = 0 })
    if (employeeIds.length === 0) return totals

    const { data } = await supabase
        .from('fines')
        .select('member_id, amount, status, created_at')
        .in('member_id', employeeIds)
        .eq('status', 'Active')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(data || []).forEach((r: any) => {
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
export async function getAdvanceDetailsForMonth(supabase: SupabaseClient, employeeIds: string[], month: string): Promise<Record<string, EmployeeAdvanceDetail>> {
    const { start, end } = getMonthRangeFromString(month)
    const details: Record<string, EmployeeAdvanceDetail> = {}
    employeeIds.forEach(id => { details[id] = { total: 0, records: [] } })
    if (employeeIds.length === 0) return details

    const { data } = await supabase
        .from('advances')
        .select('employee_id, amount, advance_date')
        .in('employee_id', employeeIds)
        .gte('advance_date', start)
        .lte('advance_date', end)
        .order('advance_date', { ascending: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(data || []).forEach((r: any) => {
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
    loan: number
    other_deduction: number
}

// Net Payable = Basic Salary + Extra Duty + Transportation Bill + Snacks Bill + Performance Bonus
// + Festival Bonus - Fine - Advance - Product Buy - Loan - Other Deduction.
// The one place this formula lives — every API route imports it, so the dashboard totals
// and the salary sheet rows can never disagree with each other. Fine, Advance, and Product
// Buy are all live-computed (never stored per salary entry), so they're passed in explicitly.
// Advance and Product Buy are independent deduction types, each with their own source table
// (advances vs product_buys) — never merged into one number.
export function computeNetPayable(entry: SalaryAmounts, fine: number, advance: number, productBuy: number): number {
    return (Number(entry.basic_salary) || 0)
        + (Number(entry.extra_duty) || 0)
        + (Number(entry.transportation_bill) || 0)
        + (Number(entry.snacks_bill) || 0)
        + (Number(entry.performance_bonus) || 0)
        + (Number(entry.festival_bonus) || 0)
        - fine
        - advance
        - productBuy
        - (Number(entry.loan) || 0)
        - (Number(entry.other_deduction) || 0)
}
