import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/attendance/[id]/breaks/[breakId] - edit a break's start/end time (admin only)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; breakId: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id, breakId } = await params
    const body = await request.json().catch(() => ({}))

    const updateFields: Record<string, unknown> = {}
    if (body.start_time !== undefined) updateFields.start_time = body.start_time
    if (body.end_time !== undefined) updateFields.end_time = body.end_time

    // Guard against an End Time landing before Start Time (e.g. editing End first while Start
    // still holds its just-created "now" value from Add Break) — Postgres would happily store
    // it, and every duration computed from it (Break Time, Working Time) would then silently
    // clamp to zero instead of surfacing the mistake.
    if ('start_time' in updateFields || 'end_time' in updateFields) {
        const { rows: [current] } = await db.query(
            `SELECT start_time, end_time FROM attendance_breaks WHERE id = $1 AND attendance_id = $2`,
            [breakId, id]
        )
        if (!current) return NextResponse.json({ error: 'Break not found' }, { status: 404 })
        const effectiveStart = 'start_time' in updateFields ? updateFields.start_time as string | null : current.start_time
        const effectiveEnd = 'end_time' in updateFields ? updateFields.end_time as string | null : current.end_time
        if (effectiveStart && effectiveEnd && new Date(effectiveEnd).getTime() <= new Date(effectiveStart).getTime()) {
            return NextResponse.json({ error: 'End Time must be after Start Time' }, { status: 400 })
        }
    }

    const keys = Object.keys(updateFields)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 3}`)
    const { rows: [data] } = await db.query(
        `UPDATE attendance_breaks SET ${setClauses.join(', ')} WHERE id = $1 AND attendance_id = $2 RETURNING id, start_time, end_time`,
        [breakId, id, ...keys.map(k => updateFields[k])]
    )

    if (!data) return NextResponse.json({ error: 'Break not found' }, { status: 404 })

    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, details)
         VALUES ($1, 'attendance', 'Edited a break', $2, $3)`,
        [auth.employee.id, id, JSON.stringify({ actor_name: auth.employee.name })]
    )

    return NextResponse.json(data)
}

// DELETE /api/attendance/[id]/breaks/[breakId] - remove a break (admin only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; breakId: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id, breakId } = await params
    await db.query(`DELETE FROM attendance_breaks WHERE id = $1 AND attendance_id = $2`, [breakId, id])

    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, details)
         VALUES ($1, 'attendance', 'Deleted a break', $2, $3)`,
        [auth.employee.id, id, JSON.stringify({ actor_name: auth.employee.name })]
    )

    return NextResponse.json({ success: true })
}
