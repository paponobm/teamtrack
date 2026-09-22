import type { Pool, PoolClient } from 'pg'

type Db = Pool | PoolClient

// Deliberately its own category, distinct from both "Salary Advance" (src/lib/advances.ts) and
// the Payroll Salary Sheet's own "Employee Salary" (src/lib/payroll.ts) — this is a manual,
// off-cycle disbursement outside the monthly payroll run, and must never be mistaken for either
// in Finance Hub's expense breakdown.
export const SALARY_PAYMENT_EXPENSE_CATEGORY = 'Salary Payment'

function buildDescription(employeeName: string) {
    return `Salary payment to ${employeeName}`
}

// Creates the Expense row a salary payment is mirrored into, so it counts toward Finance Hub's
// Total Expenses/Net Balance without a second parallel total — same "linked expense" pattern
// createLinkedExpense in src/lib/advances.ts already uses for Advance.
//
// Unlike an Advance, a salary payment is never repaid by the employee — it's the final
// transaction, not a loan — so there's no separate repayment-status field to keep independent
// of this: the Expense is simply 'paid' from creation and stays that way.
export async function createSalaryPaymentExpense(db: Db, params: {
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
            [params.date, SALARY_PAYMENT_EXPENSE_CATEGORY, buildDescription(employeeName), params.amount, params.submittedBy, params.note]
        )
        return expense.id
    } catch {
        return null
    }
}

// Keeps a salary payment's linked expense in sync after an edit (amount/date/employee/note).
export async function syncSalaryPaymentExpense(db: Db, expenseId: string, params: {
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

export async function deleteSalaryPaymentExpense(db: Db, expenseId: string) {
    await db.query(`DELETE FROM expenses WHERE id = $1`, [expenseId])
}
