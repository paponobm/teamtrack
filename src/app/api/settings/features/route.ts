import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/settings/features - get feature toggles (admin+)
export async function GET() {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { rows: [existing] } = await db.query(`SELECT * FROM app_settings LIMIT 1`)
    if (existing) return NextResponse.json(existing)

    // If no settings row exists, create one with defaults
    try {
        const { rows: [newRow] } = await db.query(
            `INSERT INTO app_settings (whatsapp_enabled, auto_assign_problems, smart_notifications, quick_entry_default)
             VALUES (false, true, true, false) RETURNING *`
        )
        return NextResponse.json(newRow)
    } catch {
        return NextResponse.json({
            whatsapp_enabled: false,
            auto_assign_problems: true,
            smart_notifications: true,
            quick_entry_default: false,
        })
    }
}

// PUT /api/settings/features - update feature toggles (admin+)
export async function PUT(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json()

    // Whitelist: only allow known toggle fields
    const ALLOWED = ['whatsapp_enabled', 'auto_assign_problems', 'smart_notifications', 'quick_entry_default']
    const safeBody: Record<string, unknown> = {}
    for (const key of ALLOWED) {
        if (key in body) safeBody[key] = body[key]
    }
    if (Object.keys(safeBody).length === 0) {
        return NextResponse.json({ error: 'No valid settings fields provided' }, { status: 400 })
    }

    const { rows: [existing] } = await db.query(`SELECT id FROM app_settings LIMIT 1`)

    const keys = Object.keys(safeBody)

    if (existing) {
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`)
        const { rows: [data] } = await db.query(
            `UPDATE app_settings SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
            [existing.id, ...keys.map(k => safeBody[k])]
        )
        return NextResponse.json(data)
    } else {
        const colList = keys.map(k => `"${k}"`).join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const { rows: [data] } = await db.query(
            `INSERT INTO app_settings (${colList}) VALUES (${placeholders}) RETURNING *`,
            keys.map(k => safeBody[k])
        )
        return NextResponse.json(data)
    }
}
