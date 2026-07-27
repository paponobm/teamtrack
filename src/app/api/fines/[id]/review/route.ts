import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const auth = await requireAuth(2) // Only Super Admin (Level <= 2) can review appeals
    if (!isAuthed(auth)) return auth

    const { supabase, employee } = auth

    try {
        const payload = await request.json()
        const { action } = payload // 'waive' or 'reject'

        if (!action || !['waive', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action. Use waive or reject' }, { status: 400 })
        }

        const { data: fine, error: fetchError } = await supabase
            .from('fines')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError || !fine) {
            return NextResponse.json({ error: 'Fine not found' }, { status: 404 })
        }

        if (fine.status !== 'Appealed') {
            return NextResponse.json({ error: 'Only Appealed fines can be reviewed' }, { status: 400 })
        }

        const newStatus = action === 'waive' ? 'Waived' : 'Active' // If rejected, it goes back to Active

        const { data, error } = await supabase
            .from('fines')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error reviewing fine:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // If waived, refund the points
        if (action === 'waive') {
            await awardPoints(
                supabase,
                fine.member_id,
                Math.abs(fine.amount), // Positive amount to refund
                'Fine Waived',
                fine.id,
                `Fine Waived by Super Admin: ${fine.category}`,
                employee.id
            )
        }

        return NextResponse.json({ data })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
