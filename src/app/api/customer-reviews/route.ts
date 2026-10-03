import type { Pool } from 'pg'
import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/customer-reviews?q=<category name search>
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    const { rows } = await auth.db.query(
        `SELECT r.id, r.title, r.description, r.image_url, r.created_at, r.created_by,
            json_build_object('id', c.id, 'name', c.name) AS category,
            json_build_object('id', e.id, 'name', e.name) AS author
         FROM customer_reviews r
         JOIN customer_review_categories c ON c.id = r.category_id
         LEFT JOIN employees e ON e.id = r.created_by
         ${q ? 'WHERE c.name ILIKE $1' : ''}
         ORDER BY r.created_at DESC`,
        q ? [`${q.replace(/[\\%_]/g, '\\$&')}%`] : []
    )
    return NextResponse.json({ reviews: rows })
}

// Shared validation for create and edit — category, title, description and photo are all required
async function parseReviewBody(request: Request, db: Pool) {
    const body = await request.json().catch(() => ({}))
    const categoryId = typeof body.category_id === 'string' ? body.category_id : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : ''

    if (!categoryId) return { error: NextResponse.json({ error: 'Please choose a category' }, { status: 400 }) }
    if (!title) return { error: NextResponse.json({ error: 'Title is required' }, { status: 400 }) }
    if (!description) return { error: NextResponse.json({ error: 'Description is required' }, { status: 400 }) }
    if (!imageUrl) return { error: NextResponse.json({ error: 'A photo is required' }, { status: 400 }) }

    const { rows: [category] } = await db.query(`SELECT id FROM customer_review_categories WHERE id = $1`, [categoryId])
    if (!category) return { error: NextResponse.json({ error: 'Please choose a valid category' }, { status: 400 }) }

    return { values: { categoryId, title, description, imageUrl } }
}

// POST /api/customer-reviews
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const parsed = await parseReviewBody(request, auth.db)
    if ('error' in parsed) return parsed.error
    const { categoryId, title, description, imageUrl } = parsed.values

    const { rows: [data] } = await auth.db.query(
        `INSERT INTO customer_reviews (category_id, title, description, image_url, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, title, description, image_url, created_at`,
        [categoryId, title, description, imageUrl, auth.employee.id]
    )
    return NextResponse.json(data, { status: 201 })
}

// PUT /api/customer-reviews?id=xxx — the review's author or a super admin can edit it
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Review ID required' }, { status: 400 })

    const { rows: [existing] } = await auth.db.query(`SELECT created_by FROM customer_reviews WHERE id = $1`, [id])
    if (!existing) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    const isSuper = auth.employee.roleLevel <= 2
    if (existing.created_by !== auth.employee.id && !isSuper) {
        return NextResponse.json({ error: 'You can only edit your own reviews' }, { status: 403 })
    }

    const parsed = await parseReviewBody(request, auth.db)
    if ('error' in parsed) return parsed.error
    const { categoryId, title, description, imageUrl } = parsed.values

    const { rows: [data] } = await auth.db.query(
        `UPDATE customer_reviews SET category_id = $1, title = $2, description = $3, image_url = $4
         WHERE id = $5 RETURNING id, title, description, image_url, created_at`,
        [categoryId, title, description, imageUrl, id]
    )
    if (!data) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    return NextResponse.json(data)
}

// DELETE /api/customer-reviews?id=xxx (super admin only)
export async function DELETE(request: Request) {
    const auth = await requireAuth(2)
    if (!isAuthed(auth)) return auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Review ID required' }, { status: 400 })

    await auth.db.query(`DELETE FROM customer_reviews WHERE id = $1`, [id])
    return NextResponse.json({ message: 'Customer review deleted' })
}
