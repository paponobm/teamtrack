import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/members/me - get the current authenticated user's own employee record
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { data, error } = await auth.supabase
        .from('employees')
        .select(`
            *,
            role:roles(id, name, level),
            department:departments(id, name, name_bn)
        `)
        .eq('id', auth.employee.id)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
