import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/leaves/admin - list pending leaves
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'pending'

    const { rows } = await auth.db.query(
        `SELECT lr.*,
            json_build_object('id', e.id, 'name', e.name, 'avatar_url', e.avatar_url, 'designation', e.designation) AS employee
         FROM leave_records lr
         LEFT JOIN employees e ON e.id = lr.employee_id
         WHERE lr.status ${tab === 'history' ? '!=' : '='} 'pending'
         ORDER BY lr.created_at DESC`
    )

    return NextResponse.json({ records: rows })
}

// POST /api/leaves/admin - approve/reject leave
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()
    const { record_ids, action, rejection_reason } = body // action: 'approve' | 'reject'

    if (!record_ids || !Array.isArray(record_ids) || !action) {
        return NextResponse.json({ error: 'record_ids array and action are required' }, { status: 400 })
    }

    if (action !== 'approve' && action !== 'reject') {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Safety guard: Admins cannot approve/reject their own leaves
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        const { rows: recordsToCheck } = await db.query(
            `SELECT employee_id FROM leave_records WHERE id = ANY($1)`,
            [record_ids]
        )
        const attemptingSelfApproval = recordsToCheck.some(r => r.employee_id === auth.employee.id)
        if (attemptingSelfApproval) {
            return NextResponse.json({ error: 'Admins cannot approve or reject their own leave requests' }, { status: 403 })
        }
    }

    try {
        // Update leave_records
        if (action === 'reject' && rejection_reason) {
            await db.query(
                `UPDATE leave_records SET status = 'rejected', approved_by = $1, rejection_reason = $2 WHERE id = ANY($3)`,
                [auth.employee.id, rejection_reason, record_ids]
            )
        } else {
            await db.query(
                `UPDATE leave_records SET status = $1, approved_by = $2 WHERE id = ANY($3)`,
                [action === 'approve' ? 'approved' : 'rejected', auth.employee.id, record_ids]
            )
        }
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 })
    }

    // If approved, upsert attendance records as 'leave'
    if (action === 'approve') {
        const { rows: leaves } = await db.query(
            `SELECT employee_id, leave_date FROM leave_records WHERE id = ANY($1)`,
            [record_ids]
        )

        if (leaves.length > 0) {
            try {
                await db.query(
                    `INSERT INTO attendance (employee_id, date, status, notes)
                     SELECT employee_id, leave_date, 'leave', 'Approved Leave' FROM UNNEST($1::uuid[], $2::date[]) AS t(employee_id, leave_date)
                     ON CONFLICT (employee_id, date) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes`,
                    [leaves.map(l => l.employee_id), leaves.map(l => l.leave_date)]
                )
            } catch (err) {
                console.error('Failed to sync attendance for leaves', err)
                // We don't fail the request here, but log it
            }
        }
    }

    return NextResponse.json({ success: true })
}
