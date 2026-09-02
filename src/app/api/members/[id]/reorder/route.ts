import { NextResponse } from 'next/server'

import { requireAuth, isAuthed } from '@/lib/auth'

// PATCH /api/members/[id]/reorder - move a member to a new serial-number position (Admin+),
// shifting everyone between the old and new slot by one to keep sort_order a dense 1..N sequence.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db
    const { id } = await params
    const { new_position: newPosition } = await request.json()

    if (!Number.isInteger(newPosition) || newPosition < 1) {
        return NextResponse.json({ error: 'Position must be a whole number of at least 1' }, { status: 400 })
    }

    const { rows: [{ count }] } = await db.query(`SELECT COUNT(*)::int AS count FROM employees`)
    if (newPosition > count) {
        return NextResponse.json({ error: `Position must be between 1 and ${count} (total members)` }, { status: 400 })
    }

    const { rows: [target] } = await db.query(`SELECT sort_order FROM employees WHERE id = $1`, [id])
    if (!target) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    // sort_order is backfilled for every existing row and assigned on every new insert, so this
    // should never be null in practice — treat it as "already last" if it somehow is.
    const oldPosition = target.sort_order ?? count

    if (oldPosition !== newPosition) {
        if (newPosition < oldPosition) {
            // Moving up the list: everyone from the target slot up to (but not including) the
            // old slot shifts down one to make room.
            await db.query(
                `UPDATE employees SET sort_order = sort_order + 1
                 WHERE sort_order >= $1 AND sort_order < $2 AND id != $3`,
                [newPosition, oldPosition, id]
            )
        } else {
            // Moving down the list: everyone between the old slot and the target slot shifts up one.
            await db.query(
                `UPDATE employees SET sort_order = sort_order - 1
                 WHERE sort_order <= $1 AND sort_order > $2 AND id != $3`,
                [newPosition, oldPosition, id]
            )
        }
        await db.query(`UPDATE employees SET sort_order = $1 WHERE id = $2`, [newPosition, id])
    }

    return NextResponse.json({ message: 'Reordered', sort_order: newPosition })
}
