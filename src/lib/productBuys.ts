import { getMonthRangeFromString } from './dateRange'
import { createAdminClient } from './supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

export const PRODUCT_BUY_EXPENSE_CATEGORY = 'Employee Product Buy'

// product_buys.payment_status ('Paid'/'Unpaid') <-> expenses.payment_status ('paid'/'pending').
export function productBuyToExpenseStatus(status: 'Paid' | 'Unpaid'): 'paid' | 'pending' {
    return status === 'Paid' ? 'paid' : 'pending'
}

function buildDescription(employeeName: string, item: string | null) {
    return item ? `${item} for ${employeeName}` : `Product purchase for ${employeeName}`
}

// Mirrors src/lib/advances.ts's createLinkedExpense/syncLinkedExpense/deleteLinkedExpense —
// deliberately a separate module (not shared) since Product Buy and Advance are independent
// deduction types with their own tables/calculations, per explicit product decision.
export async function createLinkedExpense(supabase: SupabaseClient, params: {
    employeeId: string
    amount: number
    date: string
    item: string | null
    note: string | null
    paymentStatus: 'Paid' | 'Unpaid'
    submittedBy: string
}): Promise<string | null> {
    const { data: employee } = await supabase.from('employees').select('name').eq('id', params.employeeId).maybeSingle()
    const employeeName = employee?.name || 'employee'

    const expenseStatus = productBuyToExpenseStatus(params.paymentStatus)
    const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
            date: params.date,
            category: PRODUCT_BUY_EXPENSE_CATEGORY,
            description: buildDescription(employeeName, params.item),
            amount: params.amount,
            payment_status: expenseStatus,
            submitted_by: params.submittedBy,
            approved_by: expenseStatus === 'paid' ? params.submittedBy : null,
            note: params.note,
        })
        .select('id')
        .single()

    if (error) return null
    return expense.id
}

export async function syncLinkedExpense(supabase: SupabaseClient, expenseId: string, params: {
    employeeId: string
    amount: number
    date: string
    item: string | null
    note: string | null
    paymentStatus: 'Paid' | 'Unpaid'
    approvedBy: string
}) {
    const { data: employee } = await supabase.from('employees').select('name').eq('id', params.employeeId).maybeSingle()
    const employeeName = employee?.name || 'employee'
    const expenseStatus = productBuyToExpenseStatus(params.paymentStatus)

    await supabase
        .from('expenses')
        .update({
            date: params.date,
            description: buildDescription(employeeName, params.item),
            amount: params.amount,
            payment_status: expenseStatus,
            approved_by: expenseStatus === 'paid' ? params.approvedBy : null,
            note: params.note,
        })
        .eq('id', expenseId)
}

export async function deleteLinkedExpense(supabase: SupabaseClient, expenseId: string) {
    await supabase.from('expenses').delete().eq('id', expenseId)
}

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
