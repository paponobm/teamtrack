import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/courier (any employee)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabase
        .from('courier_issues')
        .select(`
            *,
            peek_by:employees!call_peek(id, name),
            solver:employees!problem_solver(id, name),
            manager:employees!management_check(id, name),
            verifier:employees!verified_by(id, name)
        `)
        .order('created_at', { ascending: false })

    if (status && status !== 'all') query = query.eq('problem_status', status)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const issues = data || []
    const stats = {
        total: issues.length,
        pending: issues.filter(i => i.problem_status === 'pending').length,
        resolved: issues.filter(i => i.problem_status === 'resolved').length,
        fraud: issues.filter(i => i.fraud_note).length,
    }

    return NextResponse.json({ issues, stats })
}

// POST /api/courier (+5 points)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()

    // Parcel ID must be unique (when provided) — use admin client to bypass RLS so the
    // check sees ALL existing parcels regardless of the submitting user's permissions.
    // Client-side trim comparison handles legacy rows that were stored with stray whitespace.
    const trimmedParcelId = body.parcel_id ? String(body.parcel_id).trim() : null
    const adminSupabase = createAdminClient()
    if (trimmedParcelId) {
        const { data: candidates, error: dupErr } = await adminSupabase
            .from('courier_issues')
            .select('id, parcel_id, fraud_note')
            .not('parcel_id', 'is', null)
            .limit(5000)
        if (dupErr) return NextResponse.json({ error: 'Could not validate parcel ID' }, { status: 500 })
        const existing = (candidates || []).find(r => String(r.parcel_id || '').trim().toLowerCase() === trimmedParcelId.toLowerCase())
        if (existing) {
            if (existing.fraud_note) {
                return NextResponse.json({ error: 'This parcel ID is flagged as fraud and cannot be reused.' }, { status: 409 })
            }
            return NextResponse.json({ error: 'There is already a parcel log exists' }, { status: 409 })
        }
    }

    // Check if contact number belongs to a fraud-flagged entry
    const trimmedContact = body.contact_number ? String(body.contact_number).trim() : null
    if (trimmedContact) {
        const { data: fraudContacts } = await adminSupabase
            .from('courier_issues')
            .select('id, contact_number')
            .eq('fraud_note', true)
            .not('contact_number', 'is', null)
        const isFraudContact = (fraudContacts || []).some(r => String(r.contact_number || '').trim() === trimmedContact)
        if (isFraudContact) {
            return NextResponse.json({ error: 'This contact number is flagged as fraud and cannot be used for new entries.' }, { status: 409 })
        }
    }

    // Auto-assign the referral (call_peek): if the contact number matches a customer phone
    // in the work log, the member who entered that order is the referral. Mirrors problems.
    let autoCallPeek = body.call_peek || null
    if (!autoCallPeek && body.contact_number && String(body.contact_number).trim()) {
        const { data: matchingEntries } = await auth.supabase
            .from('work_entries')
            .select('employee_id')
            .eq('customer_phone', String(body.contact_number).trim())
            .order('date', { ascending: false })
            .limit(1)
        if (matchingEntries?.[0]?.employee_id) {
            autoCallPeek = matchingEntries[0].employee_id
        }
    }

    const { data, error } = await auth.supabase
        .from('courier_issues')
        .insert({
            date: body.date || new Date().toISOString().split('T')[0],
            parcel_id: trimmedParcelId || null,
            contact_number: body.contact_number || null,
            problem_details: body.problem_details,
            problem_category: body.problem_category || null,
            source: body.source || null,
            logistics: body.logistics || null,
            problem_status: 'pending',
            delivery_status: body.delivery_status || 'pending',
            fraud_note: body.fraud_note || false,
            payment_gateway: body.payment_gateway || null,
            business_name: body.business_name || null,
            call_peek: autoCallPeek,
            problem_solver: body.problem_solver || null,
        })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Award 5 points for reporting
    await awardPoints(auth.supabase, auth.employee.id, 5, 'courier', data.id, 'Entered courier issue', auth.employee.id)

    // Log to audit trail
    await auth.supabase.from('audit_log').insert({
        actor_id: auth.employee.id, module: 'courier', action: 'created', target_id: data.id,
        new_value: data.parcel_id || 'Issue',
    }).then(() => {})

    return NextResponse.json({ ...data, awardedPoints: 5 }, { status: 201 })
}

// PUT /api/courier (+10 points to the assigned solver on resolve)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: oldIssue } = await auth.supabase.from('courier_issues').select('problem_status, problem_solver, call_peek').eq('id', id).single()

    // Members may report, pick up (call_peek), edit details and change delivery status.
    // Only an admin may RESOLVE an issue, because resolving awards 10 points to the picker —
    // letting members resolve their own picked issues would be points farming.
    const isAdmin = auth.employee.roleLevel <= 3
    if (!isAdmin && updates.problem_status === 'resolved' && oldIssue?.problem_status !== 'resolved') {
        return NextResponse.json({ error: 'Only an admin can resolve a courier issue' }, { status: 403 })
    }

    const { data, error } = await auth.supabase
        .from('courier_issues')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let awardedPoints = 0
    // Award 10 points to the assigned solver (not whoever clicked resolve) when resolved.
    if (updates.problem_status === 'resolved' && oldIssue?.problem_status !== 'resolved') {
        const solverId = data.problem_solver || oldIssue?.problem_solver || oldIssue?.call_peek
        if (solverId) {
            await awardPoints(auth.supabase, solverId, 10, 'courier', id, 'Resolved courier issue', auth.employee.id)
            awardedPoints = 10
        }
    }

    // Log changes to audit trail
    const logActions: Array<{ action: string; old_value?: string; new_value?: string }> = []
    if (updates.problem_status && updates.problem_status !== oldIssue?.problem_status) {
        logActions.push({ action: 'status_change', old_value: oldIssue?.problem_status, new_value: updates.problem_status })
    }
    if (updates.delivery_status) {
        logActions.push({ action: 'delivery_status_change', new_value: updates.delivery_status })
    }
    if (logActions.length === 0 && Object.keys(updates).length > 0) {
        logActions.push({ action: 'updated' })
    }
    for (const log of logActions) {
        await auth.supabase.from('audit_log').insert({
            actor_id: auth.employee.id, module: 'courier', action: log.action, target_id: id,
            old_value: log.old_value || null, new_value: log.new_value || null,
        }).then(() => {})
    }

    return NextResponse.json({ ...data, awardedPoints })
}

// DELETE /api/courier (admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await auth.supabase.from('courier_issues').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
