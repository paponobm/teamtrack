import { requireAuth, isAuthed } from '@/lib/auth'
import { ADVANCE_EXPENSE_CATEGORY } from '@/lib/advances'
import { EMI_EXPENSE_CATEGORY, getEmiPaidSummaries } from '@/lib/emis'
import { NextResponse } from 'next/server'

// GET /api/expenses (super admin sees everyone's, admins/members see only their own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    // Only Super Admin (level <= 2) has cross-user visibility into who's spending what —
    // a plain Admin can approve/reject other people's expenses via the API, but browsing the
    // list itself is scoped to their own submissions, same as a regular Member.
    const isSuperAdmin = auth.employee.roleLevel <= 2

    const status = searchParams.get('status')
    const month = searchParams.get('month')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const submittedBy = searchParams.get('submitted_by')

    const conditions: string[] = []
    const params: unknown[] = []

    if (!isSuperAdmin) {
        params.push(auth.employee.id)
        conditions.push(`e.submitted_by = $${params.length}`)
    } else if (submittedBy) {
        params.push(submittedBy)
        conditions.push(`e.submitted_by = $${params.length}`)
    }

    if (status && status !== 'all') { params.push(status); conditions.push(`e.payment_status = $${params.length}`) }
    if (startDate) { params.push(startDate); conditions.push(`e.date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`e.date <= $${params.length}`) }
    if (month && !startDate && !endDate) {
        // Compute the real last day of the month (avoids the invalid `-31` for 30-day/Feb months).
        const [y, m] = month.split('-').map(Number)
        const monthEnd = new Date(y, m, 0).toISOString().split('T')[0]
        params.push(`${month}-01`)
        conditions.push(`e.date >= $${params.length}`)
        params.push(monthEnd)
        conditions.push(`e.date <= $${params.length}`)
    }

    const { rows: expenses } = await db.query(
        `SELECT e.*,
            json_build_object('id', s.id, 'name', s.name, 'employee_id', s.employee_id) AS submitter,
            json_build_object('id', ap.id, 'name', ap.name) AS approver
         FROM expenses e
         LEFT JOIN employees s ON s.id = e.submitted_by
         LEFT JOIN employees ap ON ap.id = e.approved_by
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY e.created_at DESC`,
        params
    )

    const stats = {
        total: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
        pending: expenses.filter(e => e.payment_status === 'pending').reduce((s, e) => s + (Number(e.amount) || 0), 0),
        paid: expenses.filter(e => e.payment_status === 'paid').reduce((s, e) => s + (Number(e.amount) || 0), 0),
        rejected: expenses.filter(e => e.payment_status === 'rejected').reduce((s, e) => s + (Number(e.amount) || 0), 0),
        count: expenses.length,
    }

    // Receiving Status — independent of payment_status above (which is the company's own
    // disbursement/approval status, and for Salary Advance/Employee Loan expenses is always
    // 'paid' from creation, see src/lib/advances.ts and src/lib/emis.ts). This instead tracks
    // whether the EMPLOYEE has repaid the linked Advance/EMI — null for every other expense,
    // since only these two categories have a receivable to track.
    const advanceExpenseIds = expenses.filter(e => e.category === ADVANCE_EXPENSE_CATEGORY).map(e => e.id)
    const emiExpenseIds = expenses.filter(e => e.category === EMI_EXPENSE_CATEGORY).map(e => e.id)
    const receivingStatusByExpenseId: Record<string, string> = {}

    if (advanceExpenseIds.length > 0) {
        const { rows: linkedAdvances } = await db.query(
            `SELECT expense_id, payment_status FROM advances WHERE expense_id = ANY($1)`,
            [advanceExpenseIds]
        )
        linkedAdvances.forEach((a: { expense_id: string | null; payment_status: 'Paid' | 'Unpaid' }) => {
            if (a.expense_id) receivingStatusByExpenseId[a.expense_id] = a.payment_status === 'Paid' ? 'Paid' : 'Pending'
        })
    }

    if (emiExpenseIds.length > 0) {
        const { rows: emiRows } = await db.query(
            `SELECT id, expense_id, employee_id, start_date, term_months, amount, interest_rate, monthly_installment
             FROM emis WHERE expense_id = ANY($1)`,
            [emiExpenseIds]
        )
        if (emiRows.length > 0) {
            const summaries = await getEmiPaidSummaries(db, emiRows)
            emiRows.forEach((e: { id: string; expense_id: string | null }) => {
                const summary = summaries[e.id]
                if (e.expense_id && summary) {
                    receivingStatusByExpenseId[e.expense_id] = summary.remaining_installments <= 0
                        ? `Paid ${summary.total_installments}/${summary.total_installments}`
                        : `Pending ${summary.paid_installments}/${summary.total_installments}`
                }
            })
        }
    }

    const enrichedExpenses = expenses.map(e => ({ ...e, receiving_status: receivingStatusByExpenseId[e.id] || null }))

    return NextResponse.json({ expenses: enrichedExpenses, stats })
}

// POST /api/expenses (any employee)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO expenses (date, category, description, amount, payment_method, fund_id, submitted_by, payment_status, note, business_name, invoice_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10) RETURNING *`,
        [
            body.date || new Date().toISOString().split('T')[0],
            body.category || null,
            body.description || null,
            body.amount || 0,
            body.payment_method || null,
            body.fund_id || null,
            auth.employee.id,
            body.note || null,
            body.business_name || null,
            body.invoice_id || null,
        ]
    )

    return NextResponse.json(data, { status: 201 })
}

