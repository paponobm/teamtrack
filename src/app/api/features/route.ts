import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/features - list all features (any employee, used for sidebar/permissions display)
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`SELECT * FROM features ORDER BY category, sort_order`)
    return NextResponse.json(rows)
}

// POST /api/features - create a new feature (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()

    if (!body.name?.trim()) {
        return NextResponse.json({ error: 'Feature name is required' }, { status: 400 })
    }

    const slug = body.slug?.trim() || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const category = body.category || 'General'

    const { rows: [existing] } = await db.query(
        `SELECT sort_order FROM features WHERE category = $1 ORDER BY sort_order DESC LIMIT 1`,
        [category]
    )

    const nextOrder = (existing?.sort_order || 0) + 1

    const { rows: [data] } = await db.query(
        `INSERT INTO features (name, name_bn, category, slug, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, name_bn = EXCLUDED.name_bn, category = EXCLUDED.category, sort_order = EXCLUDED.sort_order
         RETURNING *`,
        [body.name.trim(), body.name_bn || body.name.trim(), category, slug, nextOrder]
    )

    return NextResponse.json(data, { status: 201 })
}

// DELETE /api/features - delete a feature (super admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2) // SuperAdmin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing feature id' }, { status: 400 })

    await db.query(`DELETE FROM employee_permissions WHERE feature_id = $1`, [id])
    await db.query(`DELETE FROM features WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
}
