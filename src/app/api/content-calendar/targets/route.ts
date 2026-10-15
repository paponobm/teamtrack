import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Fallback when no target has ever been set for a channel — same baseline the reference
// artifact ships with, keyed by platform.
const DEFAULT_TARGET: Record<string, { posts: number; videos: number }> = {
    facebook: { posts: 300, videos: 150 },
    tiktok: { posts: 30, videos: 30 },
    instagram: { posts: 30, videos: 20 },
    youtube: { posts: 30, videos: 30 },
}

// GET /api/content-calendar/targets?month=YYYY-MM — the effective target for that month: a
// month-specific override if one was saved, else the standing default, else the baseline above.
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || ''
    if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month is required in YYYY-MM format' }, { status: 400 })

    const { rows: channels } = await db.query(`SELECT id, platform FROM content_calendar_channels WHERE active ORDER BY platform, sort_order`)
    const { rows: channelRows } = await db.query(
        `SELECT DISTINCT ON (channel_id) channel_id, month, posts, videos
         FROM content_calendar_channel_targets WHERE month IN ('', $1)
         ORDER BY channel_id, (month = $1) DESC`,
        [month]
    )
    const channelById: Record<string, { month: string; posts: number; videos: number }> = {}
    channelRows.forEach(r => { channelById[r.channel_id] = r })

    const channelResult = channels.map((c: { id: string; platform: string }) => {
        const row = channelById[c.id]
        const base = DEFAULT_TARGET[c.platform] || { posts: 0, videos: 0 }
        return { channel_id: c.id, posts: row ? row.posts : base.posts, videos: row ? row.videos : base.videos, is_month_custom: row?.month === month }
    })

    const { rows: members } = await db.query(
        `SELECT e.id FROM employees e JOIN content_calendar_team_roles r ON r.employee_id = e.id WHERE e.is_active IS NOT FALSE ORDER BY e.name`
    )
    const { rows: memberRows } = await db.query(
        `SELECT DISTINCT ON (employee_id) employee_id, month, target
         FROM content_calendar_member_targets WHERE month IN ('', $1)
         ORDER BY employee_id, (month = $1) DESC`,
        [month]
    )
    const memberById: Record<string, { month: string; target: number }> = {}
    memberRows.forEach(r => { memberById[r.employee_id] = r })

    const memberResult = members.map((m: { id: string }) => {
        const row = memberById[m.id]
        return { employee_id: m.id, target: row ? row.target : 0, is_month_custom: row?.month === month }
    })

    const isMonthCustom = channelResult.some(c => c.is_month_custom) || memberResult.some(m => m.is_month_custom)
    return NextResponse.json({ channels: channelResult, members: memberResult, is_month_custom: isMonthCustom })
}

// POST /api/content-calendar/targets — {scope: 'default'|'month', month, channels: [{channel_id,posts,videos}], members: [{employee_id,target}]}
// 'default' also clears any existing month-specific overrides from `month` onward, so a new
// standing default actually takes effect for future months instead of being shadowed.
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const scope = body.scope === 'month' ? 'month' : 'default'
    const month = typeof body.month === 'string' ? body.month : ''
    if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month is required in YYYY-MM format' }, { status: 400 })
    const channels: { channel_id: string; posts: number; videos: number }[] = Array.isArray(body.channels) ? body.channels : []
    const members: { employee_id: string; target: number }[] = Array.isArray(body.members) ? body.members : []

    const rowMonth = scope === 'month' ? month : ''

    for (const c of channels) {
        if (typeof c.channel_id !== 'string') continue
        const posts = Math.max(0, Math.floor(Number(c.posts) || 0))
        const videos = Math.max(0, Math.floor(Number(c.videos) || 0))
        await db.query(
            `INSERT INTO content_calendar_channel_targets (channel_id, month, posts, videos) VALUES ($1, $2, $3, $4)
             ON CONFLICT (channel_id, month) DO UPDATE SET posts = EXCLUDED.posts, videos = EXCLUDED.videos`,
            [c.channel_id, rowMonth, posts, videos]
        )
    }
    for (const m of members) {
        if (typeof m.employee_id !== 'string') continue
        const target = Math.max(0, Math.floor(Number(m.target) || 0))
        await db.query(
            `INSERT INTO content_calendar_member_targets (employee_id, month, target) VALUES ($1, $2, $3)
             ON CONFLICT (employee_id, month) DO UPDATE SET target = EXCLUDED.target`,
            [m.employee_id, rowMonth, target]
        )
    }

    if (scope === 'default') {
        await db.query(`DELETE FROM content_calendar_channel_targets WHERE month <> '' AND month >= $1`, [month])
        await db.query(`DELETE FROM content_calendar_member_targets WHERE month <> '' AND month >= $1`, [month])
    }

    return NextResponse.json({ message: 'Targets saved' })
}
