import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        const auth = await requireAuth(3) // Admin+
        if (!isAuthed(auth)) return auth

        const supabase = auth.supabase

        const url = new URL(request.url)
        const all = url.searchParams.get('all') === 'true'

        let query = supabase
            .from('point_withdrawals')
            .select(`
                id,
                amount,
                status,
                requested_at,
                processed_at,
                employee:employee_id(name, avatar_url),
                processor:processed_by(name)
            `)
            .order('requested_at', { ascending: false })

        if (!all) {
            query = query.eq('status', 'pending')
        }

        const { data, error } = await query

        if (error) {
            console.error('Fetch pending error:', error)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        return NextResponse.json({ requests: data })

    } catch (error) {
        console.error('Pending withdrawals API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
