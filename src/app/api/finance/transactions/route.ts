import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/finance/transactions
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3

    const month = searchParams.get('month')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Fetch expenses
    let expenseQuery = supabase
        .from('expenses')
        .select(`
            id, date, category, description, amount, payment_method, payment_status, note, created_at,
            submitter:employees!submitted_by(id, name)
        `)
    
    // Fetch income
    let incomeQuery = supabase
        .from('income')
        .select(`
            id, date, source, description, amount, payment_method, created_at,
            adder:employees!added_by(id, name)
        `)

    if (!isAdmin) {
        expenseQuery = expenseQuery.eq('submitted_by', auth.employee.id)
        // Normal members don't usually see company income unless they added it, but income doesn't have an 'adder' role filter typically in Teamtrack, but let's restrict to what they added if they are a member.
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

    const expenses = (expenseRes.data || []).map(e => ({
        ...e,
        type: 'expense',
        category_name: e.category || 'Uncategorized',
        user: e.submitter
    }))

    const incomes = (incomeRes.data || []).map(i => ({
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
