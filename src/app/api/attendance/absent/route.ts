import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/attendance/absent
// Returns active employees who haven't clocked in and whose duty_start_time
// was more than 2 hours ago (or no duty_start_time and it's been 2+ hours since 09:00).
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    // Bangladesh is a fixed UTC+6 offset (no DST); derive "today" from that offset rather than
    // the server's local timezone (UTC by default on a fresh droplet), which would otherwise
    // roll the date over 6 hours early/late relative to Bangladesh's actual calendar day.
    const nowMs = Date.now()
    const today = new Date(nowMs + 6 * 60 * 60 * 1000).toISOString().split('T')[0]
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000

    // Get all active employees with their duty_start_time
    const { rows: employees } = await db.query(
        `SELECT id, name, employee_id, designation, avatar_url, duty_start_time FROM employees WHERE is_active = true`
    )

    if (!employees.length) return NextResponse.json([])

    // Get today's attendance records
    const { rows: attendance } = await db.query(
        `SELECT employee_id, clock_in, status FROM attendance WHERE date = $1`,
        [today]
    )

    const attendedIds = new Set(
        attendance
            .filter(a => a.clock_in || ['present', 'late', 'on_duty'].includes(a.status))
            .map(a => a.employee_id)
    )
    const onLeaveIds = new Set(
        attendance
            .filter(a => ['leave', 'half_day'].includes(a.status))
            .map(a => a.employee_id)
    )

    const absent = employees.filter(emp => {
        // Skip if already clocked in or on approved leave
        if (attendedIds.has(emp.id) || onLeaveIds.has(emp.id)) return false

        // Determine their shift start: duty_start_time or fallback to 09:00, built with an
        // explicit +06:00 offset (see the "today" comment above for why).
        const startTime = emp.duty_start_time || '09:00:00'
        const [h, m] = startTime.split(':').map(Number)
        const pad = (n: number) => String(n).padStart(2, '0')
        const shiftStart = new Date(`${today}T${pad(h)}:${pad(m)}:00+06:00`)

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
