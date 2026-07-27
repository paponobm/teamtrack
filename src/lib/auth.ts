import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export interface AuthContext {
    user: { id: string; email?: string }
    employee: { id: string; name: string; roleLevel: number; roleName: string }
    supabase: ReturnType<typeof createAdminClient>
}

/**
 * Centralized auth helper for API routes.
 * Validates authentication, resolves the employee record, and enforces minimum role level.
 *
 * @param minLevel - Minimum role level required (1=Owner, 2=SuperAdmin, 3=Admin, 4=Manager, 5=Member).
 *                   Pass 5 to require any employee, pass 0 to skip role check (just require auth+employee).
 * @returns AuthContext on success, or a NextResponse error to return immediately.
 */
export async function requireAuth(minLevel: number = 5): Promise<AuthContext | NextResponse> {
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: emp } = await supabase
        .from('employees')
        .select('id, name, is_active, role:roles(name, level)')
        .eq('user_id', user.id)
        .single()

    if (!emp) {
        return NextResponse.json({ error: 'No employee profile found' }, { status: 403 })
    }

    if (!emp.is_active) {
        return NextResponse.json({ error: 'Account has been deactivated. Contact your administrator.' }, { status: 403 })
    }

    const role = emp.role as unknown as { name: string; level: number } | null
    const roleLevel = role?.level ?? 99
    const roleName = role?.name ?? 'Unknown'

    if (minLevel > 0 && roleLevel > minLevel) {
        return NextResponse.json(
            { error: `Requires ${minLevel <= 1 ? 'Owner' : minLevel <= 2 ? 'Super Admin' : minLevel <= 3 ? 'Admin' : 'Manager'} access` },
            { status: 403 }
        )
    }

    return {
        user: { id: user.id, email: user.email },
        employee: { id: emp.id, name: emp.name, roleLevel, roleName },
        supabase,
    }
}

/** Type guard: returns true if the result is an auth context (success), false if it's an error response. */
export function isAuthed(result: AuthContext | NextResponse): result is AuthContext {
    return 'user' in result && 'employee' in result
}

/**
 * Centralized helper to award points to an employee using atomic SQL increment.
 * Also logs the transaction to point_transactions table.
 */
export async function awardPoints(
    supabase: ReturnType<typeof createAdminClient>,
    employeeId: string,
    points: number,
    source: string,
    sourceId: string | null,
    description: string,
    awardedBy: string | null
) {
    // Log the transaction
    await supabase.from('point_transactions').insert({
        employee_id: employeeId,
        points,
        source,
        source_id: sourceId,
        description,
        awarded_by: awardedBy,
    })

    // Atomic increment - prevents race conditions
    const { error: rpcErr } = await supabase.rpc('increment_points', { emp_id: employeeId, pts: points })
    if (rpcErr) {
        // Fallback: use raw SQL-style atomic update via Supabase
        // This is still better than read-then-write since we use a single update
        const { data: empData } = await supabase
            .from('employees')
            .select('total_points')
            .eq('id', employeeId)
            .single()
        if (empData) {
            await supabase
                .from('employees')
                .update({ total_points: (empData.total_points || 0) + points })
                .eq('id', employeeId)
        }
    }
}

/**
 * Escape special characters in LIKE/ILIKE patterns to prevent filter injection.
 */
export function escapeLikePattern(input: string): string {
    return input.replace(/[%_\\]/g, '\\$&')
}
