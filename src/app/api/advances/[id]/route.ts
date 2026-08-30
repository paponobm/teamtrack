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
    const db = auth.db
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

    const keys = Object.keys(update)
    if (keys.length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE advances SET ${setClauses.join(', ')} WHERE id = $1
         RETURNING id, employee_id, amount, advance_date, note, payment_status, expense_id`,
        [id, ...keys.map(k => update[k])]
    )

    if (!data) return NextResponse.json({ error: 'Advance record not found' }, { status: 404 })

    if (data.expense_id) {
        await syncLinkedExpense(db, data.expense_id, {
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
    const db = auth.db

    const { rows: [existing] } = await db.query(`SELECT expense_id FROM advances WHERE id = $1`, [id])

    await db.query(`DELETE FROM advances WHERE id = $1`, [id])

    if (existing?.expense_id) {
        await deleteLinkedExpense(db, existing.expense_id)
    }

    return NextResponse.json({ success: true })
}
