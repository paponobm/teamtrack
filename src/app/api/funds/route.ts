import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Fund system (V3 #18/#19).
//   allocated = SUM(fund_allocations.amount) for the holder
//   used      = SUM(approved/paid expenses submitted by the holder)
//   remaining = allocated - used
// Admins (level <= 3) can view the transparent gamified overview; only Super Admins allocate.

// GET /api/funds - fund overview
export async function GET() {
    const auth = await requireAuth(3) // Admin+ (transparency among fund holders)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const isSuperAdmin = auth.employee.roleLevel <= 2

    const [{ rows: allocations }, { rows: paid }, { rows: emps }] = await Promise.all([
        db.query(
            `SELECT fa.id, fa.employee_id, fa.amount, fa.note, fa.created_at,
                json_build_object('id', al.id, 'name', al.name) AS allocator
             FROM fund_allocations fa LEFT JOIN employees al ON al.id = fa.allocated_by
             ORDER BY fa.created_at DESC`
        ),
        db.query(`SELECT submitted_by, amount FROM expenses WHERE payment_status = 'paid'`),
        db.query(
            `SELECT e.id, e.name, e.avatar_url, e.is_active,
                json_build_object('name', r.name, 'level', r.level) AS role
             FROM employees e LEFT JOIN roles r ON r.id = e.role_id
             WHERE e.is_active = true`
        ),
    ])

    const allocatedMap: Record<string, number> = {}
    allocations.forEach(a => { allocatedMap[a.employee_id] = (allocatedMap[a.employee_id] || 0) + Number(a.amount || 0) })
    const usedMap: Record<string, number> = {}
    paid.forEach(e => { if (e.submitted_by) usedMap[e.submitted_by] = (usedMap[e.submitted_by] || 0) + Number(e.amount || 0) })

    const empById: Record<string, { id: string; name: string; avatar_url: string | null; role: { name: string; level: number } | null }> = {}
    emps.forEach(e => { empById[e.id] = { id: e.id, name: e.name, avatar_url: e.avatar_url || null, role: e.role } })

    // Every employee who has ever received an allocation is a fund holder.
    // A plain Admin must never see another Admin's fund balance — only Super Admin gets the
    // full cross-admin transparency view; a plain Admin's "Team Funds" is just their own card.
    const holderIds = Object.keys(allocatedMap).filter(id => isSuperAdmin || id === auth.employee.id)
    const summary = holderIds.map(id => {
        const e = empById[id]
        const allocated = allocatedMap[id] || 0
        const used = usedMap[id] || 0
        return {
            employee_id: id,
            name: e?.name || 'Unknown',
            avatar_url: e?.avatar_url || null,
            role: e?.role?.name || '-',
            allocated,
            used,
            remaining: allocated - used,
        }
    }).sort((a, b) => b.remaining - a.remaining)

    // Eligible allocation targets for the Super Admin dropdown: active admins (level <= 3).
    const adminTargets = isSuperAdmin
        ? emps.filter(e => (e.role?.level ?? 99) <= 3).map(e => ({ id: e.id, name: e.name }))
        : []

    const myAllocated = allocatedMap[auth.employee.id] || 0
    const myUsed = usedMap[auth.employee.id] || 0

    const totals = summary.reduce((acc, s) => {
        acc.allocated += s.allocated; acc.used += s.used; acc.remaining += s.remaining; return acc
    }, { allocated: 0, used: 0, remaining: 0 })

    const visibleAllocations = isSuperAdmin ? allocations : allocations.filter(a => a.employee_id === auth.employee.id)

    return NextResponse.json({
        isSuperAdmin,
        summary,
        adminTargets,
        myFund: { allocated: myAllocated, used: myUsed, remaining: myAllocated - myUsed },
        allocations: visibleAllocations.map(a => ({
            id: a.id,
            employee_id: a.employee_id,
            employee_name: empById[a.employee_id]?.name || 'Unknown',
            amount: Number(a.amount || 0),
            note: a.note,
            allocated_by: a.allocator?.name,
            created_at: a.created_at,
        })),
        totals,
    })
}

// POST /api/funds - allocate a fund to an admin (Super Admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const employeeId = body.employee_id
    const amount = Number(body.amount)
    if (!employeeId || !amount || amount <= 0) {
        return NextResponse.json({ error: 'A recipient and a positive amount are required' }, { status: 400 })
    }

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO fund_allocations (employee_id, amount, note, allocated_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [employeeId, amount, body.note || null, auth.employee.id]
    )

    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/funds?id= - remove an allocation entry (Super Admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await auth.db.query(`DELETE FROM fund_allocations WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
