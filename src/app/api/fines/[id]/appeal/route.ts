import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const auth = await requireAuth(5) // Members can appeal
    if (!isAuthed(auth)) return auth

    const { supabase, employee } = auth

    try {
        const payload = await request.json()
        const { appeal_reason } = payload

        if (!appeal_reason) {
            return NextResponse.json({ error: 'Appeal reason is required' }, { status: 400 })
        }

        // Verify the fine exists, belongs to the user, is Active, and within 3 days
        const { data: fine, error: fetchError } = await supabase
            .from('fines')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError || !fine) {
            return NextResponse.json({ error: 'Fine not found' }, { status: 404 })
        }

        if (fine.member_id !== employee.id) {
            return NextResponse.json({ error: 'Unauthorized to appeal this fine' }, { status: 403 })
        }

        if (fine.status !== 'Active') {
            return NextResponse.json({ error: 'Only Active fines can be appealed' }, { status: 400 })
        }

        const createdAt = new Date(fine.created_at)
        const now = new Date()
        const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24)

        if (diffDays > 3) {
            return NextResponse.json({ error: 'Appeal window (3 days) has expired' }, { status: 400 })
        }

        // Update the fine
        const { data, error } = await supabase
            .from('fines')
            .update({
                status: 'Appealed',
                appeal_reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error appealing fine:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
