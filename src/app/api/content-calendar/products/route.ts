import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/content-calendar/products
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`SELECT code, name, cat FROM content_calendar_products ORDER BY code`)
    return NextResponse.json({ products: rows })
}

// PUT /api/content-calendar/products — {products: [{code,name,cat}, ...]} replaces the whole
// catalog (this page's "paste the list" editor always submits the complete list, not a diff).
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const list: { code: string; name?: string; cat?: string }[] = Array.isArray(body.products) ? body.products : []
    const seen = new Set<string>()
    const rows = list
        .map(p => ({ code: String(p.code || '').trim(), name: String(p.name || '').trim() || null, cat: String(p.cat || '').trim() || null }))
        .filter(p => p.code && !seen.has(p.code) && seen.add(p.code))

    if (rows.length > 3000) return NextResponse.json({ error: 'একসাথে সর্বোচ্চ ৩০০০টা প্রোডাক্ট রাখা যাবে' }, { status: 400 })

    await db.query(`DELETE FROM content_calendar_products`)
    for (const r of rows) {
        await db.query(`INSERT INTO content_calendar_products (code, name, cat) VALUES ($1, $2, $3)`, [r.code, r.name, r.cat])
    }
    return NextResponse.json({ products: rows })
}
