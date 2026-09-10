import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// POST /api/work-reports/[id]/verify - Management Check: a role-hierarchy verification chain,
// separate from the points-based Work Comparison evaluation. A viewer may record Yes/No on a
// report only if the report's owner sits strictly below them in the role hierarchy (Manager
// verifies Member; Admin verifies Manager/Member; Super Admin/Owner verifies anyone) — the same
// rule GET /api/work-reports uses to decide `can_verify`, so a report only shows the option
// when this endpoint would actually accept it.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db
    const { id } = await params

    const body = await request.json().catch(() => ({}))
    const { management_check, note } = body
    if (management_check !== 'yes' && management_check !== 'no') {
        return NextResponse.json({ error: "management_check must be 'yes' or 'no'" }, { status: 400 })
    }
    const checkedNote = typeof note === 'string' && note.trim() ? note.trim() : null

    const { rows: [report] } = await db.query(
        `SELECT wr.employee_id, wr.management_check, r.level AS employee_role_level
         FROM work_reports wr LEFT JOIN employees e ON e.id = wr.employee_id LEFT JOIN roles r ON r.id = e.role_id
         WHERE wr.id = $1`,
        [id]
    )
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    if (report.employee_id === auth.employee.id) {
        return NextResponse.json({ error: 'You cannot verify your own report' }, { status: 403 })
    }

    // Once a decision is recorded it's final — re-verifying (even by someone else higher up the
    // chain) would let a Yes/No be silently swapped after the fact.
    if (report.management_check) {
        return NextResponse.json({ error: 'This report has already been checked and cannot be changed' }, { status: 409 })
    }

    const isSuperAdmin = auth.employee.roleLevel <= 2
    const canVerify = isSuperAdmin || (report.employee_role_level != null && report.employee_role_level > auth.employee.roleLevel)
    if (!canVerify) {
        return NextResponse.json({ error: 'You can only verify reports from someone below you in the role hierarchy' }, { status: 403 })
    }

    const { rows: [data] } = await db.query(
        `WITH upd AS (
            UPDATE work_reports SET management_check = $1, checked_by = $2, checked_at = NOW(), checked_note = $3 WHERE id = $4
            RETURNING management_check, checked_at, checked_by, checked_note
         )
         SELECT upd.management_check, upd.checked_at, upd.checked_note, e.id AS checker_id, e.name AS checker_name, e.designation AS checker_designation
         FROM upd LEFT JOIN employees e ON e.id = upd.checked_by`,
        [management_check, auth.employee.id, checkedNote, id]
    )

    await logAudit(auth.employee.id, `Marked a daily work report as ${management_check === 'yes' ? 'checked (Yes)' : 'checked (No)'}`, 'work_reports', id)

    return NextResponse.json({
        management_check: data.management_check,
        checked_at: data.checked_at,
        checked_note: data.checked_note,
        checked_by: { id: data.checker_id, name: data.checker_name, designation: data.checker_designation ?? null },
    })
}
