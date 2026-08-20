import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PUT /api/product-buys/:id — edit a product-buy record, including which employee it
// belongs to (Admin+). Recomputes `amount` whenever product_price/discount_price changes —
// same product_price - discount_price formula used at creation (see POST above).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase
    const body = await request.json()

    const { data: existing, error: fetchError } = await supabase
        .from('product_buys')
        .select('product_price, discount_price, amount')
        .eq('id', id)
        .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Product buy record not found' }, { status: 404 })

    const update: Record<string, number | string | null> = {}

    if (body.employee_id !== undefined) {
        if (!body.employee_id) return NextResponse.json({ error: 'employee_id cannot be empty' }, { status: 400 })
        update.employee_id = body.employee_id
    }

    if (body.product_price !== undefined) {
        const numProductPrice = Number(body.product_price)
        if (!Number.isFinite(numProductPrice) || numProductPrice <= 0) {
            return NextResponse.json({ error: 'product_price must be a positive number' }, { status: 400 })
        }
        update.product_price = numProductPrice
    }

    if (body.discount_price !== undefined) {
        const numDiscountPrice = Number(body.discount_price)
        if (!Number.isFinite(numDiscountPrice) || numDiscountPrice < 0) {
            return NextResponse.json({ error: 'discount_price must be a non-negative number' }, { status: 400 })
        }
        update.discount_price = numDiscountPrice
    }

    if (update.product_price !== undefined || update.discount_price !== undefined) {
        const finalProductPrice = (update.product_price as number) ?? existing.product_price ?? existing.amount ?? 0
        const finalDiscountPrice = (update.discount_price as number) ?? existing.discount_price ?? 0
        if (finalDiscountPrice > finalProductPrice) {
            return NextResponse.json({ error: 'discount_price cannot exceed product_price' }, { status: 400 })
        }
        update.amount = finalProductPrice - finalDiscountPrice
    }

    if (body.purchase_date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.purchase_date)) {
            return NextResponse.json({ error: 'purchase_date must be in YYYY-MM-DD format' }, { status: 400 })
        }
        update.purchase_date = body.purchase_date
    }

    if (body.item !== undefined) update.item = body.item || null
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
        .from('product_buys')
        .update(update)
        .eq('id', id)
        .select('id')
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Product buy record not found' }, { status: 404 })

    return NextResponse.json({ success: true })
}

// DELETE /api/product-buys/:id (Admin+).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const supabase = auth.supabase

    const { error } = await supabase.from('product_buys').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
