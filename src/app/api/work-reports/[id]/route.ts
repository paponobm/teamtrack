import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// PATCH /api/work-reports/[id] - edit a report. Owners may only edit today's own report;
// admins may edit any report.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id } = await params
    const isAdmin = auth.employee.roleLevel <= 3

    const { rows: [existing] } = await db.query(`SELECT employee_id, date FROM work_reports WHERE id = $1`, [id])

    if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]
    const isOwner = existing.employee_id === auth.employee.id
    if (!isAdmin && (!isOwner || existing.date !== today)) {
        return NextResponse.json({ error: 'You can only edit your own report for today' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const updateFields: Record<string, unknown> = {}
    if (body.project !== undefined) updateFields.project = body.project
    if (body.description !== undefined) updateFields.description = body.description
    if (body.hours !== undefined) updateFields.hours = body.hours
    if (body.progress !== undefined) updateFields.progress = body.progress
    if (body.status !== undefined) updateFields.status = body.status
    if (body.attachment_url !== undefined) updateFields.attachment_url = body.attachment_url
    if (body.notes !== undefined) updateFields.notes = body.notes
    if (isAdmin && body.date !== undefined) updateFields.date = body.date
    updateFields.updated_at = new Date().toISOString()

    const keys = Object.keys(updateFields)
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `WITH upd AS (
            UPDATE work_reports SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *
         )
         SELECT wr.id, wr.date, wr.project, wr.description, wr.hours, wr.progress, wr.status, wr.attachment_url, wr.notes, wr.created_at,
            json_build_object('id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'avatar_url', e.avatar_url,
                'department', json_build_object('id', d.id, 'name', d.name)) AS employee
         FROM upd wr LEFT JOIN employees e ON e.id = wr.employee_id LEFT JOIN departments d ON d.id = e.department_id`,
        [id, ...keys.map(k => updateFields[k])]
    )

    if (!data) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    await logAudit(auth.employee.id, `Updated a daily work report for ${data.project}`, 'work_reports', id)

    return NextResponse.json(data)
}

// DELETE /api/work-reports/[id] - admin only
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { id } = await params

    const { rows: [report] } = await db.query(`SELECT employee_id, project FROM work_reports WHERE id = $1`, [id])
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    // If this report was already scored via Work Comparison, reverse exactly the points
    // it was awarded — total_points and point_transactions history stay accurate instead
    // of keeping points for a report that no longer exists. work_evaluation_items rows
    // themselves cascade-delete with the report, so read them before deleting.
    const { rows: scoredItems } = await db.query(`SELECT points FROM work_evaluation_items WHERE work_report_id = $1`, [id])
    const pointsToReverse = scoredItems.reduce((sum, it) => sum + (it.points || 0), 0)

    await db.query(`DELETE FROM work_reports WHERE id = $1`, [id])

    if (pointsToReverse > 0) {
        await awardPoints(
            db,
            report.employee_id,
            -pointsToReverse,
            'work_evaluation_reversal',
            id,
            `Work report deleted — reversing ${pointsToReverse} pt(s) previously awarded for "${report.project}"`,
            auth.employee.id
        )
    }

    await logAudit(auth.employee.id, 'Deleted a daily work report', 'work_reports', id)

    return NextResponse.json({ success: true, pointsReversed: pointsToReverse })
}
