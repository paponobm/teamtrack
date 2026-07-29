import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/attendance/[id]/breaks - list breaks for an attendance record (admin only)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const { data, error } = await auth.supabase
        .from('attendance_breaks')
        .select('id, start_time, end_time')
        .eq('attendance_id', id)
        .order('start_time', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
}

// POST /api/attendance/[id]/breaks - add a break to an attendance record (admin only)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const start_time = body.start_time || new Date().toISOString()
    const end_time = body.end_time || null

    const { data, error } = await auth.supabase
        .from('attendance_breaks')
        .insert({ attendance_id: id, start_time, end_time })
        .select('id, start_time, end_time')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auth.supabase.from('audit_log').insert({
        actor_id: auth.employee.id,
        module: 'attendance',
        action: 'Added a break',
        target_id: id,
        details: { actor_name: auth.employee.name },
    }).then(() => { })

    return NextResponse.json(data, { status: 201 })
}
