import { createAdminClient } from '@/lib/supabase/admin'
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

    const supabase = createAdminClient()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const notifications: { recipient_id: string; title: string; message: string; type: string; is_read: boolean }[] = []

    // 1. High-value orders (2000+)
    const { data: highOrders } = await supabase
        .from('work_entries')
        .select('id, amount, employee_id, customer_phone, date')
        .gte('amount', 2000)
        .eq('date', today)

    if (highOrders?.length) {
        // Get all managers/admins to notify
        const { data: admins } = await supabase
            .from('employees')
            .select('id, role_id')
            .in('role_id', (await supabase.from('roles').select('id').in('name', ['Owner', 'Admin', 'Super Admin', 'Manager'])).data?.map(r => r.id) || [])

        const adminIds = admins?.map(a => a.id) || []
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
    const { data: oldProblems } = await supabase
        .from('problems')
        .select('id, problem_no, problem_details, problem_peek, created_at')
        .in('status', ['open', 'in_progress'])
        .lt('created_at', yesterday)
        .limit(20)

    if (oldProblems?.length) {
        const { data: admins } = await supabase
            .from('employees')
            .select('id, role_id')
            .in('role_id', (await supabase.from('roles').select('id').in('name', ['Owner', 'Admin', 'Super Admin'])).data?.map(r => r.id) || [])

        const adminIds = admins?.map(a => a.id) || []
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
    const { data: activeEmployees } = await supabase
        .from('employees')
        .select('id, name')
        .eq('is_active', true)

    const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('employee_id')
        .eq('date', today)

    const clockedInIds = new Set(todayAttendance?.map(a => a.employee_id) || [])

    // Only after 10 AM local time (UTC+6)
    const localHour = (now.getUTCHours() + 6) % 24
    if (localHour >= 10 && activeEmployees) {
        const absent = activeEmployees.filter(e => !clockedInIds.has(e.id))
        if (absent.length > 0) {
            // Notify admins
            const { data: admins } = await supabase
                .from('employees')
                .select('id, role_id')
                .in('role_id', (await supabase.from('roles').select('id').in('name', ['Owner', 'Admin', 'Super Admin'])).data?.map(r => r.id) || [])

            for (const admin of admins || []) {
                notifications.push({
                    recipient_id: admin.id,
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
        const { data: existing } = await supabase
            .from('notifications')
            .select('recipient_id, type')
            .gte('created_at', `${today}T00:00:00`)

        const existingKeys = new Set((existing || []).map(e => `${e.recipient_id}:${e.type}`))
        const newNotifs = notifications.filter(n => !existingKeys.has(`${n.recipient_id}:${n.type}`))

        if (newNotifs.length > 0) {
            const { error } = await supabase.from('notifications').insert(newNotifs)
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ generated: newNotifs.length, total_candidates: notifications.length })
        }
    }

    return NextResponse.json({ generated: 0, message: 'No new notifications to generate' })
}
