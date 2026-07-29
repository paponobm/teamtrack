import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/export?type=work-log&date=2024-03-01 (or month=2024-03 or range)
// GET /api/export?type=attendance&month=2024-03
// GET /api/export?type=expenses&month=2024-03
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+ only
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
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
        let query = supabase
            .from('work_entries')
            .select('date, sl, customer_phone, invoice_no, courier_id, source, amount, advance, note, order_type, delivery_status, employee:employees!employee_id(name)')
            .order('date', { ascending: false })

        if (date) query = query.eq('date', date)
        if (month) query = query.gte('date', `${month}-01`).lte('date', monthEnd(month))

        const { data } = await query
        csvContent = 'Date,SL,Customer Phone,Invoice,Courier ID,Source,Amount,Advance,Note,Order Type,Status,Employee\n'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ; (data || []).forEach((e: any) => {
                const empName = Array.isArray(e.employee) ? e.employee[0]?.name : e.employee?.name
                csvContent += row([e.date, e.sl, e.customer_phone, e.invoice_no, e.courier_id, e.source, e.amount, e.advance || 0, e.note, e.order_type, e.delivery_status, empName])
            })
    } else if (type === 'attendance') {
        // The Attendance Report tab uses start_date/end_date (+ optional employee_id/status) and
        // wants Employee ID/Department columns too — kept as a separate branch so the original
        // date/month single-export (used by the Daily Attendance tab today) is untouched.
        const isRangeExport = !!(startDate && endDate)

        let query = supabase
            .from('attendance')
            .select(
                isRangeExport
                    ? 'date, status, clock_in, clock_out, notes, employee:employees!employee_id(name, employee_id, department:departments(name))'
                    : 'date, status, clock_in, clock_out, notes, employee:employees!employee_id(name)'
            )
            .order('date', { ascending: false })

        if (isRangeExport) {
            query = query.gte('date', startDate!).lte('date', endDate!)
            if (employeeId) query = query.eq('employee_id', employeeId)
            if (status) query = query.eq('status', status)
        } else {
            if (date) query = query.eq('date', date)
            if (month) query = query.gte('date', `${month}-01`).lte('date', monthEnd(month))
        }

        const { data } = await query
        if (isRangeExport) {
            csvContent = 'Date,Employee,Employee ID,Department,Status,Clock In,Clock Out,Notes\n'
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ; (data || []).forEach((e: any) => {
                    const emp = Array.isArray(e.employee) ? e.employee[0] : e.employee
                    csvContent += row([e.date, emp?.name, emp?.employee_id, emp?.department?.name, e.status, e.clock_in || '', e.clock_out || '', e.notes])
                })
        } else {
            csvContent = 'Date,Employee,Status,Clock In,Clock Out,Notes\n'
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ; (data || []).forEach((e: any) => {
                    const empName = Array.isArray(e.employee) ? e.employee[0]?.name : e.employee?.name
                    csvContent += row([e.date, empName, e.status, e.clock_in || '', e.clock_out || '', e.notes])
                })
        }
    } else if (type === 'work-reports') {
        let query = supabase
            .from('work_reports')
            .select('date, project, description, hours, progress, status, notes, employee:employees!employee_id(name, employee_id, department:departments(name))')
            .order('date', { ascending: false })

        if (startDate && endDate) query = query.gte('date', startDate).lte('date', endDate)
        if (employeeId) query = query.eq('employee_id', employeeId)
        if (status) query = query.eq('status', status)

        const { data } = await query
        csvContent = 'Date,Employee,Employee ID,Department,Project,Hours,Progress %,Status,Notes\n'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ; (data || []).forEach((e: any) => {
                const emp = Array.isArray(e.employee) ? e.employee[0] : e.employee
                csvContent += row([e.date, emp?.name, emp?.employee_id, emp?.department?.name, e.project, e.hours, e.progress, e.status, e.notes])
            })
    } else if (type === 'expenses') {
        let query = supabase
            .from('expenses')
            .select('date, category, description, amount, payment_method, payment_status, note, business_name, invoice_id, submitter:employees!submitted_by(name)')
            .order('date', { ascending: false })

        if (month) query = query.gte('date', `${month}-01`).lte('date', monthEnd(month))

        const { data } = await query
        csvContent = 'Date,Category,Description,Amount,Payment Method,Status,Note,Business,Invoice ID,Submitted By\n'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ; (data || []).forEach((e: any) => {
                const empName = Array.isArray(e.submitter) ? e.submitter[0]?.name : e.submitter?.name
                csvContent += row([e.date, e.category, e.description, e.amount, e.payment_method, e.payment_status, e.note, e.business_name, e.invoice_id, empName])
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
