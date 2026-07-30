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

    const { id } = await params
    const isAdmin = auth.employee.roleLevel <= 3

    const { data: existing, error: fetchErr } = await auth.supabase
        .from('work_reports')
        .select('employee_id, date')
        .eq('id', id)
        .single()

    if (fetchErr || !existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

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

    const { data, error } = await auth.supabase
        .from('work_reports')
        .update(updateFields)
        .eq('id', id)
        .select(`
            id, date, project, description, hours, progress, status, attachment_url, notes, created_at,
            employee:employees(id, name, employee_id, avatar_url, department:departments(id, name))
        `)
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

    const { id } = await params

    const { data: report, error: fetchErr } = await auth.supabase
        .from('work_reports')
        .select('employee_id, project')
        .eq('id', id)
        .single()
    if (fetchErr || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    // If this report was already scored via Work Comparison, reverse exactly the points
    // it was awarded — total_points and point_transactions history stay accurate instead
    // of keeping points for a report that no longer exists. work_evaluation_items rows
    // themselves cascade-delete with the report, so read them before deleting.
    const { data: scoredItems } = await auth.supabase
        .from('work_evaluation_items')
        .select('points')
        .eq('work_report_id', id)
    const pointsToReverse = (scoredItems || []).reduce((sum, it) => sum + (it.points || 0), 0)

    const { error } = await auth.supabase.from('work_reports').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (pointsToReverse > 0) {
        await awardPoints(
            auth.supabase,
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