// PUT /api/expenses - approve/reject (admin only)
export async function PUT(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const isSuperAdmin = auth.employee.roleLevel <= 2

    // Admins cannot approve/reject their own expenses (must escalate to Super Admin)
    if (!isSuperAdmin && updates.payment_status) {
        const { rows: [exp] } = await db.query(`SELECT submitted_by FROM expenses WHERE id = $1`, [id])
        if (exp && exp.submitted_by === auth.employee.id) {
            return NextResponse.json({ error: 'Cannot approve or reject your own expenses' }, { status: 403 })
        }
    }

    // Whitelist updatable fields. Never allow the client to change submitted_by/approved_by/id.
    const EDITABLE_FIELDS = ['date', 'category', 'description', 'amount', 'payment_method', 'fund_id', 'payment_status', 'note', 'business_name', 'invoice_id']
    const safeUpdate: Record<string, unknown> = {}
    for (const key of EDITABLE_FIELDS) {
        if (key in updates) safeUpdate[key] = updates[key]
    }

    // Stamp approver/timestamp server-side when an expense is approved or rejected.
    if (safeUpdate.payment_status === 'paid' || safeUpdate.payment_status === 'rejected') {
        safeUpdate.approved_by = auth.employee.id
    }

    // Fund overdraw guard (#18): approving deducts from the submitter's fund. If the submitter is a
    // fund holder, block an approval that would exceed their remaining balance — allocate more first.
    if (safeUpdate.payment_status === 'paid') {
        const { rows: [exp] } = await db.query(`SELECT submitted_by, amount, payment_status FROM expenses WHERE id = $1`, [id])
        if (exp && exp.payment_status !== 'paid' && exp.submitted_by) {
            const { rows: allocs } = await db.query(`SELECT amount FROM fund_allocations WHERE employee_id = $1`, [exp.submitted_by])
            if (allocs.length > 0) {
                const allocated = allocs.reduce((s, a) => s + Number(a.amount || 0), 0)
                const { rows: paidExp } = await db.query(
                    `SELECT amount FROM expenses WHERE submitted_by = $1 AND payment_status = 'paid'`,
                    [exp.submitted_by]
                )
                const used = paidExp.reduce((s, e) => s + Number(e.amount || 0), 0)
                const remaining = allocated - used
                const thisAmount = Number(('amount' in safeUpdate ? safeUpdate.amount : exp.amount) || 0)
                if (thisAmount > remaining) {
                    return NextResponse.json({ error: `Approving this exceeds the available fund (remaining ৳${remaining.toLocaleString()}). Allocate more fund before approving.` }, { status: 409 })
                }
            }
        }
    }

    const keys = Object.keys(safeUpdate)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE expenses SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...keys.map(k => safeUpdate[k])]
    )

    if (!data) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    return NextResponse.json(data)
}

// DELETE /api/expenses (admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const { rows: [exp] } = await db.query(`SELECT submitted_by FROM expenses WHERE id = $1`, [id])
        if (!exp || exp.submitted_by !== auth.employee.id) {
            return NextResponse.json({ error: 'Cannot delete expenses submitted by others' }, { status: 403 })
        }
    }

    await db.query(`DELETE FROM expenses WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
