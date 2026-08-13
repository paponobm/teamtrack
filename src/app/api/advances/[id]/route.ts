import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PUT /api/advances/:id — edit an advance record (Admin+).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase
    const body = await request.json()

    const update: Record<string, number | string | null> = {}

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
        .select('id')
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Advance record not found' }, { status: 404 })

    return NextResponse.json({ success: true })
}

// DELETE /api/advances/:id (Admin+).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase

    const { error } = await supabase.from('advances').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
