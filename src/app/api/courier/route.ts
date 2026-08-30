import { requireAuth, isAuthed, awardPoints } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/courier (any employee)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const conditions: string[] = []
    const params: unknown[] = []
    if (status && status !== 'all') { params.push(status); conditions.push(`ci.problem_status = $${params.length}`) }
    if (startDate) { params.push(startDate); conditions.push(`ci.date >= $${params.length}`) }
    if (endDate) { params.push(endDate); conditions.push(`ci.date <= $${params.length}`) }

    const { rows: issues } = await db.query(
        `SELECT ci.*,
            json_build_object('id', pk.id, 'name', pk.name) AS peek_by,
            json_build_object('id', sv.id, 'name', sv.name) AS solver,
            json_build_object('id', mg.id, 'name', mg.name) AS manager,
            json_build_object('id', vf.id, 'name', vf.name) AS verifier
         FROM courier_issues ci
         LEFT JOIN employees pk ON pk.id = ci.call_peek
         LEFT JOIN employees sv ON sv.id = ci.problem_solver
         LEFT JOIN employees mg ON mg.id = ci.management_check
         LEFT JOIN employees vf ON vf.id = ci.verified_by
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY ci.created_at DESC`,
        params
    )

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
    const db = auth.db

    const body = await request.json()

    // Parcel ID must be unique (when provided). Client-side trim comparison handles legacy
    // rows that were stored with stray whitespace.
    const trimmedParcelId = body.parcel_id ? String(body.parcel_id).trim() : null
    if (trimmedParcelId) {
        const { rows: candidates } = await db.query(
            `SELECT id, parcel_id, fraud_note FROM courier_issues WHERE parcel_id IS NOT NULL LIMIT 5000`
        )
        const existing = candidates.find(r => String(r.parcel_id || '').trim().toLowerCase() === trimmedParcelId.toLowerCase())
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
        const { rows: fraudContacts } = await db.query(
            `SELECT id, contact_number FROM courier_issues WHERE fraud_note = true AND contact_number IS NOT NULL`
        )
        const isFraudContact = fraudContacts.some(r => String(r.contact_number || '').trim() === trimmedContact)
        if (isFraudContact) {
            return NextResponse.json({ error: 'This contact number is flagged as fraud and cannot be used for new entries.' }, { status: 409 })
        }
    }

    // Auto-assign the referral (call_peek): if the contact number matches a customer phone
    // in the work log, the member who entered that order is the referral. Mirrors problems.
    let autoCallPeek = body.call_peek || null
    if (!autoCallPeek && body.contact_number && String(body.contact_number).trim()) {
        const { rows: matchingEntries } = await db.query(
            `SELECT employee_id FROM work_entries WHERE customer_phone = $1 ORDER BY date DESC LIMIT 1`,
            [String(body.contact_number).trim()]
        )
        if (matchingEntries[0]?.employee_id) {
            autoCallPeek = matchingEntries[0].employee_id
        }
    }

    const { rows: [data] } = await db.query(
        `INSERT INTO courier_issues (date, parcel_id, contact_number, problem_details, problem_category, source, logistics, problem_status, delivery_status, fraud_note, payment_gateway, business_name, call_peek, problem_solver)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, $13) RETURNING *`,
        [
            body.date || new Date().toISOString().split('T')[0], trimmedParcelId || null, body.contact_number || null,
            body.problem_details, body.problem_category || null, body.source || null, body.logistics || null,
            body.delivery_status || 'pending', body.fraud_note || false, body.payment_gateway || null,
            body.business_name || null, autoCallPeek, body.problem_solver || null,
        ]
    )

    // Award 5 points for reporting
    await awardPoints(db, auth.employee.id, 5, 'courier', data.id, 'Entered courier issue', auth.employee.id)

    // Log to audit trail
    await db.query(
        `INSERT INTO audit_log (actor_id, module, action, target_id, new_value) VALUES ($1, 'courier', 'created', $2, $3)`,
        [auth.employee.id, data.id, data.parcel_id || 'Issue']
    )

    return NextResponse.json({ ...data, awardedPoints: 5 }, { status: 201 })
}

// PUT /api/courier (+10 points to the assigned solver on resolve)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { rows: [oldIssue] } = await db.query(
        `SELECT problem_status, problem_solver, call_peek FROM courier_issues WHERE id = $1`,
        [id]
    )

    // Members may report, pick up (call_peek), edit details and change delivery status.
    // Only an admin may RESOLVE an issue, because resolving awards 10 points to the picker —
    // letting members resolve their own picked issues would be points farming.
    const isAdmin = auth.employee.roleLevel <= 3
    if (!isAdmin && updates.problem_status === 'resolved' && oldIssue?.problem_status !== 'resolved') {
        return NextResponse.json({ error: 'Only an admin can resolve a courier issue' }, { status: 403 })
    }

    const keys = Object.keys(updates)
    if (keys.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
    const { rows: [data] } = await db.query(
        `UPDATE courier_issues SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...keys.map(k => updates[k])]
    )

    if (!data) return NextResponse.json({ error: 'Courier issue not found' }, { status: 404 })

    let awardedPoints = 0
    // Award 10 points to the assigned solver (not whoever clicked resolve) when resolved.
    if (updates.problem_status === 'resolved' && oldIssue?.problem_status !== 'resolved') {
        const solverId = data.problem_solver || oldIssue?.problem_solver || oldIssue?.call_peek
        if (solverId) {
            await awardPoints(db, solverId, 10, 'courier', id, 'Resolved courier issue', auth.employee.id)
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
        await db.query(
            `INSERT INTO audit_log (actor_id, module, action, target_id, old_value, new_value) VALUES ($1, 'courier', $2, $3, $4, $5)`,
            [auth.employee.id, log.action, id, log.old_value || null, log.new_value || null]
        )
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

    await auth.db.query(`DELETE FROM courier_issues WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
