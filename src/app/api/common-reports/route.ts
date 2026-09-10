import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/common-reports - list the authenticated employee's own saved Common Report
// snippets. Private per employee, same as personal_todos — never returns another
// employee's rows, and there is no admin bypass here.
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT * FROM common_reports WHERE employee_id = $1 ORDER BY created_at DESC`,
        [auth.employee.id]
    )

    return NextResponse.json(rows)
}

// POST /api/common-reports - save a new Common Report snippet for the authenticated employee
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    try {
        const body = await request.json()
        const { text } = body

        if (!text || !text.trim()) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        const { rows: [data] } = await auth.db.query(
            `INSERT INTO common_reports (employee_id, text) VALUES ($1, $2) RETURNING *`,
            [auth.employee.id, text.trim()]
        )

        return NextResponse.json(data, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Bad request' }, { status: 400 })
    }
}

// PUT /api/common-reports - edit one of the authenticated employee's own snippets
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    try {
        const body = await request.json()
        const { id, text } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }
        if (!text || !text.trim()) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        // Ownership check: WHERE employee_id = $3 means this can never edit someone else's row.
        const { rows: [data] } = await auth.db.query(
            `UPDATE common_reports SET text = $1 WHERE id = $2 AND employee_id = $3 RETURNING *`,
            [text.trim(), id, auth.employee.id]
        )

        if (!data) return NextResponse.json({ error: 'Common report not found' }, { status: 404 })

        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Bad request' }, { status: 400 })
    }
}

// DELETE /api/common-reports?id=... - remove one of the authenticated employee's own snippets
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Ownership check: WHERE employee_id = $2 means this can never delete someone else's row.
    await auth.db.query(`DELETE FROM common_reports WHERE id = $1 AND employee_id = $2`, [id, auth.employee.id])

    return NextResponse.json({ message: 'Common report deleted' })
}
