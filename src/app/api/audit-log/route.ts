import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/audit-log - list recent audit log entries
export async function GET(req: NextRequest) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0')
    const search = req.nextUrl.searchParams.get('search')
    const module = req.nextUrl.searchParams.get('module')
    const startDate = req.nextUrl.searchParams.get('start_date')
    const endDate = req.nextUrl.searchParams.get('end_date')
    const id = req.nextUrl.searchParams.get('id')

    if (id) {
        const { data, error } = await supabase
            .from('audit_log')
            .select('*, actor:employees!actor_id(name)')
            .eq('id', id)
            .single()
        
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ entry: data })
    }

    let query = supabase
        .from('audit_log')
        .select('*, actor:employees!actor_id(name)', { count: 'exact' })
        .order('created_at', { ascending: false })

    if (search) query = query.ilike('action', `%${search}%`)
    if (module && module !== 'all') query = query.eq('module', module)
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ entries: data || [], total: count || 0 })
}

// POST /api/audit-log - log an action
export async function POST(req: NextRequest) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await req.json()

    const { action, module, target_id, details } = body

    if (!action || !module) {
        return NextResponse.json({ error: 'action and module required' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('audit_log')
        // Always stamp the actor from the authenticated session — never trust a client-supplied actor_id.
        .insert({ actor_id: auth.employee.id, action, module, target_id, details })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
}
