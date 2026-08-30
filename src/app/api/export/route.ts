import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/export?type=work-log&date=2024-03-01 (or month=2024-03 or range)
// GET /api/export?type=attendance&month=2024-03
// GET /api/export?type=expenses&month=2024-03
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const date = searchParams.get('date')
    const month = searchParams.get('month')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const employeeId = searchParams.get('employee_id')
    const status = searchParams.get('status')

    if (!type) return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 })

    // Quote every CSV cell and neutralize spreadsheet formula injection (leading = + - @).
    const cell = (v: unknown) => {
        let s = v === null || v === undefined ? '' : String(v)
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
        return `"${s.replace(/"/g, '""')}"`
    }
    const row = (vals: unknown[]) => vals.map(cell).join(',') + '\n'
    // Real last day of the month (avoids the invalid `-31` for 30-day / Feb months).
    const monthEnd = (m: string) => {
        const [y, mm] = m.split('-').map(Number)
        return new Date(y, mm, 0).toISOString().split('T')[0]
    }

    let csvContent = ''

    if (type === 'work-log') {
        const conditions: string[] = []
        const params: unknown[] = []
        if (date) { params.push(date); conditions.push(`w.date = $${params.length}`) }
        if (month) { params.push(`${month}-01`); conditions.push(`w.date >= $${params.length}`); params.push(monthEnd(month)); conditions.push(`w.date <= $${params.length}`) }

        const { rows: data } = await db.query(
            `SELECT w.date, w.sl, w.customer_phone, w.invoice_no, w.courier_id, w.source, w.amount, w.advance, w.note, w.order_type, w.delivery_status,
                json_build_object('name', e.name) AS employee
             FROM work_entries w LEFT JOIN employees e ON e.id = w.employee_id
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
             ORDER BY w.date DESC`,
            params
        )
        csvContent = 'Date,SL,Customer Phone,Invoice,Courier ID,Source,Amount,Advance,Note,Order Type,Status,Employee\n'
        data.forEach(e => {
            csvContent += row([e.date, e.sl, e.customer_phone, e.invoice_no, e.courier_id, e.source, e.amount, e.advance || 0, e.note, e.order_type, e.delivery_status, e.employee?.name])
        })
    } else if (type === 'attendance') {
        // The Attendance Report tab uses start_date/end_date (+ optional employee_id/status) and
        // wants Employee ID/Department columns too — kept as a separate branch so the original
        // date/month single-export (used by the Daily Attendance tab today) is untouched.
        const isRangeExport = !!(startDate && endDate)

        const conditions: string[] = []
        const params: unknown[] = []
        if (isRangeExport) {
            params.push(startDate); conditions.push(`a.date >= $${params.length}`)
            params.push(endDate); conditions.push(`a.date <= $${params.length}`)
            if (employeeId) { params.push(employeeId); conditions.push(`a.employee_id = $${params.length}`) }
            if (status) { params.push(status); conditions.push(`a.status = $${params.length}`) }
        } else {
            if (date) { params.push(date); conditions.push(`a.date = $${params.length}`) }
            if (month) { params.push(`${month}-01`); conditions.push(`a.date >= $${params.length}`); params.push(monthEnd(month)); conditions.push(`a.date <= $${params.length}`) }
        }

        const { rows: data } = await db.query(
            `SELECT a.date, a.status, a.clock_in, a.clock_out, a.notes,
                json_build_object('name', e.name, 'employee_id', e.employee_id, 'department', json_build_object('name', d.name)) AS employee
             FROM attendance a LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN departments d ON d.id = e.department_id
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
             ORDER BY a.date DESC`,
            params
        )
        if (isRangeExport) {
            csvContent = 'Date,Employee,Employee ID,Department,Status,Clock In,Clock Out,Notes\n'
            data.forEach(e => {
                csvContent += row([e.date, e.employee?.name, e.employee?.employee_id, e.employee?.department?.name, e.status, e.clock_in || '', e.clock_out || '', e.notes])
            })
        } else {
            csvContent = 'Date,Employee,Status,Clock In,Clock Out,Notes\n'
            data.forEach(e => {
                csvContent += row([e.date, e.employee?.name, e.status, e.clock_in || '', e.clock_out || '', e.notes])
            })
        }
    } else if (type === 'work-reports') {
        const conditions: string[] = []
        const params: unknown[] = []
        if (startDate && endDate) { params.push(startDate); conditions.push(`wr.date >= $${params.length}`); params.push(endDate); conditions.push(`wr.date <= $${params.length}`) }
        if (employeeId) { params.push(employeeId); conditions.push(`wr.employee_id = $${params.length}`) }
        if (status) { params.push(status); conditions.push(`wr.status = $${params.length}`) }

        const { rows: data } = await db.query(
            `SELECT wr.date, wr.project, wr.description, wr.hours, wr.progress, wr.status, wr.notes,
                json_build_object('name', e.name, 'employee_id', e.employee_id, 'department', json_build_object('name', d.name)) AS employee
             FROM work_reports wr LEFT JOIN employees e ON e.id = wr.employee_id LEFT JOIN departments d ON d.id = e.department_id
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
             ORDER BY wr.date DESC`,
            params
        )
        csvContent = 'Date,Employee,Employee ID,Department,Project,Hours,Progress %,Status,Notes\n'
        data.forEach(e => {
            csvContent += row([e.date, e.employee?.name, e.employee?.employee_id, e.employee?.department?.name, e.project, e.hours, e.progress, e.status, e.notes])
        })
    } else if (type === 'expenses') {
        const conditions: string[] = []
        const params: unknown[] = []
        if (month) { params.push(`${month}-01`); conditions.push(`ex.date >= $${params.length}`); params.push(monthEnd(month)); conditions.push(`ex.date <= $${params.length}`) }

        const { rows: data } = await db.query(
            `SELECT ex.date, ex.category, ex.description, ex.amount, ex.payment_method, ex.payment_status, ex.note, ex.business_name, ex.invoice_id,
                json_build_object('name', s.name) AS submitter
             FROM expenses ex LEFT JOIN employees s ON s.id = ex.submitted_by
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
             ORDER BY ex.date DESC`,
            params
        )
        csvContent = 'Date,Category,Description,Amount,Payment Method,Status,Note,Business,Invoice ID,Submitted By\n'
        data.forEach(e => {
            csvContent += row([e.date, e.category, e.description, e.amount, e.payment_method, e.payment_status, e.note, e.business_name, e.invoice_id, e.submitter?.name])
        })
    } else {
        return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 })
    }

    // Prepend a UTF-8 BOM so Excel renders Bengali / ৳ correctly.
    return new NextResponse('﻿' + csvContent, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${type}-export-${date || month || 'all'}.csv"`,
        },
    })
}
