import { createAdminClient } from './supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

export const ADVANCE_EXPENSE_CATEGORY = 'Employee Advance'

// advances.payment_status ('Paid'/'Unpaid') <-> expenses.payment_status ('paid'/'pending').
// 'rejected' is never used here — an advance is either outstanding or settled, never denied.
export function advanceToExpenseStatus(status: 'Paid' | 'Unpaid'): 'paid' | 'pending' {
    return status === 'Paid' ? 'paid' : 'pending'
}

function buildDescription(employeeName: string) {
    return `Advance to ${employeeName}`
}

// Creates the Expense row an advance is mirrored into (category "Employee Advance") so it
// counts toward Finance Hub's Total Expenses/Net Balance without a second parallel total.
// Returns the new expense id, or null if the employee/expense insert fails (advance creation
// still proceeds — a missing linked expense is recoverable, a blocked advance is not).
export async function createLinkedExpense(supabase: SupabaseClient, params: {
    employeeId: string
    amount: number
    date: string
    note: string | null
    paymentStatus: 'Paid' | 'Unpaid'
    submittedBy: string
}): Promise<string | null> {
    const { data: employee } = await supabase.from('employees').select('name').eq('id', params.employeeId).maybeSingle()
    const employeeName = employee?.name || 'employee'

    const expenseStatus = advanceToExpenseStatus(params.paymentStatus)
    const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
            date: params.date,
            category: ADVANCE_EXPENSE_CATEGORY,
            description: buildDescription(employeeName),
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

// Keeps an advance's linked expense in sync after an edit (amount/date/status/employee change).
export async function syncLinkedExpense(supabase: SupabaseClient, expenseId: string, params: {
    employeeId: string
    amount: number
    date: string
    note: string | null
    paymentStatus: 'Paid' | 'Unpaid'
    approvedBy: string
}) {
    const { data: employee } = await supabase.from('employees').select('name').eq('id', params.employeeId).maybeSingle()
    const employeeName = employee?.name || 'employee'
    const expenseStatus = advanceToExpenseStatus(params.paymentStatus)

    await supabase
        .from('expenses')
        .update({
            date: params.date,
            description: buildDescription(employeeName),
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
