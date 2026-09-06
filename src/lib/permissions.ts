import type { Pool, PoolClient } from 'pg'

// Every page the Access tab (Members → Edit Member → Access) actually exposes as its own
// toggle — see PAGE_DEFINITIONS in src/components/members/MemberModal.tsx. Deliberately NOT
// "every row in the features table": several feature slugs (e.g. work-log's sibling slugs like
// orders-2000-plus, suggest-orders, daily-order-submit — see the Work Log sidebar item's
// multi-slug OR check) exist only as alternate access paths bundled into one togglable page and
// have no toggle of their own. Seeding those too would silently re-open a page a Super Admin
// explicitly turned off for one Admin, defeating the whole point of this list.
const ADMIN_DEFAULT_SLUGS = [
    'notice-board', 'members', 'employee-attendance', 'work-log', 'pr-sending', 'problem-box',
    'tasks', 'courier', 'product-buy', 'requisitions', 'idea-sharing', 'content', 'memories',
]

// Grants an Admin (role level 3) full default access to every togglable page except
// Finance/Payroll Management, which only Owner/Super Admin get automatically — a Super Admin
// must explicitly grant those two to a specific Admin, same as for a Manager/Member.
//
// Called whenever an employee is created as, or promoted to, Admin — a plain Admin no longer
// gets a blanket runtime bypass (see /api/permissions/me), so without this they'd start with no
// visible pages at all. Uses ON CONFLICT DO NOTHING so it never overwrites a Super Admin's
// existing customization for this employee (including an explicit "no_access" restriction) — it
// only fills in gaps left by rows that don't exist yet.
export async function seedAdminPermissions(db: Pool | PoolClient, employeeId: string) {
    const { rows: features } = await db.query(
        `SELECT id FROM features WHERE slug = ANY($1)`,
        [ADMIN_DEFAULT_SLUGS]
    )
    if (features.length === 0) return

    await db.query(
        `INSERT INTO employee_permissions (employee_id, feature_id, access_level)
         SELECT $1, *, 'admin' FROM UNNEST($2::uuid[])
         ON CONFLICT (employee_id, feature_id) DO NOTHING`,
        [employeeId, features.map((f: { id: string }) => f.id)]
    )
}
