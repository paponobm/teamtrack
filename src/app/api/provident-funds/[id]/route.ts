import { requireAuth, isAuthed } from '@/lib/auth'
import { computeMonthlyInstallment } from '@/lib/providentFunds'
import { NextResponse } from 'next/server'

// PUT /api/provident-funds/:id — edit a Provident Fund record, including which employee it
// belongs to (Admin+). Recomputes monthly_installment whenever principal/rate/duration changes.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const db = auth.db
    const body = await request.json()

    const { rows: [existing] } = await db.query(
        `SELECT employee_id, principal_amount, duration_months, start_date, interest_rate FROM provident_funds WHERE id = $1`,
        [id]
    )

    if (!existing) return NextResponse.json({ error: 'Provident Fund record not found' }, { status: 404 })

    const update: Record<string, number | string | null> = {}

    if (body.employee_id !== undefined) {
        if (!body.employee_id) return NextResponse.json({ error: 'employee_id cannot be empty' }, { status: 400 })
        update.employee_id = body.employee_id
    }

    if (body.principal_amount !== undefined) {
        const numPrincipal = Number(body.principal_amount)
        if (!Number.isFinite(numPrincipal) || numPrincipal <= 0) {
            return NextResponse.json({ error: 'principal_amount must be a positive number' }, { status: 400 })
        }
        update.principal_amount = numPrincipal
    }

    if (body.duration_months !== undefined) {
        const numDuration = Number(body.duration_months)
        if (!Number.isInteger(numDuration) || numDuration <= 0) {
            return NextResponse.json({ error: 'duration_months must be a positive whole number' }, { status: 400 })
        }
        update.duration_months = numDuration
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

    if (body.note !== undefined) {
        update.note = body.note || null
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    // Recompute monthly_installment whenever principal or duration changed — interest_rate is
    // reference-only and doesn't factor into the formula (see src/lib/providentFunds.ts).
    if (update.principal_amount !== undefined || update.duration_months !== undefined) {
        const finalPrincipal = (update.principal_amount as number) ?? existing.principal_amount
        const finalDuration = (update.duration_months as number) ?? existing.duration_months
        update.monthly_installment = computeMonthlyInstallment(Number(finalPrincipal), Number(finalDuration))
    }

    const keys = Object.keys(update)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    await db.query(`UPDATE provident_funds SET ${setClauses.join(', ')} WHERE id = $1`, [id, ...keys.map(k => update[k])])

    return NextResponse.json({ success: true })
}

// DELETE /api/provident-funds/:id (Admin+). No linked Expense/salary_entries rows to clean
// up — Provident Fund's Salary Sheet deduction and its Paid/Due summary are both computed
// live from this table (see src/lib/providentFunds.ts), never stored elsewhere, so deleting
// the record here is enough; nothing else can be left orphaned.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    await auth.db.query(`DELETE FROM provident_funds WHERE id = $1`, [id])

    return NextResponse.json({ success: true })
}
