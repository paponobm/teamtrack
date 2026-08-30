import type { Pool, PoolClient } from 'pg'

type Db = Pool | PoolClient

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
export async function createLinkedExpense(db: Db, params: {
    employeeId: string
    amount: number
    date: string
    note: string | null
    submittedBy: string
}): Promise<string | null> {
    const { rows: [employee] } = await db.query(`SELECT name FROM employees WHERE id = $1`, [params.employeeId])
    const employeeName = employee?.name || 'employee'

    try {
        const { rows: [expense] } = await db.query(
            `INSERT INTO expenses (date, category, description, amount, payment_status, submitted_by, approved_by, note)
             VALUES ($1, $2, $3, $4, 'paid', $5, $5, $6) RETURNING id`,
            [params.date, ADVANCE_EXPENSE_CATEGORY, buildDescription(employeeName), params.amount, params.submittedBy, params.note]
        )
        return expense.id
    } catch {
        return null
    }
}

// Keeps an advance's linked expense in sync after an edit (amount/date/employee/note change) —
// deliberately does NOT touch payment_status/approved_by, since the Expense's 'paid' status is
// permanent from creation and independent of the advance's own repayment tracking (see
// createLinkedExpense's doc comment above).
export async function syncLinkedExpense(db: Db, expenseId: string, params: {
    employeeId: string
    amount: number
    date: string
    note: string | null
}) {
    const { rows: [employee] } = await db.query(`SELECT name FROM employees WHERE id = $1`, [params.employeeId])
    const employeeName = employee?.name || 'employee'

    await db.query(
        `UPDATE expenses SET date = $1, description = $2, amount = $3, note = $4 WHERE id = $5`,
        [params.date, buildDescription(employeeName), params.amount, params.note, expenseId]
    )
}

export async function deleteLinkedExpense(db: Db, expenseId: string) {
    await db.query(`DELETE FROM expenses WHERE id = $1`, [expenseId])
}
