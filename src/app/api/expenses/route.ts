import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/expenses (super admin sees everyone's, admins/members see only their own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
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

    let query = supabase
        .from('expenses')
        .select(`
            *,
            submitter:employees!submitted_by(id, name, employee_id),
            approver:employees!approved_by(id, name)
        `)
        .order('created_at', { ascending: false })

    if (!isSuperAdmin) {
        // Non-super-admins only ever see their own expenses.
        query = query.eq('submitted_by', auth.employee.id)
    } else if (submittedBy) {
        // Super Admin can narrow the list to a specific admin/member via the filter.
        query = query.eq('submitted_by', submittedBy)
    }

    if (status && status !== 'all') query = query.eq('payment_status', status)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    if (month && !startDate && !endDate) {
        // Compute the real last day of the month (avoids the invalid `-31` for 30-day/Feb months).
        const [y, m] = month.split('-').map(Number)
        const monthEnd = new Date(y, m, 0).toISOString().split('T')[0]
        query = query.gte('date', `${month}-01`).lte('date', monthEnd)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const expenses = data || []
    const stats = {
        total: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
        pending: expenses.filter(e => e.payment_status === 'pending').reduce((s, e) => s + (Number(e.amount) || 0), 0),
        paid: expenses.filter(e => e.payment_status === 'paid').reduce((s, e) => s + (Number(e.amount) || 0), 0),
        rejected: expenses.filter(e => e.payment_status === 'rejected').reduce((s, e) => s + (Number(e.amount) || 0), 0),
        count: expenses.length,
    }

    return NextResponse.json({ expenses, stats })
}

// POST /api/expenses (any employee)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    const { data, error } = await auth.supabase
        .from('expenses')
        .insert({
            date: body.date || new Date().toISOString().split('T')[0],
            category: body.category || null,
            description: body.description || null,
            amount: body.amount || 0,
            payment_method: body.payment_method || null,
            fund_id: body.fund_id || null,
            submitted_by: auth.employee.id,
            payment_status: 'pending',
            note: body.note || null,
            business_name: body.business_name || null,
            invoice_id: body.invoice_id || null,
        })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// PUT /api/expenses - approve/reject (admin only)
export async function PUT(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const isAdmin = auth.employee.roleLevel <= 3
    const isSuperAdmin = auth.employee.roleLevel <= 2

    // Members cannot use this endpoint at all (they have no approve/reject rights)
    // Admins can update any expense EXCEPT their own payment_status (anti-self-approval)
    if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required to modify expenses' }, { status: 403 })
    }

    // Admins cannot approve/reject their own expenses (must escalate to Super Admin)
    if (!isSuperAdmin && updates.payment_status) {
        const { data: exp } = await auth.supabase.from('expenses').select('submitted_by').eq('id', id).single()
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
        const { data: exp } = await auth.supabase.from('expenses').select('submitted_by, amount, payment_status').eq('id', id).single()
        if (exp && exp.payment_status !== 'paid' && exp.submitted_by) {
            const { data: allocs } = await auth.supabase.from('fund_allocations').select('amount').eq('employee_id', exp.submitted_by)
            if (allocs && allocs.length > 0) {
                const allocated = allocs.reduce((s, a) => s + Number(a.amount || 0), 0)
                const { data: paidExp } = await auth.supabase.from('expenses').select('amount').eq('submitted_by', exp.submitted_by).eq('payment_status', 'paid')
                const used = (paidExp || []).reduce((s, e) => s + Number(e.amount || 0), 0)
                const remaining = allocated - used
                const thisAmount = Number(('amount' in safeUpdate ? safeUpdate.amount : exp.amount) || 0)
                if (thisAmount > remaining) {
                    return NextResponse.json({ error: `Approving this exceeds the available fund (remaining ৳${remaining.toLocaleString()}). Allocate more fund before approving.` }, { status: 409 })
                }
            }
        }
    }

    const { data, error } = await auth.supabase
        .from('expenses')
        .update(safeUpdate)
        .eq('id', id)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// DELETE /api/expenses (admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const { data: exp } = await auth.supabase.from('expenses').select('submitted_by').eq('id', id).single()
        if (!exp || exp.submitted_by !== auth.employee.id) {
            return NextResponse.json({ error: 'Cannot delete expenses submitted by others' }, { status: 403 })
        }
    }

    const { error } = await auth.supabase.from('expenses').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
