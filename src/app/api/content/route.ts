import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET /api/content
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const category = searchParams.get('category')

    let query = auth.supabase
        .from('content_batches')
        .select(`
            *,
            creator:employees!created_by(id, name)
        `)
        .order('created_at', { ascending: false })

    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
    if (category && category !== 'all') query = query.eq('category', category)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ items: data || [] })
}

// POST /api/content (Create a new batch)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    if (!body.titles || !Array.isArray(body.titles) || body.titles.length === 0) {
        return NextResponse.json({ error: 'Titles array is required' }, { status: 400 })
    }

    const typeStr = body.type || 'video'

    const inserts = body.titles.map((title: string) => ({
        type: typeStr,
        category: body.category || null,
        titles: [title],
        shoot_done: false,
        edit_done: false,
        upload_done: false,
        created_by: auth.employee.id,
    }))

    const { data, error } = await auth.supabase
        .from('content_batches')
        .insert(inserts)
        .select('*')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    if (data && data.length > 0) {
        await logAudit(auth.employee.id, `Started ${data.length} new content topics`, 'content', data[0].id)
    }
    
    return NextResponse.json(data, { status: 201 })
}

// PUT /api/content (Update batch progress)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    updates.updated_at = new Date().toISOString()

    // Check old batch
    const { data: oldBatch } = await auth.supabase.from('content_batches').select('upload_done, created_by').eq('id', id).single()

    const { data, error } = await auth.supabase
        .from('content_batches')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    await logAudit(auth.employee.id, 'Updated content progress', 'content', id)

    let awardedPoints = 0
    // Award 5 points if upload_done becomes true
    if (updates.upload_done === true && oldBatch?.upload_done !== true) {
        // Need to import awardPoints
        const { awardPoints } = await import('@/lib/auth')
        await awardPoints(auth.supabase, auth.employee.id, 5, 'content', id, 'Completed content upload', null)
        awardedPoints = 5
    }
    
    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/content (Admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await auth.supabase.from('content_batches').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    await logAudit(auth.employee.id, 'Deleted content batch', 'content', id)
    
    return NextResponse.json({ success: true })
}
