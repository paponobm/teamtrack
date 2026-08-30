import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// `member_notified` was never actually added to leave_records (no migration for it) — this
// endpoint has always degraded to a permanent 0 in production. Preserved as-is here.
export async function GET() {
    const auth = await requireAuth(0) // Regular user
    if (!isAuthed(auth)) return auth

    return NextResponse.json({ count: 0 })
}
