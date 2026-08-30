import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/finance/transactions
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    // Only Super Admin sees every admin's transactions; a plain Admin (level 3) only sees
    // their own, same as a Member — matches the scoping already used by /api/expenses and /api/income.
    const isSuperAdmin = auth.employee.roleLevel <= 2

    const month = searchParams.get('month')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let start: string | null = startDate
    let end: string | null = endDate
    if (month && !startDate && !endDate) {
        const [y, m] = month.split('-').map(Number)
        start = `${month}-01`
        end = new Date(y, m, 0).toISOString().split('T')[0]
    }

    const expenseConditions: string[] = []
    const expenseParams: unknown[] = []
    const incomeConditions: string[] = []
    const incomeParams: unknown[] = []

    if (!isSuperAdmin) {
        expenseParams.push(auth.employee.id); expenseConditions.push(`e.submitted_by = $${expenseParams.length}`)
        incomeParams.push(auth.employee.id); incomeConditions.push(`i.added_by = $${incomeParams.length}`)
    }
    if (start) {
        expenseParams.push(start); expenseConditions.push(`e.date >= $${expenseParams.length}`)
        incomeParams.push(start); incomeConditions.push(`i.date >= $${incomeParams.length}`)
    }
    if (end) {
        expenseParams.push(end); expenseConditions.push(`e.date <= $${expenseParams.length}`)
        incomeParams.push(end); incomeConditions.push(`i.date <= $${incomeParams.length}`)
    }

    const [{ rows: expenseRows }, { rows: incomeRows }] = await Promise.all([
        db.query(
            `SELECT e.id, e.date, e.category, e.description, e.amount, e.payment_method, e.payment_status, e.created_at,
                json_build_object('id', s.id, 'name', s.name) AS submitter
             FROM expenses e LEFT JOIN employees s ON s.id = e.submitted_by
             ${expenseConditions.length ? 'WHERE ' + expenseConditions.join(' AND ') : ''}`,
            expenseParams
        ),
        db.query(
            `SELECT i.id, i.date, i.source, i.description, i.amount, i.created_at,
                json_build_object('id', a.id, 'name', a.name) AS adder
             FROM income i LEFT JOIN employees a ON a.id = i.added_by
             ${incomeConditions.length ? 'WHERE ' + incomeConditions.join(' AND ') : ''}`,
            incomeParams
        ),
    ])

    const expenses = expenseRows.map(e => ({
        ...e,
        type: 'expense',
        category_name: e.category || 'Uncategorized',
        user: e.submitter
    }))

    const incomes = incomeRows.map(i => ({
        ...i,
        type: 'income',
        category_name: i.source || 'Sales Revenue',
        user: i.adder
    }))

    const transactions = [...expenses, ...incomes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const stats = {
        totalIncome: incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0),
        totalExpense: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
        net: 0
    }
    stats.net = stats.totalIncome - stats.totalExpense

    return NextResponse.json({ transactions, stats })
}
