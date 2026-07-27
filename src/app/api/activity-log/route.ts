import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/activity-log?module=work_log&target_id=xxx
export async function GET(request: Request) {
    const supabase = createAdminClient()
    const userClient = await createClient()
    const { searchParams } = new URL(request.url)

    // Only admin can view logs
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: emp } = await supabase
        .from('employees')
        .select('id, role:roles(level)')
        .eq('user_id', user.id)
        .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleLevel = (emp?.role as any)?.level
    if (!roleLevel || roleLevel > 3) {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const module = searchParams.get('module')
    const targetId = searchParams.get('target_id')
    const actorId = searchParams.get('actor_id')

    let query = supabase
        .from('audit_log')
        .select(`
            *,
            actor:employees!actor_id(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

    if (module) query = query.eq('module', module)
    if (targetId) query = query.eq('target_id', targetId)
    if (actorId) query = query.eq('actor_id', actorId)

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}
