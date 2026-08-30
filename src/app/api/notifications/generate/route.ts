import { pool } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse, NextRequest } from 'next/server'

// POST /api/notifications/generate - generate smart notifications
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Fallback to Admin session check if not a Vercel cron hit
        const auth = await requireAuth(3)
        if (!isAuthed(auth)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = pool
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const notifications: { recipient_id: string; title: string; message: string; type: string; is_read: boolean }[] = []

    async function adminIdsForRoles(roleNames: string[]): Promise<string[]> {
        const { rows } = await db.query(
            `SELECT e.id FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE r.name = ANY($1)`,
            [roleNames]
        )
        return rows.map(r => r.id)
    }

    // 1. High-value orders (2000+)
    const { rows: highOrders } = await db.query(
        `SELECT id, amount, employee_id, customer_phone, date FROM work_entries WHERE amount >= 2000 AND date = $1`,
        [today]
    )

    if (highOrders.length) {
        const adminIds = await adminIdsForRoles(['Owner', 'Admin', 'Super Admin', 'Manager'])
        for (const order of highOrders) {
            for (const adminId of adminIds) {
                // Don't self-notify
                if (adminId === order.employee_id) continue
                notifications.push({
                    recipient_id: adminId,
                    title: '🎯 High-value order!',
                    message: `Order ৳${Number(order.amount).toLocaleString()} from ${order.customer_phone || 'customer'} today`,
                    type: 'high_value_order',
                    is_read: false,
                })
            }
        }
    }

    // 2. Unresolved problems (24h+)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const { rows: oldProblems } = await db.query(
        `SELECT id, problem_no, problem_details, problem_peek, created_at
         FROM problems WHERE status = ANY($1) AND created_at < $2 LIMIT 20`,
        [['open', 'in_progress'], yesterday]
    )

    if (oldProblems.length) {
        const adminIds = await adminIdsForRoles(['Owner', 'Admin', 'Super Admin'])
        for (const prob of oldProblems) {
            for (const adminId of adminIds) {
                notifications.push({
                    recipient_id: adminId,
                    title: '⚠️ Unresolved problem',
                    message: `${prob.problem_no}: "${(prob.problem_details || '').slice(0, 60)}" open for 24h+`,
                    type: 'unresolved_problem',
                    is_read: false,
                })
            }
        }
    }

    // 3. Attendance anomalies - check if any active employees have no clock-in today
    const { rows: activeEmployees } = await db.query(`SELECT id, name FROM employees WHERE is_active = true`)
    const { rows: todayAttendance } = await db.query(`SELECT employee_id FROM attendance WHERE date = $1`, [today])

    const clockedInIds = new Set(todayAttendance.map(a => a.employee_id))

    // Only after 10 AM local time (UTC+6)
    const localHour = (now.getUTCHours() + 6) % 24
    if (localHour >= 10) {
        const absent = activeEmployees.filter(e => !clockedInIds.has(e.id))
        if (absent.length > 0) {
            const adminIds = await adminIdsForRoles(['Owner', 'Admin', 'Super Admin'])
            for (const adminId of adminIds) {
                notifications.push({
                    recipient_id: adminId,
                    title: '📋 Attendance alert',
                    message: `${absent.length} employee${absent.length > 1 ? 's' : ''} haven't clocked in: ${absent.slice(0, 3).map(e => e.name).join(', ')}${absent.length > 3 ? '...' : ''}`,
                    type: 'attendance_anomaly',
                    is_read: false,
                })
            }
        }
    }

    // Deduplicate - don't insert if same type+recipient+today already exists
    if (notifications.length > 0) {
        const { rows: existing } = await db.query(
            `SELECT recipient_id, type FROM notifications WHERE created_at >= $1`,
            [`${today}T00:00:00`]
        )

        const existingKeys = new Set(existing.map(e => `${e.recipient_id}:${e.type}`))
        const newNotifs = notifications.filter(n => !existingKeys.has(`${n.recipient_id}:${n.type}`))

        if (newNotifs.length > 0) {
            await db.query(
                `INSERT INTO notifications (recipient_id, title, message, type, is_read)
                 SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::text[], $5::boolean[])`,
                [
                    newNotifs.map(n => n.recipient_id),
                    newNotifs.map(n => n.title),
                    newNotifs.map(n => n.message),
                    newNotifs.map(n => n.type),
                    newNotifs.map(n => n.is_read),
                ]
            )
            return NextResponse.json({ generated: newNotifs.length, total_candidates: notifications.length })
        }
    }

    return NextResponse.json({ generated: 0, message: 'No new notifications to generate' })
}
