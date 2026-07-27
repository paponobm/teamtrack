import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Centralized Audit Logger
 * Logs actions securely to the `audit_log` table using the service role client.
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

    const supabase = createAdminClient()
    
    // Insert audit log and get the ID
    let auditLogId: string | null = null
    try {
        const { data, error } = await supabase.from('audit_log').insert({
            actor_id: actorId,
            action,
            module,
            target_id: targetId || null,
            details: details || {}
        }).select('id').single()
        
        if (error) console.error('[Audit Log Error]', error.message)
        else if (data) auditLogId = data.id
    } catch (e) {
        console.error('[Audit Log Catch Error]', e)
    }

    // Async notification logic
    ;(async () => {
        try {
            const { data: actor } = await supabase
                .from('employees')
                .select('id, name, role:roles(level)')
                .eq('id', actorId)
                .single()

            // Only notify if actor is a regular member (level > 3)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const roleLevel = (actor?.role as any)?.level
            if (!roleLevel || roleLevel <= 3) return

            // Get all admins (level <= 3)
            const { data: adminRoles } = await supabase.from('roles').select('id').lte('level', 3)
            if (!adminRoles?.length) return
            
            const { data: admins } = await supabase
                .from('employees')
                .select('id')
                .in('role_id', adminRoles.map(r => r.id))

            if (!admins?.length) return

            const moduleName = module.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
            
            const notifications = admins.map(admin => ({
                recipient_id: admin.id,
                title: `Activity: ${moduleName}`,
                message: `${actor?.name || 'A member'} ${action.toLowerCase()}`,
                type: 'member_activity',
                related_entity_type: 'audit_log',
                related_entity_id: auditLogId,
                is_read: false
            }))

            await supabase.from('notifications').insert(notifications)
        } catch (err) {
            console.error('[Audit Notification Error]', err)
        }
    })()
}
