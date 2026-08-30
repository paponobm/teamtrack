import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// PATCH /api/attendance/[id] - update attendance record (clock out, status change, notes). Admin only.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id } = await params
    const body = await request.json()

    // Get old record for logging
    const { rows: [oldRecord] } = await db.query(
        `SELECT clock_in, clock_out, status, notes FROM attendance WHERE id = $1`,
        [id]
    )

    const updateFields: Record<string, unknown> = {}
    if (body.clock_out !== undefined) updateFields.clock_out = body.clock_out
    if (body.clock_in !== undefined) updateFields.clock_in = body.clock_in
    if (body.status !== undefined) updateFields.status = body.status
    if (body.notes !== undefined) updateFields.notes = body.notes

    const keys = Object.keys(updateFields)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `WITH upd AS (
            UPDATE attendance SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *
         )
         SELECT a.*,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'designation', e.designation,
                'department', json_build_object('id', d.id, 'name', d.name)) AS employee
         FROM upd a LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN departments d ON d.id = e.department_id`,
        [id, ...keys.map(k => updateFields[k])]
    )

    if (!data) return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })

    // Log changes
    const actor = auth.employee
    const changes: string[] = []
    if (body.clock_out !== undefined && body.clock_out !== oldRecord?.clock_out) {
        changes.push(`clock_out: ${oldRecord?.clock_out || 'none'} → ${body.clock_out}`)
    }
    if (body.clock_in !== undefined && body.clock_in !== oldRecord?.clock_in) {
        changes.push(`clock_in: ${oldRecord?.clock_in || 'none'} → ${body.clock_in}`)
    }
    if (body.status !== undefined && body.status !== oldRecord?.status) {
        changes.push(`status: ${oldRecord?.status || 'none'} → ${body.status}`)
    }

    if (changes.length > 0) {
        await db.query(
            `INSERT INTO audit_log (actor_id, module, action, target_id, old_value, new_value, details)
             VALUES ($1, 'attendance', 'update', $2, $3, $4, $5)`,
            [
                actor.id, id,
                JSON.stringify({ clock_out: oldRecord?.clock_out, status: oldRecord?.status }),
                JSON.stringify(updateFields),
                JSON.stringify({ actor_name: actor.name, changes }),
            ]
        )
    }

    return NextResponse.json(data)
}

// DELETE /api/attendance/[id] - hard delete an attendance record (Super Admin only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id } = await params
    await db.query(`DELETE FROM attendance WHERE id = $1`, [id])

    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, details)
         VALUES ($1, 'attendance', 'delete', $2, $3)`,
        [auth.employee.id, id, JSON.stringify({ actor_name: auth.employee.name })]
    )

    return NextResponse.json({ message: 'Attendance record deleted' })
}
