import { requireAuth, isAuthed } from '@/lib/auth'
import { syncLinkedExpense, deleteLinkedExpense } from '@/lib/advances'
import { NextResponse } from 'next/server'

// PUT /api/advances/:id — edit an advance record, including which employee it belongs to
// (Admin+). Any change here also re-syncs the linked Expense row so Finance Hub stays
// consistent with the advance.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase
    const body = await request.json()

    const update: Record<string, number | string | null> = {}

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

    if (body.advance_date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.advance_date)) {
            return NextResponse.json({ error: 'advance_date must be in YYYY-MM-DD format' }, { status: 400 })
        }
        update.advance_date = body.advance_date
    }

    if (body.note !== undefined) update.note = body.note || null

    if (body.payment_status !== undefined) {
        if (body.payment_status !== 'Paid' && body.payment_status !== 'Unpaid') {
            return NextResponse.json({ error: 'payment_status must be Paid or Unpaid' }, { status: 400 })
        }
        update.payment_status = body.payment_status
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('advances')
        .update(update)
        .eq('id', id)
        .select('id, employee_id, amount, advance_date, note, payment_status, expense_id')
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Advance record not found' }, { status: 404 })

    if (data.expense_id) {
        await syncLinkedExpense(supabase, data.expense_id, {
            employeeId: data.employee_id,
            amount: Number(data.amount),
            date: data.advance_date,
            note: data.note,
        })
    }

    return NextResponse.json({ success: true })
}

// DELETE /api/advances/:id (Admin+) — also removes the linked Expense row so no orphaned
// Finance Hub entry is left behind.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase

    const { data: existing } = await supabase.from('advances').select('expense_id').eq('id', id).maybeSingle()

    const { error } = await supabase.from('advances').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (existing?.expense_id) {
        await deleteLinkedExpense(supabase, existing.expense_id)
    }

    return NextResponse.json({ success: true })
}
