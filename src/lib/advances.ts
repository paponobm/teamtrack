import { createAdminClient } from './supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

export const ADVANCE_EXPENSE_CATEGORY = 'Salary Advance'

function buildDescription(employeeName: string) {
    return `Advance to ${employeeName}`
}

// Creates the Expense row an advance is mirrored into (category "Salary Advance") so it
// counts toward Finance Hub's Total Expenses/Net Balance without a second parallel total.
// Returns the new expense id, or null if the employee/expense insert fails (advance creation
// still proceeds — a missing linked expense is recoverable, a blocked advance is not).
//
// The company has already handed this money to the employee the moment the advance record
// exists, so the Expense is unconditionally 'paid' from creation — it is NOT derived from the
// advance's own payment_status. That field tracks something different: whether the EMPLOYEE
// has since repaid the advance (surfaced as "Receiving Status" wherever this expense is shown,
// see /api/expenses). The two must stay independent: repaying an advance later must never flip
// this expense back to pending, and this expense being 'paid' must never imply repayment.
export async function createLinkedExpense(supabase: SupabaseClient, params: {
    employeeId: string
    amount: number
    date: string
    note: string | null
    submittedBy: string
}): Promise<string | null> {
    const { data: employee } = await supabase.from('employees').select('name').eq('id', params.employeeId).maybeSingle()
    const employeeName = employee?.name || 'employee'

    const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
            date: params.date,
            category: ADVANCE_EXPENSE_CATEGORY,
            description: buildDescription(employeeName),
            amount: params.amount,
            payment_status: 'paid',
            submitted_by: params.submittedBy,
            approved_by: params.submittedBy,
            note: params.note,
        })
        .select('id')
        .single()

    if (error) return null
    return expense.id
}

// Keeps an advance's linked expense in sync after an edit (amount/date/employee/note change) —
// deliberately does NOT touch payment_status/approved_by, since the Expense's 'paid' status is
// permanent from creation and independent of the advance's own repayment tracking (see
// createLinkedExpense's doc comment above).
export async function syncLinkedExpense(supabase: SupabaseClient, expenseId: string, params: {
    employeeId: string
    amount: number
    date: string
    note: string | null
}) {
    const { data: employee } = await supabase.from('employees').select('name').eq('id', params.employeeId).maybeSingle()
    const employeeName = employee?.name || 'employee'

    await supabase
        .from('expenses')
        .update({
            date: params.date,
            description: buildDescription(employeeName),
            amount: params.amount,
            note: params.note,
        })
        .eq('id', expenseId)
}

export async function deleteLinkedExpense(supabase: SupabaseClient, expenseId: string) {
    await supabase.from('expenses').delete().eq('id', expenseId)
}
