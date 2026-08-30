import { pool } from '@/lib/db'

/**
 * Centralized Audit Logger
 * Logs actions securely to the `audit_log` table.
 *
 * @param actorId - UUID of the employee performing the action
 * @param action - Human readable action (e.g., "Created task", "Deleted work log entry")
 * @param module - Module identifier (e.g., "tasks", "work_log", "problems", "content")
 * @param targetId - (Optional) UUID of the specific record affected
 * @param details - (Optional) Additional JSON payload
 */
export async function logAudit(
    actorId: string,
    action: string,
    module: string,
    targetId?: string | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any
) {
    if (!actorId) return

    // Insert audit log and get the ID
    let auditLogId: string | null = null
    try {
        const { rows: [row] } = await pool.query(
            `INSERT INTO audit_log (actor_id, action, module, target_id, details) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [actorId, action, module, targetId || null, JSON.stringify(details || {})]
        )
        auditLogId = row?.id || null
    } catch (e) {
        console.error('[Audit Log Catch Error]', e)
    }

    // Async notification logic
    ;(async () => {
        try {
            const { rows: [actor] } = await pool.query(
                `SELECT e.id, e.name, r.level FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE e.id = $1`,
                [actorId]
            )

            // Only notify if actor is a regular member (level > 3)
            const roleLevel = actor?.level
            if (!roleLevel || roleLevel <= 3) return

            // Get all admins (level <= 3)
            const { rows: admins } = await pool.query(
                `SELECT e.id FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE r.level <= 3`
            )
            if (!admins.length) return

            const moduleName = module.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

            await pool.query(
                `INSERT INTO notifications (recipient_id, title, message, type, related_entity_type, related_entity_id, is_read)
                 SELECT recipient_id, $2, $3, 'member_activity', 'audit_log', $4, false
                 FROM UNNEST($1::uuid[]) AS recipient_id`,
                [
                    admins.map(a => a.id),
                    `Activity: ${moduleName}`,
                    `${actor?.name || 'A member'} ${action.toLowerCase()}`,
                    auditLogId,
                ]
            )
        } catch (err) {
            console.error('[Audit Notification Error]', err)
        }
    })()
}
