import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/notices/read - mark notice(s) as read by the current user
export async function POST(request: Request) {
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Find employee
    const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

    if (!employee) {
        return NextResponse.json({ error: 'No employee record' }, { status: 404 })
    }

    const body = await request.json()
    const noticeIds: string[] = Array.isArray(body.notice_ids) ? body.notice_ids : [body.notice_id]

    if (noticeIds.length === 0) {
        return NextResponse.json({ error: 'notice_id or notice_ids required' }, { status: 400 })
    }

    const rows = noticeIds.map(nid => ({
        notice_id: nid,
        employee_id: employee.id,
    }))

    const { error } = await supabase
        .from('notice_reads')
        .upsert(rows, { onConflict: 'notice_id,employee_id' })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Marked as read', count: noticeIds.length })
}
