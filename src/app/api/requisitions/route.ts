import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET /api/requisitions (admin sees all, members see their own)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
        .from('requisitions')
        .select(`*, requester:employees!requested_by(id, name, employee_id)`)
        .order('created_at', { ascending: false })

    if (!isAdmin) query = query.eq('requested_by', auth.employee.id)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const reqs = data || []
    const stats = {
        total: reqs.length,
        pending: reqs.filter(r => r.manager_approval === 'pending').length,
        approved: reqs.filter(r => r.manager_approval === 'approved' && r.management_approval === 'approved').length,
        rejected: reqs.filter(r => r.manager_approval === 'rejected' || r.management_approval === 'rejected').length,
    }

    return NextResponse.json({ requisitions: reqs, stats })
}

// POST /api/requisitions (any employee)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    const { data, error } = await auth.supabase
        .from('requisitions')
        .insert({
            date: body.date || new Date().toISOString().split('T')[0],
            requested_by: auth.employee.id,
            item_description: body.item_description,
            quantity: body.quantity || 1,
            reason: body.reason || null,
            priority: body.priority || 'medium',
            manager_approval: 'pending',
            management_approval: 'pending',
            remarks: body.remarks || null,
            business_name: body.business_name || null,
            payment_gateway: body.payment_gateway || null,
        })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    await logAudit(auth.employee.id, 'Created requisition', 'requisitions', data.id)
    
    return NextResponse.json(data, { status: 201 })
}

// Content fields the requester (or an admin) may edit on a requisition.
const EDITABLE_FIELDS = ['item_description', 'quantity', 'reason', 'priority', 'remarks', 'business_name', 'payment_gateway', 'date']
// Approval/workflow fields — admin only, and never on your own requisition (unless Super Admin).
const WORKFLOW_FIELDS = ['manager_approval', 'management_approval', 'purchase_status', 'purchase_date']

// PUT /api/requisitions — approvals (admin) and content edits (requester while pending, or admin)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Whitelist incoming fields; silently drop anything that isn't editable or workflow.
    const editUpdates: Record<string, unknown> = {}
    const workflowUpdates: Record<string, unknown> = {}
    for (const key of Object.keys(body)) {
        if (key === 'id') continue
        if (EDITABLE_FIELDS.includes(key)) editUpdates[key] = body[key]
        else if (WORKFLOW_FIELDS.includes(key)) workflowUpdates[key] = body[key]
    }

    if (Object.keys(editUpdates).length === 0 && Object.keys(workflowUpdates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: existing } = await auth.supabase
        .from('requisitions')
        .select('requested_by, manager_approval, management_approval')
        .eq('id', id)
        .single()
    if (!existing) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })

    const isAdmin = auth.employee.roleLevel <= 3
    const isSuperAdmin = auth.employee.roleLevel <= 2
    const isOwner = existing.requested_by === auth.employee.id

    // Approvals: admin only, and an admin may not approve their own requisition (Super Admin may).
    if (Object.keys(workflowUpdates).length > 0) {
        if (!isAdmin) return NextResponse.json({ error: 'Only an admin can approve requisitions' }, { status: 403 })
        if (isOwner && !isSuperAdmin) {
            return NextResponse.json({ error: 'Admins cannot approve or modify their own requisitions' }, { status: 403 })
        }
    }

    // Content edits: requester may edit their own while still fully pending; admins may edit any.
    if (Object.keys(editUpdates).length > 0) {
        const stillPending = existing.manager_approval === 'pending' && existing.management_approval === 'pending'
        const canEdit = isAdmin || (isOwner && stillPending)
        if (!canEdit) {
            return NextResponse.json(
                { error: isOwner ? 'You can only edit a requisition while it is still pending' : 'You can only edit your own requisitions' },
                { status: 403 }
            )
        }
        if ('quantity' in editUpdates) editUpdates.quantity = Number(editUpdates.quantity) || 1
    }

    const { data, error } = await auth.supabase
        .from('requisitions')
        .update({ ...editUpdates, ...workflowUpdates })
        .eq('id', id)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(auth.employee.id, Object.keys(workflowUpdates).length > 0 ? 'Updated requisition status' : 'Edited requisition', 'requisitions', id)

    return NextResponse.json(data)
}

// DELETE /api/requisitions (super admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // Super Admin only
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await auth.supabase.from('requisitions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
