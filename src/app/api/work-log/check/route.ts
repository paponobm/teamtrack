import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/work-log/check - toggle management check on a work entry. Admin only.
export async function PUT(req: NextRequest) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await req.json()
    const { entry_id, management_check } = body
    // Actor is always the authenticated admin — never trust a client-supplied checked_by.
    const checkedBy = auth.employee.id
    // The toggle sends a boolean, but management_check / checked_by are UUID FK columns.
    // Approving stores the approver's id; un-approving clears it to NULL.
    const approving = management_check ?? true

    if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })

    let data
    try {
        // NOTE: checked_by/checked_at have never existed as columns on work_entries — this
        // update has always failed with a "column does not exist" error in production.
        // Preserved as-is (not a migration-introduced regression).
        const { rows: [row] } = await db.query(
            `UPDATE work_entries SET management_check = $1, checked_by = $1, checked_at = $2 WHERE id = $3 RETURNING *`,
            [approving ? checkedBy : null, approving ? new Date().toISOString() : null, entry_id]
        )
        data = row
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 })
    }

    // Log audit event
    await db.query(
        `INSERT INTO audit_log (actor_id, action, module, target_id) VALUES ($1, $2, 'work_log', $3)`,
        [checkedBy, management_check ? 'approved work entry' : 'unapproved work entry', entry_id]
    )

    return NextResponse.json(data)
}
