import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/performance/categories - list point categories
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const { rows } = await auth.db.query(`SELECT * FROM point_categories ORDER BY sort_order`)
    return NextResponse.json(rows)
}
