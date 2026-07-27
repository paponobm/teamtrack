import { requireAuth, isAuthed } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/attendance/absent
// Returns active employees who haven't clocked in and whose duty_start_time
// was more than 2 hours ago (or no duty_start_time and it's been 2+ hours since 09:00).
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const adminSupabase = createAdminClient()

    const today = new Date().toISOString().split('T')[0]
    const nowMs = Date.now()
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000

    // Get all active employees with their duty_start_time
    const { data: employees } = await adminSupabase
        .from('employees')
        .select('id, name, employee_id, designation, avatar_url, duty_start_time')
        .eq('is_active', true)

    if (!employees?.length) return NextResponse.json([])

    // Get today's attendance records
    const { data: attendance } = await adminSupabase
        .from('attendance')
        .select('employee_id, clock_in, status')
        .eq('date', today)

    const attendedIds = new Set(
        (attendance || [])
            .filter(a => a.clock_in || ['present', 'late', 'on_duty'].includes(a.status))
            .map(a => a.employee_id)
    )
    const onLeaveIds = new Set(
        (attendance || [])
            .filter(a => ['leave', 'half_day'].includes(a.status))
            .map(a => a.employee_id)
    )

    const absent = employees.filter(emp => {
        // Skip if already clocked in or on approved leave
        if (attendedIds.has(emp.id) || onLeaveIds.has(emp.id)) return false

        // Determine their shift start: duty_start_time or fallback to 09:00
        const startTime = emp.duty_start_time || '09:00:00'
        const [h, m] = startTime.split(':').map(Number)
        const shiftStart = new Date(today)
        shiftStart.setHours(h, m, 0, 0)

        // Count as absent only if shift started more than 2 hours ago
        return nowMs - shiftStart.getTime() > TWO_HOURS_MS
    })

    return NextResponse.json(
        absent.map(e => ({
            id: e.id,
            employee: {
                name: e.name,
                employee_id: e.employee_id,
                designation: e.designation,
                avatar_url: e.avatar_url,
            }
        }))
    )
}
