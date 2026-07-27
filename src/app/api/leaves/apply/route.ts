import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()
    const { startDate, endDate, reason } = body

    if (!startDate || !endDate || !reason) {
        return NextResponse.json({ error: 'Start date, end date, and reason are required' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Calculate difference in days (inclusive)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    if (diffDays > 3) {
        return NextResponse.json({ error: 'You can only apply for a maximum of 3 days at a time' }, { status: 400 })
    }
    if (diffDays < 1 || start > end) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    // Generate array of dates
    const dates = []
    for (let i = 0; i < diffDays; i++) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        dates.push(d.toISOString().split('T')[0])
    }

    // Insert into leave_records
    const insertData = dates.map(date => ({
        employee_id: auth.employee.id,
        leave_date: date,
        reason: reason,
        status: 'pending'
    }))

    const { error } = await supabase
        .from('leave_records')
        .upsert(insertData, { onConflict: 'employee_id,leave_date' })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: dates.length })
}

export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    
    const { data, error } = await supabase
        .from('leave_records')
        .select('*')
        .eq('employee_id', auth.employee.id)
        .order('leave_date', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ records: data || [] })
}

export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const idsStr = searchParams.get('ids')
    
    if (!idsStr) {
        return NextResponse.json({ error: 'ids parameter is required' }, { status: 400 })
    }

    const ids = idsStr.split(',')

    // Make sure we only delete our own pending records
    const { error } = await supabase
        .from('leave_records')
        .delete()
        .in('id', ids)
        .eq('employee_id', auth.employee.id)
        .eq('status', 'pending')

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
