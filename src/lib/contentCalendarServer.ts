import type { Pool, PoolClient } from 'pg'

// Whoever has this content role and currently carries the fewest open (non-'ready') items gets
// auto-assigned — same "least busy qualified person" rule the reference artifact uses, just
// computed in SQL instead of by scanning an in-memory array.
export async function autoAssignEmployee(db: Pool | PoolClient, role: string, exceptItemId?: string): Promise<string | null> {
    const { rows } = await db.query(
        `SELECT e.id FROM content_calendar_team_roles r
         JOIN employees e ON e.id = r.employee_id
         WHERE $1 = ANY(r.roles)
         ORDER BY (
             SELECT count(*) FROM content_calendar_items i
             WHERE i.assignee_id = e.id AND i.stage <> 'ready' AND i.id IS DISTINCT FROM $2::uuid
         ) ASC, e.name ASC
         LIMIT 1`,
        [role, exceptItemId || null]
    )
    return rows[0]?.id || null
}

export const ITEM_SELECT = `
    SELECT i.id, i.title, i.product_code, i.caption, i.notes, i.stage, i.start_date, i.gap_days, i.stage_since, i.created_at, i.series_id,
        json_build_object('id', t.id, 'name', t.name, 'kind', t.kind, 'caption_template', t.caption_template) AS type,
        CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object('id', a.id, 'name', a.name) END AS assignee,
        CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'name', c.name) END AS creator,
        CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object('id', o.id, 'name', o.name, 'date', o.date) END AS occasion,
        COALESCE((SELECT json_agg(json_build_object('id', s.id, 'channel_id', s.channel_id, 'date', s.date, 'posted', s.posted, 'hook', s.hook, 'reach', s.reach, 'msgs', s.msgs, 'orders', s.orders) ORDER BY s.date)
                  FROM content_calendar_slots s WHERE s.item_id = i.id), '[]') AS slots,
        COALESCE((SELECT json_agg(json_build_object('id', g.id, 'stage', g.stage, 'by', e2.name, 'at', g.at) ORDER BY g.at)
                  FROM content_calendar_stage_logs g LEFT JOIN employees e2 ON e2.id = g.by_employee_id WHERE g.item_id = i.id), '[]') AS logs,
        COALESCE((SELECT json_agg(json_build_object('id', m.id, 'text', m.text, 'done', m.done, 'by', e3.name, 'by_employee_id', m.by_employee_id, 'at', m.created_at) ORDER BY m.created_at)
                  FROM content_calendar_comments m LEFT JOIN employees e3 ON e3.id = m.by_employee_id WHERE m.item_id = i.id), '[]') AS comments
    FROM content_calendar_items i
    JOIN content_calendar_types t ON t.id = i.type_id
    LEFT JOIN employees a ON a.id = i.assignee_id
    LEFT JOIN employees c ON c.id = i.created_by
    LEFT JOIN content_calendar_occasions o ON o.id = i.occasion_id
`
