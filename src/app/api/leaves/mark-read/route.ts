import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// `member_notified` was never actually added to leave_records (no migration for it) — this
// endpoint has always been a no-op in production. Preserved as-is here.
export async function POST() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    return NextResponse.json({ success: true })
}
