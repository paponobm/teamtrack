import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const NUMERIC_FIELDS = ['basic_salary', 'extra_duty', 'performance_bonus', 'festival_bonus', 'advance', 'loan', 'other_deduction'] as const
const PAYMENT_METHODS = ['bKash', 'Rocket', 'Nagad', 'Bank', 'Cash'] as const

// PUT /api/payroll/salary-entries — edit one employee's salary amounts/payment status for
// a month (Super Admin only). Employee/attendance/leave/fine fields are never accepted
// here — they're read-only, derived data that this route has no business touching.
export async function PUT(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const update: Record<string, number | string | null> = {}

    for (const field of NUMERIC_FIELDS) {
        if (body[field] === undefined) continue
        const num = Number(body[field])
        if (!Number.isFinite(num) || num < 0) {
            return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 })
        }
        update[field] = num
    }

    if (body.payment_status !== undefined) {
        if (body.payment_status !== 'Paid' && body.payment_status !== 'Unpaid') {
            return NextResponse.json({ error: 'payment_status must be Paid or Unpaid' }, { status: 400 })
        }
        update.payment_status = body.payment_status
    }

    if (body.payment_method !== undefined) {
        if (body.payment_method !== null && !PAYMENT_METHODS.includes(body.payment_method)) {
            return NextResponse.json({ error: `payment_method must be one of ${PAYMENT_METHODS.join(', ')}` }, { status: 400 })
        }
        update.payment_method = body.payment_method
    }

    if (body.payment_date !== undefined) {
        if (body.payment_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.payment_date)) {
            return NextResponse.json({ error: 'payment_date must be in YYYY-MM-DD format' }, { status: 400 })
        }
        update.payment_date = body.payment_date
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    update.updated_by = auth.employee.id

    const { data, error } = await supabase
        .from('salary_entries')
        .update(update)
        .eq('id', id)
        .select('id')
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Salary entry not found' }, { status: 404 })

    return NextResponse.json({ success: true })
}
