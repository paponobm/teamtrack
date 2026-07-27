import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/ideas (any employee)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = auth.supabase
        .from('ideas')
        .select(`*, author:employees!contributor(id, name, employee_id, avatar_url)`)
        .order('created_at', { ascending: false })

    if (status && status !== 'all') query = query.eq('status', status)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ideas = data || []
    const stats = {
        total: ideas.length,
        submitted: ideas.filter(i => i.status === 'submitted').length,
        accepted: ideas.filter(i => i.status === 'accepted').length,
        implemented: ideas.filter(i => i.status === 'implemented').length,
    }

    return NextResponse.json({ ideas, stats })
}

// POST /api/ideas (+5 points)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    const { data, error } = await auth.supabase
        .from('ideas')
        .insert({
            date: new Date().toISOString().split('T')[0],
            title: body.title,
            description: body.description || null,
            contributor: auth.employee.id,
            category: body.category || 'General',
            priority: body.priority || 'medium',
            status: 'submitted',
            approval_status: 'pending',
            reference_links: body.reference_links || null,
        })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ...data, awardedPoints: 0 }, { status: 201 })
}

// PUT /api/ideas (+5 points on accepted) - admin only for approval / status changes
export async function PUT(request: Request) {
    const auth = await requireAuth(3) // Admin+ only — approving/rejecting/implementing is an admin action
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Check old status before update
    const { data: oldIdea } = await auth.supabase.from('ideas').select('status, contributor').eq('id', id).single()

    const { data, error } = await auth.supabase
        .from('ideas')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let awardedPoints = 0
    // Award 5 points when idea is accepted (instead of on submission)
    if (updates.status === 'accepted' && oldIdea?.status !== 'accepted' && oldIdea?.contributor) {
        await awardPoints(auth.supabase, oldIdea.contributor, 5, 'idea', id, 'Idea accepted', auth.employee.id)
        if (oldIdea.contributor === auth.employee.id) {
            awardedPoints = 5
        }
    }

    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/ideas (admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await auth.supabase.from('ideas').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
