import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Tasks store per-line points as a trailing "[Npt]" marker (same convention the
// Create/Edit Task modal writes into the description string).
function parseTaskDescription(description: string | null): { items: { text: string; points: number | null }[]; total: number } {
    if (!description) return { items: [], total: 0 }
    let total = 0
    const items = description.split('\n').filter(l => l.trim()).map(line => {
        const withPoints = line.match(/^\d+\.\s*(.*?)\s*\[(\d+)pt\]\s*$/)
        if (withPoints) {
            const pts = parseInt(withPoints[2], 10)
            total += pts
            return { text: withPoints[1], points: pts }
        }
        const plain = line.match(/^\d+\.\s*(.*)$/)
        return { text: plain ? plain[1] : line, points: null }
    })
    return { items, total }
}

// GET /api/work-comparison?employee_id&start_date&end_date (admin only)
// Returns the employee's assigned tasks (with parsed points) and daily work reports
// for the same period, so the admin can compare and score them side by side.
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!employeeId || !startDate || !endDate) {
        return NextResponse.json({ error: 'employee_id, start_date and end_date are required' }, { status: 400 })
    }

    // 1. Tasks assigned to this employee, due within the period.
    const { rows: assignments } = await db.query(`SELECT task_id FROM task_assignments WHERE employee_id = $1`, [employeeId])

    const taskIds = assignments.map(a => a.task_id)
    let tasks: { id: string; title: string; task_no: string | null; description: string | null; status: string; priority: string; due_date: string | null }[] = []
    if (taskIds.length > 0) {
        // Match on created_at (when the task was actually assigned) rather than due_date —
        // due_date is optional and commonly left unset, which would silently exclude most
        // tasks from every period if used as the filter.
        const { rows } = await db.query(
            `SELECT id, title, task_no, description, status, priority, due_date FROM tasks
             WHERE id = ANY($1) AND created_at >= $2 AND created_at <= $3
             ORDER BY created_at ASC`,
            [taskIds, `${startDate}T00:00:00`, `${endDate}T23:59:59`]
        )
        tasks = rows
    }

    let totalAssignedPoints = 0
    const taskEntries = tasks.map(t => {
        const parsed = parseTaskDescription(t.description)
        totalAssignedPoints += parsed.total
        return {
            id: t.id,
            title: t.title,
            task_no: t.task_no,
            status: t.status,
            priority: t.priority,
            due_date: t.due_date,
            description: t.description,
            items: parsed.items,
            totalPoints: parsed.total,
        }
    })

    // 2. Daily work reports submitted by this employee in the same period.
    const { rows: reports } = await db.query(
        `SELECT id, date, project, description, hours, progress, status, attachment_url, notes, created_at
         FROM work_reports WHERE employee_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC`,
        [employeeId, startDate, endDate]
    )

    // 3. Most recent prior score (if any) already given to each report, so the admin
    // sees what was previously awarded instead of a blank input.
    const reportIds = reports.map(r => r.id)
    const existingPointsByReport: Record<string, number> = {}
    if (reportIds.length > 0) {
        const { rows: items } = await db.query(
            `SELECT work_report_id, points, created_at FROM work_evaluation_items
             WHERE work_report_id = ANY($1) ORDER BY created_at DESC`,
            [reportIds]
        )
        items.forEach(it => {
            if (existingPointsByReport[it.work_report_id] === undefined) {
                existingPointsByReport[it.work_report_id] = it.points
            }
        })
    }

    const workReports = reports.map(r => ({
        ...r,
        existingPoints: existingPointsByReport[r.id] ?? null,
    }))

    return NextResponse.json({ tasks: taskEntries, totalAssignedPoints, workReports })
}
