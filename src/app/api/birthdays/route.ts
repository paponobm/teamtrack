import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/birthdays - get employees whose birthday is today
export async function GET() {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()

    // Get all employees with DOB and check month/day match
    const { data: employees, error } = await supabase
        .from('employees')
        .select('id, name, photo_url, date_of_birth, designation')
        .eq('is_active', true)
        .not('date_of_birth', 'is', null)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const birthdayMembers = (employees || []).filter(emp => {
        if (!emp.date_of_birth) return false
        const dob = new Date(emp.date_of_birth + 'T00:00:00')
        return dob.getMonth() + 1 === month && dob.getDate() === day
    })

    return NextResponse.json(birthdayMembers)
}
