import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET/POST /api/work-report-access - manage granular, per-target Daily Work Report visibility
// grants (see work_report_access in prisma/schema.prisma and getWorkReportAccessTargets in
// src/lib/workReports.ts). This is additive to, and independent of, the blanket
// "work-report-view-all" feature permission (/api/permissions) — a Super Admin uses this to give
// one specific employee (viewer) visibility into one or more specific OTHER employees' (targets)
// reports, without unlocking everyone's. Managing (POST, or GET without/with someone else's
// viewer_id) is Super-Admin/Owner only; any authenticated employee may GET their OWN grant list
// (?viewer_id=self) since other features (e.g. who a Manager may assign a task to in
// /api/tasks) key off "who can I see" for the current user.

// GET /api/work-report-access?viewer_id= - Super Admin/Owner: list every grant, or just one
// viewer's; anyone else: only their own (viewer_id must equal their own employee id).
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const viewerId = searchParams.get('viewer_id')
    const isSuperAdmin = auth.employee.roleLevel <= 2

    if (!isSuperAdmin && viewerId !== auth.employee.id) {
        return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 })
    }

    const { rows } = await db.query(
        `SELECT id, viewer_id, target_id, created_by, created_at
         FROM work_report_access
         ${viewerId ? 'WHERE viewer_id = $1' : ''}
         ORDER BY created_at`,
        viewerId ? [viewerId] : []
    )

    return NextResponse.json(rows)
}

// POST /api/work-report-access - replace-all: set the complete list of targets a given viewer
// can see, in one call. Body: { viewer_id: string, target_ids: string[] }
export async function POST(request: Request) {
    const auth = await requireAuth(2) // Super Admin/Owner only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const viewerId = body.viewer_id as string | undefined
    const targetIds = body.target_ids as string[] | undefined

    if (!viewerId || !Array.isArray(targetIds)) {
        return NextResponse.json({ error: 'viewer_id and target_ids array required' }, { status: 400 })
    }

    const uniqueTargetIds = [...new Set(targetIds)].filter(t => t !== viewerId)

    await db.query('BEGIN')
    try {
        await db.query(`DELETE FROM work_report_access WHERE viewer_id = $1`, [viewerId])
        if (uniqueTargetIds.length > 0) {
            await db.query(
                `INSERT INTO work_report_access (viewer_id, target_id, created_by)
                 SELECT $1, unnest($2::uuid[]), $3`,
                [viewerId, uniqueTargetIds, auth.employee.id]
            )
        }
        await db.query('COMMIT')
    } catch (err) {
        await db.query('ROLLBACK')
        throw err
    }

    return NextResponse.json({ message: 'Access updated', count: uniqueTargetIds.length })
}
