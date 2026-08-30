import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/activity-log?module=work_log&target_id=xxx
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const module = searchParams.get('module')
    const targetId = searchParams.get('target_id')
    const actorId = searchParams.get('actor_id')

    const conditions: string[] = []
    const params: unknown[] = []
    if (module) { params.push(module); conditions.push(`al.module = $${params.length}`) }
    if (targetId) { params.push(targetId); conditions.push(`al.target_id = $${params.length}`) }
    if (actorId) { params.push(actorId); conditions.push(`al.actor_id = $${params.length}`) }

    const { rows } = await db.query(
        `SELECT al.*, json_build_object('id', e.id, 'name', e.name) AS actor
         FROM audit_log al
         LEFT JOIN employees e ON e.id = al.actor_id
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY al.created_at DESC
         LIMIT 100`,
        params
    )

    return NextResponse.json(rows)
}
