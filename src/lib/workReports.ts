import type { Pool, PoolClient } from 'pg'

type Db = Pool | PoolClient

// Whether this employee can see every employee's Daily Work Report. Visibility is NOT
// role/hierarchy based — by default everyone (Member, Manager, Admin alike) sees only their own
// report (see GET /api/work-reports). This blanket exception is true automatically for Super
// Admin/Owner (roleLevel <= 2); for anyone else, true only if a Super Admin has explicitly
// granted the "Daily Work Report (View All)" feature (Members → Edit Member → Access → Work —
// see PAGE_DEFINITIONS in MemberModal.tsx, slug 'work-report-view-all'). Shared by every place
// that applies this same visibility rule (the report list, its dashboard summary cards, and the
// CSV export) so they can never drift out of sync with each other.
export async function canViewAllWorkReports(db: Db, employeeId: string, roleLevel: number): Promise<boolean> {
    if (roleLevel <= 2) return true
    const { rows: [grant] } = await db.query(
        `SELECT ep.access_level FROM employee_permissions ep
         JOIN features f ON f.id = ep.feature_id
         WHERE ep.employee_id = $1 AND f.slug = 'work-report-view-all'`,
        [employeeId]
    )
    return !!grant && grant.access_level !== 'no_access'
}

// The specific set of other employees whose Daily Work Report this employee has been granted
// visibility into (and, by the same rule, the right to approve) via a targeted work_report_access
// grant — additive to, and independent of, the blanket canViewAllWorkReports() above. A Super
// Admin manages these per-viewer, per-target grants from the "Report Access" tab (see
// ReportAccessManager.tsx) so e.g. one employee can be given visibility into just one other
// specific person's report, without unlocking everyone else's.
export async function getWorkReportAccessTargets(db: Db, viewerId: string): Promise<string[]> {
    const { rows } = await db.query(
        `SELECT target_id FROM work_report_access WHERE viewer_id = $1`,
        [viewerId]
    )
    return rows.map((r: { target_id: string }) => r.target_id)
}

// Which employees this person is allowed to "manage" — assign a task to, or view/evaluate via
// Work Comparison — reusing the exact same Daily Work Report visibility scope above, since both
// features are really asking the same question: "whose work is this person responsible for?".
// Admin+ stays fully unrestricted (returns null, meaning "no restriction — everyone"), unchanged
// from their existing behavior. Anyone else (a Manager, the only other role that can create tasks
// or use Work Comparison) is limited to themselves plus anyone they've been granted access to —
// the blanket "Daily Work Report (View All)" permission, or specific work_report_access grants.
export async function getManageableEmployeeIds(db: Db, employeeId: string, roleLevel: number): Promise<string[] | null> {
    if (roleLevel <= 3) return null
    if (await canViewAllWorkReports(db, employeeId, roleLevel)) return null
    const targets = await getWorkReportAccessTargets(db, employeeId)
    return [employeeId, ...targets]
}
