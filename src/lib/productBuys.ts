import { getMonthRangeFromString } from './dateRange'
import { createAdminClient } from './supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

// Product Buy is intentionally NOT mirrored into Finance Hub Expenses (unlike Advance/EMI) —
// it may be wired into an Income flow instead later, so no expense-linking helpers live here.

export interface ProductBuyRecord {
    date: string
    amount: number
}

export interface EmployeeProductBuyDetail {
    total: number
    records: ProductBuyRecord[]
}

// Live-computed monthly total + breakdown for the Salary Sheet's separate "Product Buy"
// column — same "reuse, don't duplicate" pattern as getAdvanceDetailsForMonth in
// src/lib/payroll.ts, just sourced from product_buys instead of advances.
export async function getProductBuyDetailsForMonth(supabase: SupabaseClient, employeeIds: string[], month: string): Promise<Record<string, EmployeeProductBuyDetail>> {
    const { start, end } = getMonthRangeFromString(month)
    const details: Record<string, EmployeeProductBuyDetail> = {}
    employeeIds.forEach(id => { details[id] = { total: 0, records: [] } })
    if (employeeIds.length === 0) return details

    const { data } = await supabase
        .from('product_buys')
        .select('employee_id, amount, purchase_date')
        .in('employee_id', employeeIds)
        .gte('purchase_date', start)
        .lte('purchase_date', end)
        .order('purchase_date', { ascending: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(data || []).forEach((r: any) => {
        const d = details[r.employee_id]
        if (!d) return
        const amount = Number(r.amount) || 0
        d.total += amount
        d.records.push({ date: r.purchase_date, amount })
    })
    return details
}
