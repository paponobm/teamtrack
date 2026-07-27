import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth, isAuthed } from '@/lib/auth'

// GET /api/permissions - get all permissions (optionally filtered by employee)
export async function GET(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    
    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')

    let query = supabase
        .from('employee_permissions')
        .select(`
            *,
            employee:employees(id, name, employee_id),
            feature:features(id, name, name_bn, category, slug, sort_order)
        `)

    if (employeeId) {
        query = query.eq('employee_id', employeeId)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// POST /api/permissions - bulk upsert permissions
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth
    
    const supabase = auth.supabase
    const body = await request.json()

    // body is an array: [{ employee_id, feature_id, access_level }]
    const permissions = body.permissions as {
        employee_id: string
        feature_id: string
        access_level: 'admin' | 'member' | 'no_access'
    }[]

    if (!Array.isArray(permissions) || permissions.length === 0) {
        return NextResponse.json({ error: 'permissions array required' }, { status: 400 })
    }

    // Safety guard: Admins cannot modify permissions of Super Admins
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin) {
        // Extract unique employee IDs being modified
        const employeeIds = [...new Set(permissions.map(p => p.employee_id))]
        if (employeeIds.length > 0) {
            const { data: targets } = await supabase.from('employees').select('role:roles(level)').in('id', employeeIds)
            const attemptingSuperAdminMod = targets?.some(t => {
                const targetLevel = (t?.role as unknown as { level: number })?.level || 99
                return targetLevel <= 2
            })
            if (attemptingSuperAdminMod) {
                return NextResponse.json({ error: 'Admins cannot modify permissions of Super Admins' }, { status: 403 })
            }
        }
    }

    const { data, error } = await supabase
        .from('employee_permissions')
        .upsert(permissions, { onConflict: 'employee_id,feature_id' })
        .select()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Permissions updated', count: data?.length })
}
