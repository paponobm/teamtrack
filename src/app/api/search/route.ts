import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/search?q=query - global search across modules (requires auth)
export async function GET(req: NextRequest) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const roleLevel = auth.employee.roleLevel
    const isAdmin = roleLevel <= 3
    const isSuperAdmin = roleLevel <= 2
    const q = req.nextUrl.searchParams.get('q')?.trim()

    if (!q || q.length < 2) return NextResponse.json({ results: [] })

    // Strip wildcard/quote/backslash characters to prevent LIKE-pattern injection, matching
    // the previous PostgREST `.or()` sanitization.
    const escaped = q.replace(/["\\%_]/g, '')
    if (escaped.length < 2) return NextResponse.json({ results: [] })
    const pattern = `%${escaped}%`

    // Members can only search their own work entries; admins (<=3) search all.
    const workEntriesConditions = [`(w.customer_phone ILIKE $1 OR w.invoice_no ILIKE $1 OR w.courier_id ILIKE $1)`]
    const workEntriesParams: unknown[] = [pattern]
    if (!isAdmin) {
        workEntriesParams.push(auth.employee.id)
        workEntriesConditions.push(`w.employee_id = $${workEntriesParams.length}`)
    }

    // Expenses are sensitive: super admins see all; admins see their own; members get none.
    let expensesPromise: Promise<{ rows: { id: string; description: string; amount: number; category: string | null }[] }> = Promise.resolve({ rows: [] })
    if (isSuperAdmin) {
        expensesPromise = db.query(`SELECT id, description, amount, category FROM expenses WHERE description ILIKE $1 LIMIT 5`, [pattern])
    } else if (isAdmin) {
        expensesPromise = db.query(
            `SELECT id, description, amount, category FROM expenses WHERE submitted_by = $1 AND description ILIKE $2 LIMIT 5`,
            [auth.employee.id, pattern]
        )
    }

    const [members, problems, workEntries, ideas, expenses, notices] = await Promise.all([
        db.query(
            `SELECT e.id, e.name, e.personal_contact, e.whatsapp_number, e.employee_id, json_build_object('name', d.name) AS department
             FROM employees e LEFT JOIN departments d ON d.id = e.department_id
             WHERE e.name ILIKE $1 OR e.personal_contact ILIKE $1 OR e.whatsapp_number ILIKE $1 OR e.employee_id ILIKE $1
             LIMIT 5`,
            [pattern]
        ),
        db.query(
            `SELECT id, problem_no, customer_name, problem_details, status FROM problems
             WHERE problem_no ILIKE $1 OR customer_name ILIKE $1 OR problem_details ILIKE $1 LIMIT 5`,
            [pattern]
        ),
        db.query(
            `SELECT w.id, w.customer_phone, w.invoice_no, w.courier_id, json_build_object('name', e.name) AS employee
             FROM work_entries w LEFT JOIN employees e ON e.id = w.employee_id
             WHERE ${workEntriesConditions.join(' AND ')} LIMIT 5`,
            workEntriesParams
        ),
        db.query(`SELECT id, title, status FROM ideas WHERE title ILIKE $1 LIMIT 5`, [pattern]),
        expensesPromise,
        db.query(`SELECT id, title, type FROM notices WHERE title ILIKE $1 LIMIT 5`, [pattern]),
    ])

    const results = [
        ...members.rows.map(m => ({
            type: 'member', id: m.id, title: m.name,
            subtitle: `${m.employee_id || ''} · ${m.personal_contact || ''}`,
            href: '/members',
        })),
        ...problems.rows.map(p => ({
            type: 'problem', id: p.id, title: `${p.problem_no}: ${p.customer_name || 'Unknown'}`,
            subtitle: p.problem_details?.slice(0, 60) || p.status,
            href: '/problems',
        })),
        ...workEntries.rows.map(w => ({
            type: 'work', id: w.id, title: `Order: ${w.invoice_no || w.courier_id || '-'}`,
            subtitle: `${w.employee?.name || 'Unknown'} · ${w.customer_phone || ''}`,
            href: '/work-log',
        })),
        ...ideas.rows.map(i => ({
            type: 'idea', id: i.id, title: i.title,
            subtitle: i.status,
            href: '/ideas',
        })),
        ...expenses.rows.map(e => ({
            type: 'expense', id: e.id, title: e.description,
            subtitle: `৳${Number(e.amount).toLocaleString()} · ${e.category || ''}`,
            href: '/expenses',
        })),
        ...notices.rows.map(n => ({
            type: 'notice', id: n.id, title: n.title,
            subtitle: n.type,
            href: '/noticeboard',
        })),
    ]

    return NextResponse.json({ results: results.slice(0, 15) })
}
