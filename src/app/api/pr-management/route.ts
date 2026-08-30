import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)

    // Optional filters
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const status = searchParams.get('status')

    try {
        const conditions: string[] = []
        const params: unknown[] = []
        if (start_date) { params.push(start_date); conditions.push(`pm.send_date >= $${params.length}`) }
        if (end_date) { params.push(end_date); conditions.push(`pm.send_date <= $${params.length}`) }
        if (status && status !== 'all') { params.push(status); conditions.push(`pm.delivery_status = $${params.length}`) }

        const { rows: data } = await db.query(
            `SELECT pm.*, json_build_object('id', e.id, 'name', e.name) AS created_by_user
             FROM pr_management pm LEFT JOIN employees e ON e.id = pm.created_by
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
             ORDER BY pm.created_at DESC`,
            params
        )

        return NextResponse.json({ data })
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    try {
        const payload = await request.json()
        payload.created_by = auth.employee.id

        // Handle Auto-Linking/Creating Influencer
        let influencerId = payload.influencer_id

        if (!influencerId && payload.customer_name) {
            const { rows: [existingInfluencer] } = payload.customer_phone
                ? await db.query(`SELECT id FROM influencers WHERE phone = $1 LIMIT 1`, [payload.customer_phone])
                : await db.query(`SELECT id FROM influencers WHERE name = $1 LIMIT 1`, [payload.customer_name])

            if (existingInfluencer) {
                influencerId = existingInfluencer.id
            } else {
                const { rows: [newInfluencer] } = await db.query(
                    `INSERT INTO influencers (name, phone, address) VALUES ($1, $2, $3) RETURNING id`,
                    [payload.customer_name, payload.customer_phone || null, payload.address || null]
                )
                if (newInfluencer) influencerId = newInfluencer.id
            }

            payload.influencer_id = influencerId
        }

        const columns = Object.keys(payload)
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
        const colList = columns.map(c => `"${c}"`).join(', ')
        const { rows: [data] } = await db.query(
            `INSERT INTO pr_management (${colList}) VALUES (${placeholders}) RETURNING *`,
            columns.map(c => payload[c])
        )

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error creating PR entry:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    try {
        const payload = await request.json()
        const { id, ...updates } = payload

        if (updates.send_date === '') {
            updates.send_date = null
        }

        if (!id) {
            return NextResponse.json({ error: 'Missing PR ID' }, { status: 400 })
        }

        const keys = Object.keys(updates)
        if (keys.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
        const { rows: [data] } = await db.query(
            `UPDATE pr_management SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
            [id, ...keys.map(k => updates[k])]
        )

        if (!data) return NextResponse.json({ error: 'PR entry not found' }, { status: 404 })

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error updating PR entry:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Missing PR ID' }, { status: 400 })
    }

    try {
        await db.query(`DELETE FROM pr_management WHERE id = $1`, [id])
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting PR entry:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
