import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/finance/reports
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const isAdmin = auth.employee.roleLevel <= 3
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // Only Super Admin sees company-wide reports; a plain Admin (level 3) only sees reports
    // built from their own expenses/income, matching /api/expenses and /api/income's scoping.
    const isSuperAdmin = auth.employee.roleLevel <= 2

    const { searchParams } = new URL(request.url)
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
        expenseParams.push(auth.employee.id); expenseConditions.push(`submitted_by = $${expenseParams.length}`)
        incomeParams.push(auth.employee.id); incomeConditions.push(`added_by = $${incomeParams.length}`)
    }
    if (start) {
        expenseParams.push(start); expenseConditions.push(`date >= $${expenseParams.length}`)
        incomeParams.push(start); incomeConditions.push(`date >= $${incomeParams.length}`)
    }
    if (end) {
        expenseParams.push(end); expenseConditions.push(`date <= $${expenseParams.length}`)
        incomeParams.push(end); incomeConditions.push(`date <= $${incomeParams.length}`)
    }

    const [{ rows: expenses }, { rows: incomes }] = await Promise.all([
        db.query(
            `SELECT id, amount, category, date, submitted_by FROM expenses ${expenseConditions.length ? 'WHERE ' + expenseConditions.join(' AND ') : ''}`,
            expenseParams
        ),
        db.query(
            `SELECT id, amount, source, date, added_by FROM income ${incomeConditions.length ? 'WHERE ' + incomeConditions.join(' AND ') : ''}`,
            incomeParams
        ),
    ])

    const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const totalIncome = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0)

    // Aggregate expenses by category
    const expenseByCategory: Record<string, number> = {}
    expenses.forEach(e => {
        const cat = e.category || 'Uncategorized'
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount)
    })
    const pieData = Object.keys(expenseByCategory).map(name => ({
        name,
        value: expenseByCategory[name]
    })).sort((a, b) => b.value - a.value)

    // Aggregate income by source
    const incomeBySource: Record<string, number> = {}
    incomes.forEach(i => {
        const src = i.source || 'Other'
        incomeBySource[src] = (incomeBySource[src] || 0) + Number(i.amount)
    })
    const incomeBarData = Object.keys(incomeBySource).map(name => ({
        name,
        value: incomeBySource[name]
    })).sort((a, b) => b.value - a.value)

    return NextResponse.json({
        totalExpense,
        totalIncome,
        netBalance: totalIncome - totalExpense,
        pieData,
        incomeBarData
    })
}
