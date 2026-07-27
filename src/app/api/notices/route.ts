import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/notices - list notices with read counts
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const showAll = searchParams.get('all') === 'true'

    let query = supabase
        .from('notices')
        .select(`
            *,
            author:employees!created_by(id, name, employee_id, avatar_url)
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        // Auto-generated "on leave" notices must not appear on the noticeboard (their title
        // ends with "- On Leave"). The "Out Today" widget already covers that info.
        .not('title', 'ilike', '%- On Leave')

    if (!showAll) {
        query = query.or(`expires_at.is.null,expires_at.gte.${new Date().toISOString().split('T')[0]}`)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch read counts for all notices
    const noticeIds = (data || []).map(n => n.id)
    let readCounts: Record<string, number> = {}
    let userReadIds: string[] = []

    if (noticeIds.length > 0) {
        // Get read counts per notice
        const { data: reads } = await supabase
            .from('notice_reads')
            .select('notice_id')
            .in('notice_id', noticeIds)

        if (reads) {
            reads.forEach(r => {
                readCounts[r.notice_id] = (readCounts[r.notice_id] || 0) + 1
            })
        }

        // Get current user's read notices
        try {
            const { data: myReads } = await supabase
                .from('notice_reads')
                .select('notice_id')
                .eq('employee_id', auth.employee.id)
                .in('notice_id', noticeIds)
            userReadIds = (myReads || []).map(r => r.notice_id)
        } catch {
            // If can't get user reads, just skip
        }
    }

    const enriched = (data || []).map(n => ({
        ...n,
        read_count: readCounts[n.id] || 0,
        is_read: userReadIds.includes(n.id),
    }))

    return NextResponse.json(enriched)
}

// POST /api/notices - create a new notice (admin/super admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const employee = auth.employee

    const body = await request.json()
    const { title, content, type, priority, is_pinned, expires_at } = body

    if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('notices')
        .insert({
            title,
            content: content || null,
            type: type || 'notice',
            priority: priority || 'normal',
            is_pinned: is_pinned || false,
            created_by: employee!.id,
            expires_at: expires_at || null,
        })
        .select(`
            *,
            author:employees!created_by(id, name, employee_id, avatar_url)
        `)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}

// PUT /api/notices - update a notice
export async function PUT(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const body = await request.json()
    const { id, title, content, type, priority, is_pinned, expires_at } = body

    if (!id) {
        return NextResponse.json({ error: 'Notice ID is required' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('notices')
        .update({
            title,
            content,
            type,
            priority,
            is_pinned,
            expires_at: expires_at || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(`
            *,
            author:employees!created_by(id, name, employee_id, avatar_url)
        `)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// DELETE /api/notices - delete a notice
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Notice ID is required' }, { status: 400 })
    }

    const { error } = await supabase
        .from('notices')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Notice deleted' })
}
