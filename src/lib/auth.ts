import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { Pool, PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { SESSION_COOKIE, verifySession } from '@/lib/session'

export interface AuthContext {
    user: { id: string; email?: string }
    employee: { id: string; name: string; roleLevel: number; roleName: string }
    db: Pool
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
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const session = token ? await verifySession(token) : null

    if (!session) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Always re-fetched (never trusted from the JWT) so a deactivated account or role change
    // takes effect immediately instead of waiting for the token to expire.
    const { rows: [emp] } = await pool.query(
        `SELECT e.id, e.name, e.is_active, r.name AS role_name, r.level AS role_level
         FROM employees e
         LEFT JOIN roles r ON r.id = e.role_id
         WHERE e.user_id = $1`,
        [session.userId]
    )

    if (!emp) {
        return NextResponse.json({ error: 'No employee profile found' }, { status: 403 })
    }

    if (!emp.is_active) {
        return NextResponse.json({ error: 'Account has been deactivated. Contact your administrator.' }, { status: 403 })
    }

    const roleLevel = emp.role_level ?? 99
    const roleName = emp.role_name ?? 'Unknown'

    if (minLevel > 0 && roleLevel > minLevel) {
        return NextResponse.json(
            { error: `Requires ${minLevel <= 1 ? 'Owner' : minLevel <= 2 ? 'Super Admin' : minLevel <= 3 ? 'Admin' : 'Manager'} access` },
            { status: 403 }
        )
    }

    return {
        user: { id: session.userId, email: session.email },
        employee: { id: emp.id, name: emp.name, roleLevel, roleName },
        db: pool,
    }
}

/** Type guard: returns true if the result is an auth context (success), false if it's an error response. */
export function isAuthed(result: AuthContext | NextResponse): result is AuthContext {
    return 'user' in result && 'employee' in result
}

/**
 * Centralized helper to award points to an employee using an atomic SQL increment.
 * Also logs the transaction to point_transactions table.
 */
export async function awardPoints(
    db: Pool | PoolClient,
    employeeId: string,
    points: number,
    source: string,
    sourceId: string | null,
    description: string,
    awardedBy: string | null
) {
    await db.query(
        `INSERT INTO point_transactions (employee_id, points, source, source_id, description, awarded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [employeeId, points, source, sourceId, description, awardedBy]
    )

    // Atomic increment - a single UPDATE avoids the race condition a read-then-write would have.
    await db.query(
        `UPDATE employees SET total_points = COALESCE(total_points, 0) + $1 WHERE id = $2`,
        [points, employeeId]
    )
}

/**
 * Escape special characters in LIKE/ILIKE patterns to prevent filter injection.
 */
export function escapeLikePattern(input: string): string {
    return input.replace(/[%_\\]/g, '\\$&')
}
