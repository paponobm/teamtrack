import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/customer-review-categories — every category with how many reviews it holds
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(
        `SELECT c.id, c.name, c.created_at,
            json_build_object('id', e.id, 'name', e.name) AS created_by,
            (SELECT COUNT(*)::int FROM customer_reviews r WHERE r.category_id = c.id) AS review_count
         FROM customer_review_categories c LEFT JOIN employees e ON e.id = c.created_by
         ORDER BY c.name ASC`
    )
    return NextResponse.json({ categories: rows })
}

// POST /api/customer-review-categories — add a category (name must be unique, case-insensitive)
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    if (name.length > 60) return NextResponse.json({ error: 'Category name must be 60 characters or fewer' }, { status: 400 })

    try {
        const { rows: [data] } = await auth.db.query(
            `INSERT INTO customer_review_categories (name, created_by) VALUES ($1, $2) RETURNING *`,
            [name, auth.employee.id]
        )
        return NextResponse.json(data, { status: 201 })
    } catch (err) {
        if ((err as { code?: string }).code === '23505') {
            return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
        }
        throw err
    }
}

// PUT /api/customer-review-categories — rename a category (same uniqueness rule as POST)
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!id) return NextResponse.json({ error: 'Category ID required' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    if (name.length > 60) return NextResponse.json({ error: 'Category name must be 60 characters or fewer' }, { status: 400 })

    try {
        const { rows: [data] } = await auth.db.query(
            `UPDATE customer_review_categories SET name = $1 WHERE id = $2 RETURNING *`,
            [name, id]
        )
        if (!data) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
        return NextResponse.json(data)
    } catch (err) {
        if ((err as { code?: string }).code === '23505') {
            return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
        }
        throw err
    }
}

// DELETE /api/customer-review-categories?id=xxx — super admin only; refused while reviews still use it
export async function DELETE(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Category ID required' }, { status: 400 })

    const { rows: [{ count }] } = await auth.db.query(
        `SELECT COUNT(*)::int AS count FROM customer_reviews WHERE category_id = $1`, [id]
    )
    if (count > 0) {
        return NextResponse.json({ error: `This category has ${count} review${count === 1 ? '' : 's'}. Delete or move them first.` }, { status: 409 })
    }

    await auth.db.query(`DELETE FROM customer_review_categories WHERE id = $1`, [id])
    return NextResponse.json({ message: 'Category deleted' })
}
