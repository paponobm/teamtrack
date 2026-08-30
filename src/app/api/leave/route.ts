import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// POST /api/leave - create a leave record + auto-notice (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ to create leave
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { employee_id, date, reason, auto_notice } = body

    if (!employee_id || !date) {
        return NextResponse.json({ error: 'employee_id and date are required' }, { status: 400 })
    }

    // Get employee name for notice
    const { rows: [emp] } = await db.query(
        `SELECT id, name, designation FROM employees WHERE id = $1`,
        [employee_id]
    )

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    // Create leave record
    let leaveRecord = null
    try {
        const { rows: [data] } = await db.query(
            `INSERT INTO leave_records (employee_id, leave_date, reason, status)
             VALUES ($1, $2, $3, 'approved') RETURNING *`,
            [employee_id, date, reason || 'Personal']
        )
        leaveRecord = data
    } catch (err) {
        console.error('Leave record insert failed:', err instanceof Error ? err.message : err)
        // If table doesn't exist, still create the notice
    }

    // Auto-create noticeboard notice
    if (auto_notice) {
        const dateFormatted = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        })

        const noticeContent = `${emp.name}${emp.designation ? ` (${emp.designation})` : ''} is on leave on ${dateFormatted}. Reason: ${reason || 'Personal'}.`

        await db.query(
            `INSERT INTO notices (title, content, type, priority, is_pinned, created_by, expires_at)
             VALUES ($1, $2, 'announcement', 'normal', false, $3, $4)`,
            [
                `🏠 ${emp.name} - On Leave`,
                noticeContent,
                auth.employee.id,
                new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString(),
            ]
        )
    }

    return NextResponse.json(leaveRecord || { success: true, employee_id, date }, { status: 201 })
}

// GET /api/leave - list leave records (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3
    const empId = searchParams.get('employee_id')
    const month = searchParams.get('month')

    const conditions: string[] = []
    const params: unknown[] = []

    if (!isAdmin) {
        params.push(auth.employee.id)
        conditions.push(`lr.employee_id = $${params.length}`)
    } else if (empId) {
        params.push(empId)
        conditions.push(`lr.employee_id = $${params.length}`)
    }

    if (month) {
        const start = `${month}-01`
        const d = new Date(start)
        d.setMonth(d.getMonth() + 1)
        d.setDate(0)
        const end = d.toISOString().split('T')[0]
        params.push(start)
        conditions.push(`lr.leave_date >= $${params.length}`)
        params.push(end)
        conditions.push(`lr.leave_date <= $${params.length}`)
    }

    const { rows } = await db.query(
        `SELECT lr.*, json_build_object('id', e.id, 'name', e.name, 'designation', e.designation) AS employee
         FROM leave_records lr
         LEFT JOIN employees e ON e.id = lr.employee_id
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY lr.leave_date DESC
         LIMIT 100`,
        params
    )

    return NextResponse.json(rows)
}
