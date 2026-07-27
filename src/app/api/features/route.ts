import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/features - list all features (any employee, used for sidebar/permissions display)
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { data, error } = await auth.supabase
        .from('features')
        .select('*')
        .order('category')
        .order('sort_order')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// POST /api/features - create a new feature (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    if (!body.name?.trim()) {
        return NextResponse.json({ error: 'Feature name is required' }, { status: 400 })
    }

    const slug = body.slug?.trim() || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const { data: existing } = await auth.supabase
        .from('features')
        .select('sort_order')
        .eq('category', body.category || 'General')
        .order('sort_order', { ascending: false })
        .limit(1)

    const nextOrder = (existing?.[0]?.sort_order || 0) + 1

    const { data, error } = await auth.supabase
        .from('features')
        .upsert({
            name: body.name.trim(),
            name_bn: body.name_bn || body.name.trim(),
            category: body.category || 'General',
            slug,
            sort_order: nextOrder,
        }, { onConflict: 'slug' })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/features - delete a feature (super admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // SuperAdmin+
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing feature id' }, { status: 400 })

    await auth.supabase.from('employee_permissions').delete().eq('feature_id', id)
    const { error } = await auth.supabase.from('features').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
