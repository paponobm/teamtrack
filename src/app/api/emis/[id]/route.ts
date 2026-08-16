import { requireAuth, isAuthed } from '@/lib/auth'
import { computeMonthlyInstallment, syncLinkedExpense, deleteLinkedExpense } from '@/lib/emis'
import { NextResponse } from 'next/server'

const TERM_OPTIONS = [3, 6, 12, 24] as const

// PUT /api/emis/:id — edit an EMI record, including which employee it belongs to (Admin+).
// Recomputes monthly_installment whenever amount/rate/term changes.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase
    const body = await request.json()

    const { data: existing, error: fetchError } = await supabase
        .from('emis')
        .select('employee_id, amount, term_months, start_date, interest_rate, expense_id')
        .eq('id', id)
        .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'EMI record not found' }, { status: 404 })

    const update: Record<string, number | string> = {}

    if (body.employee_id !== undefined) {
        if (!body.employee_id) return NextResponse.json({ error: 'employee_id cannot be empty' }, { status: 400 })
        update.employee_id = body.employee_id
    }

    if (body.amount !== undefined) {
        const numAmount = Number(body.amount)
        if (!Number.isFinite(numAmount) || numAmount <= 0) {
            return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
        }
        update.amount = numAmount
    }

    if (body.term_months !== undefined) {
        const numTerm = Number(body.term_months)
        if (!TERM_OPTIONS.includes(numTerm as 3 | 6 | 12 | 24)) {
            return NextResponse.json({ error: 'term_months must be 3, 6, 12, or 24' }, { status: 400 })
        }
        update.term_months = numTerm
    }

    if (body.start_date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) {
            return NextResponse.json({ error: 'start_date must be in YYYY-MM-DD format' }, { status: 400 })
        }
        update.start_date = body.start_date
    }

    if (body.interest_rate !== undefined) {
        const numRate = Number(body.interest_rate)
        if (!Number.isFinite(numRate) || numRate < 0) {
            return NextResponse.json({ error: 'interest_rate must be a non-negative number' }, { status: 400 })
        }
        update.interest_rate = numRate
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    // Recompute monthly_installment whenever any input to the formula changed.
    if (update.amount !== undefined || update.term_months !== undefined || update.interest_rate !== undefined) {
        const finalAmount = (update.amount as number) ?? existing.amount
        const finalTerm = (update.term_months as number) ?? existing.term_months
        const finalRate = (update.interest_rate as number) ?? existing.interest_rate
        update.monthly_installment = computeMonthlyInstallment(Number(finalAmount), Number(finalRate), Number(finalTerm))
    }

    const { error } = await supabase.from('emis').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (existing.expense_id) {
        await syncLinkedExpense(supabase, existing.expense_id, {
            employeeId: (update.employee_id as string) ?? existing.employee_id,
            amount: (update.amount as number) ?? existing.amount,
            date: (update.start_date as string) ?? existing.start_date,
        })
    }

    return NextResponse.json({ success: true })
}

// DELETE /api/emis/:id (Admin+) — also removes the linked Expense row so no orphaned Finance
// Hub entry is left behind.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase

    const { data: existing } = await supabase.from('emis').select('expense_id').eq('id', id).maybeSingle()

    const { error } = await supabase.from('emis').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (existing?.expense_id) {
        await deleteLinkedExpense(supabase, existing.expense_id)
    }

    return NextResponse.json({ success: true })
}
