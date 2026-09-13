import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET /api/about-us - the public-facing About Us page content, visible to every employee.
// Team members are never stored on the content row itself — they're read live from
// `employees`, ordered by sort_order (the same "serial" the Members list uses), so the team
// section always reflects who's actually active and in what order, with zero manual upkeep.
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { rows: [content] } = await db.query(`SELECT * FROM about_us_content LIMIT 1`)

    const { rows: team } = await db.query(
        `SELECT e.id, e.name, e.designation, e.avatar_url, e.photo_url,
            json_build_object('id', d.id, 'name', d.name) AS department
         FROM employees e LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.is_active = true
         ORDER BY e.sort_order ASC NULLS LAST, e.created_at DESC`
    )

    return NextResponse.json({
        content: content || {
            story_title: null, story_body: null, story_image_url: null,
            policies: [], policies_title: null, policies_icon_url: null, team_title: null, journey: [], journey_title: null,
            banner_tagline: null, banner_image_url: null,
        },
        team,
    })
}

// PATCH /api/about-us - update the About Us content singleton (Admin/Super Admin only).
export async function PATCH(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const body = await request.json().catch(() => ({}))
    const {
        story_title, story_body, story_image_url, policies, policies_title, policies_icon_url, team_title,
        journey, journey_title, banner_tagline, banner_image_url,
    } = body

    if (policies !== undefined && !Array.isArray(policies)) {
        return NextResponse.json({ error: 'policies must be an array' }, { status: 400 })
    }
    if (journey !== undefined && !Array.isArray(journey)) {
        return NextResponse.json({ error: 'journey must be an array' }, { status: 400 })
    }

    const fields = {
        story_title: story_title ?? null,
        story_body: story_body ?? null,
        story_image_url: story_image_url ?? null,
        policies: JSON.stringify(policies ?? []),
        policies_title: policies_title ?? null,
        policies_icon_url: policies_icon_url ?? null,
        team_title: team_title ?? null,
        journey: JSON.stringify(journey ?? []),
        journey_title: journey_title ?? null,
        banner_tagline: banner_tagline ?? null,
        banner_image_url: banner_image_url ?? null,
    }

    const { rows: [existing] } = await db.query(`SELECT id FROM about_us_content LIMIT 1`)

    const { rows: [data] } = existing
        ? await db.query(
            `UPDATE about_us_content SET
                story_title = $1, story_body = $2, story_image_url = $3,
                policies = $4::jsonb, policies_title = $5, policies_icon_url = $6, team_title = $7,
                journey = $8::jsonb, journey_title = $9, banner_tagline = $10, banner_image_url = $11,
                updated_at = NOW(), updated_by = $12
             WHERE id = $13 RETURNING *`,
            [fields.story_title, fields.story_body, fields.story_image_url, fields.policies, fields.policies_title,
                fields.policies_icon_url, fields.team_title, fields.journey, fields.journey_title, fields.banner_tagline,
                fields.banner_image_url, auth.employee.id, existing.id]
        )
        : await db.query(
            `INSERT INTO about_us_content
                (story_title, story_body, story_image_url, policies, policies_title, policies_icon_url, team_title,
                 journey, journey_title, banner_tagline, banner_image_url, updated_by)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9, $10, $11, $12) RETURNING *`,
            [fields.story_title, fields.story_body, fields.story_image_url, fields.policies, fields.policies_title,
                fields.policies_icon_url, fields.team_title, fields.journey, fields.journey_title, fields.banner_tagline,
                fields.banner_image_url, auth.employee.id]
        )

    await logAudit(auth.employee.id, 'Updated the About Us page', 'about_us_content', data.id)

    return NextResponse.json(data)
}
