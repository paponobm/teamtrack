import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// POST /api/members/[id]/reset-password - admin resets a member's password
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const { id } = await params
    const body = await request.json()
    const { new_password } = body

    if (!new_password || new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Safety guard: you can only reset the password of someone at a strictly LOWER access
    // level than yourself (consistent with the member edit/deactivate guards). This blocks
    // an admin from resetting a peer admin's (or a super admin's) password.
    if (id !== auth.employee.id) {
        const { data: target } = await auth.supabase
            .from('employees')
            .select('role:roles(level)')
            .eq('id', id)
            .single()
        const targetLevel = (target?.role as unknown as { level: number })?.level ?? 99
        if (targetLevel <= auth.employee.roleLevel) {
            return NextResponse.json({ error: 'You cannot reset the password of a user at your own or a higher access level' }, { status: 403 })
        }
    }

    // Get the user's Supabase Auth ID
    const { data: emp } = await auth.supabase
        .from('employees')
        .select('user_id, name')
        .eq('id', id)
        .single()

    if (!emp || !emp.user_id) {
        return NextResponse.json({ error: 'Employee not found or has no auth account' }, { status: 404 })
    }

    // Use admin API to update password directly (no email flow needed)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${emp.user_id}`, {
        method: 'PUT',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: new_password }),
    })

    if (!res.ok) {
        const err = await res.json()
        return NextResponse.json({ error: err.message || 'Failed to reset password' }, { status: 400 })
    }

    // Audit log
    await auth.supabase.from('audit_log').insert({
        actor_id: auth.employee.id,
        module: 'members',
        action: 'password_reset',
        target_id: id,
        details: { actor_name: auth.employee.name, target_name: emp.name },
    })

    return NextResponse.json({ success: true, message: `Password reset for ${emp.name}` })
}
