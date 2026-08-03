import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/finance/reports
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const isAdmin = auth.employee.roleLevel <= 3
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // Only Super Admin sees company-wide reports; a plain Admin (level 3) only sees reports
    // built from their own expenses/income, matching /api/expenses and /api/income's scoping.
    const isSuperAdmin = auth.employee.roleLevel <= 2

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let expenseQuery = supabase.from('expenses').select('id, amount, category, date, submitted_by')
    let incomeQuery = supabase.from('income').select('id, amount, source, date, added_by')

    if (!isSuperAdmin) {
        expenseQuery = expenseQuery.eq('submitted_by', auth.employee.id)
        incomeQuery = incomeQuery.eq('added_by', auth.employee.id)
    }

    if (startDate) {
        expenseQuery = expenseQuery.gte('date', startDate)
        incomeQuery = incomeQuery.gte('date', startDate)
    }
    if (endDate) {
        expenseQuery = expenseQuery.lte('date', endDate)
        incomeQuery = incomeQuery.lte('date', endDate)
    }
    if (month && !startDate && !endDate) {
        const [y, m] = month.split('-').map(Number)
        const monthEnd = new Date(y, m, 0).toISOString().split('T')[0]
        expenseQuery = expenseQuery.gte('date', `${month}-01`).lte('date', monthEnd)
        incomeQuery = incomeQuery.gte('date', `${month}-01`).lte('date', monthEnd)
    }

    const [expenseRes, incomeRes] = await Promise.all([expenseQuery, incomeQuery])
    if (expenseRes.error) return NextResponse.json({ error: expenseRes.error.message }, { status: 500 })
    if (incomeRes.error) return NextResponse.json({ error: incomeRes.error.message }, { status: 500 })

    const expenses = expenseRes.data || []
    const incomes = incomeRes.data || []

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
