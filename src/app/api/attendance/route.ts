import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

const EMPLOYEE_JOIN = `
    json_build_object(
        'id', e.id, 'name', e.name, 'employee_id', e.employee_id, 'designation', e.designation,
        'avatar_url', e.avatar_url, 'duty_start_time', e.duty_start_time,
        'department', json_build_object('id', d.id, 'name', d.name)
    ) AS employee
`

// GET /api/attendance - list attendance records (admin sees all, member sees own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3

    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const employeeId = searchParams.get('employee_id') || ''

    const conditions = ['a.date = $1']
    const params: unknown[] = [date]

    if (!isAdmin) {
        params.push(auth.employee.id)
        conditions.push(`a.employee_id = $${params.length}`)
    } else if (employeeId) {
        params.push(employeeId)
        conditions.push(`a.employee_id = $${params.length}`)
    }

    const { rows } = await db.query(
        `SELECT a.*, ${EMPLOYEE_JOIN}
         FROM attendance a
         LEFT JOIN employees e ON e.id = a.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.clock_in ASC NULLS LAST`,
        params
    )

    return NextResponse.json(rows)
}

// POST /api/attendance - mark attendance (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+ to mark attendance
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { employee_id, date, clock_in, status, notes } = body

    if (!employee_id || !date) {
        return NextResponse.json(
            { error: 'employee_id and date are required' },
            { status: 400 }
        )
    }

    // Safety guard: Admins cannot override their own attendance manually
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin && employee_id === auth.employee.id) {
        return NextResponse.json({ error: 'Admins cannot manually override their own attendance records' }, { status: 403 })
    }

    const { rows: [data] } = await db.query(
        `WITH ups AS (
            INSERT INTO attendance (employee_id, date, clock_in, status, notes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (employee_id, date) DO UPDATE SET
                clock_in = EXCLUDED.clock_in, status = EXCLUDED.status, notes = EXCLUDED.notes
            RETURNING *
         )
         SELECT a.*, ${EMPLOYEE_JOIN}
         FROM ups a LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN departments d ON d.id = e.department_id`,
        [employee_id, date, clock_in || null, status || 'present', notes || null]
    )

    return NextResponse.json(data, { status: 201 })
}
