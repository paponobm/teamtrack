import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Fund system (V3 #18/#19).
//   allocated = SUM(fund_allocations.amount) for the holder
//   used      = SUM(approved/paid expenses submitted by the holder)
//   remaining = allocated - used
// Admins (level <= 3) can view the transparent gamified overview; only Super Admins allocate.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roleOf = (e: any): { name: string; level: number } | null =>
    Array.isArray(e?.role) ? e.role[0] : e?.role

// GET /api/funds - fund overview
export async function GET() {
    const auth = await requireAuth(3) // Admin+ (transparency among fund holders)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const isSuperAdmin = auth.employee.roleLevel <= 2

    const [allocRes, paidRes, empRes] = await Promise.all([
        supabase.from('fund_allocations')
            .select('id, employee_id, amount, note, created_at, allocator:employees!allocated_by(id, name)')
            .order('created_at', { ascending: false }),
        supabase.from('expenses').select('submitted_by, amount').eq('payment_status', 'paid'),
        supabase.from('employees').select('id, name, avatar_url, is_active, role:roles(name, level)').eq('is_active', true),
    ])

    const allocations = allocRes.data || []
    const paid = paidRes.data || []
    const emps = empRes.data || []

    const allocatedMap: Record<string, number> = {}
    allocations.forEach(a => { allocatedMap[a.employee_id] = (allocatedMap[a.employee_id] || 0) + Number(a.amount || 0) })
    const usedMap: Record<string, number> = {}
    paid.forEach(e => { if (e.submitted_by) usedMap[e.submitted_by] = (usedMap[e.submitted_by] || 0) + Number(e.amount || 0) })

    const empById: Record<string, { id: string; name: string; avatar_url: string | null; role: { name: string; level: number } | null }> = {}
    emps.forEach(e => { empById[e.id] = { id: e.id, name: e.name, avatar_url: e.avatar_url || null, role: roleOf(e) } })

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
        ? emps.filter(e => (roleOf(e)?.level ?? 99) <= 3).map(e => ({ id: e.id, name: e.name }))
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allocations: visibleAllocations.map((a: any) => ({
            id: a.id,
            employee_id: a.employee_id,
            employee_name: empById[a.employee_id]?.name || 'Unknown',
            amount: Number(a.amount || 0),
            note: a.note,
            allocated_by: Array.isArray(a.allocator) ? a.allocator[0]?.name : a.allocator?.name,
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

    const { data, error } = await auth.supabase
        .from('fund_allocations')
        .insert({ employee_id: employeeId, amount, note: body.note || null, allocated_by: auth.employee.id })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/funds?id= - remove an allocation entry (Super Admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await auth.supabase.from('fund_allocations').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
