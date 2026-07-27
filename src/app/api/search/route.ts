import { requireAuth, isAuthed } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/search?q=query - global search across modules (requires auth)
export async function GET(req: NextRequest) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const roleLevel = auth.employee.roleLevel
    const isAdmin = roleLevel <= 3
    const isSuperAdmin = roleLevel <= 2
    const q = req.nextUrl.searchParams.get('q')?.trim()

    if (!q || q.length < 2) return NextResponse.json({ results: [] })

    // Strip PostgREST `.or()` structural chars (`,()` etc.), quotes/backslashes and LIKE
    // wildcards to prevent filter injection, then wrap values in double quotes inside `.or()`.
    const escaped = q.replace(/["\\%_]/g, '')
    if (escaped.length < 2) return NextResponse.json({ results: [] })
    const pattern = `%${escaped}%`

    // Members can only search their own work entries; admins (<=3) search all.
    const workEntriesQuery = supabase
        .from('work_entries')
        .select('id, customer_phone, invoice_no, courier_id, employee:employees!employee_id(name)')
        .or(`customer_phone.ilike."${pattern}",invoice_no.ilike."${pattern}",courier_id.ilike."${pattern}"`)
        .limit(5)
    if (!isAdmin) workEntriesQuery.eq('employee_id', auth.employee.id)

    // Expenses are sensitive: super admins see all; admins see their own; members get none.
    let expensesQuery = null
    if (isSuperAdmin) {
        expensesQuery = supabase.from('expenses').select('id, description, amount, category').ilike('description', pattern).limit(5)
    } else if (isAdmin) {
        expensesQuery = supabase.from('expenses').select('id, description, amount, category').eq('submitted_by', auth.employee.id).ilike('description', pattern).limit(5)
    }

    const [members, problems, workEntries, ideas, expenses, notices] = await Promise.all([
        supabase.from('employees').select('id, name, personal_contact, whatsapp_number, employee_id, department:departments(name)').or(`name.ilike."${pattern}",personal_contact.ilike."${pattern}",whatsapp_number.ilike."${pattern}",employee_id.ilike."${pattern}"`).limit(5),
        supabase.from('problems').select('id, problem_no, customer_name, problem_details, status').or(`problem_no.ilike."${pattern}",customer_name.ilike."${pattern}",problem_details.ilike."${pattern}"`).limit(5),
        workEntriesQuery,
        supabase.from('ideas').select('id, title, status').ilike('title', pattern).limit(5),
        expensesQuery ?? Promise.resolve({ data: [] }),
        supabase.from('notices').select('id, title, type').ilike('title', pattern).limit(5),
    ])

    const results = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(members.data || []).map((m: any) => ({
            type: 'member', id: m.id, title: m.name,
            subtitle: `${m.employee_id || ''} · ${m.personal_contact || ''}`,
            href: '/members',
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(problems.data || []).map((p: any) => ({
            type: 'problem', id: p.id, title: `${p.problem_no}: ${p.customer_name || 'Unknown'}`,
            subtitle: p.problem_details?.slice(0, 60) || p.status,
            href: '/problems',
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(workEntries.data || []).map((w: any) => {
            const empName = Array.isArray(w.employee) ? w.employee[0]?.name : w.employee?.name
            return {
                type: 'work', id: w.id, title: `Order: ${w.invoice_no || w.courier_id || '-'}`,
                subtitle: `${empName || 'Unknown'} · ${w.customer_phone || ''}`,
                href: '/work-log',
            }
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(ideas.data || []).map((i: any) => ({
            type: 'idea', id: i.id, title: i.title,
            subtitle: i.status,
            href: '/ideas',
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(expenses.data || []).map((e: any) => ({
            type: 'expense', id: e.id, title: e.description,
            subtitle: `৳${Number(e.amount).toLocaleString()} · ${e.category || ''}`,
            href: '/expenses',
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(notices.data || []).map((n: any) => ({
            type: 'notice', id: n.id, title: n.title,
            subtitle: n.type,
            href: '/noticeboard',
        })),
    ]

    return NextResponse.json({ results: results.slice(0, 15) })
}
