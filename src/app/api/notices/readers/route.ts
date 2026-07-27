import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/notices/readers?notice_id=xxx - list employees who read a notice
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const noticeId = searchParams.get('notice_id')

    if (!noticeId) {
        return NextResponse.json({ error: 'notice_id is required' }, { status: 400 })
    }

    const supabase = auth.supabase

    const { data, error } = await supabase
        .from('notice_reads')
        .select(`
            read_at,
            employee:employees!employee_id(id, name, employee_id, avatar_url)
        `)
        .eq('notice_id', noticeId)
        .order('read_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const readers = (data || []).map(r => ({
        name: (r.employee as unknown as { name: string })?.name || 'Unknown',
        employee_id: (r.employee as unknown as { employee_id: string })?.employee_id || '',
        avatar_url: (r.employee as unknown as { avatar_url: string | null })?.avatar_url || null,
        read_at: r.read_at,
    }))

    return NextResponse.json(readers)
}
