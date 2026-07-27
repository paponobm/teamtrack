import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/attendance/me/history - get attendance & breaks for the logged-in user in a given month
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    
    const now = new Date()
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()))

    // Build start and end dates for the month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    // 1. Get attendance records for this month
    const { data: attendanceRecords, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', auth.employee.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

    if (attError) return NextResponse.json({ error: attError.message }, { status: 500 })

    if (!attendanceRecords || attendanceRecords.length === 0) {
        return NextResponse.json({ records: [], breaks: [] })
    }

    const attendanceIds = attendanceRecords.map(r => r.id)

    // 2. Get breaks for these attendance records
    const { data: breaks, error: breaksError } = await supabase
        .from('attendance_breaks')
        .select('*')
        .in('attendance_id', attendanceIds)
        .order('start_time', { ascending: true })

    if (breaksError) return NextResponse.json({ error: breaksError.message }, { status: 500 })

    return NextResponse.json({ records: attendanceRecords, breaks: breaks || [] })
}
