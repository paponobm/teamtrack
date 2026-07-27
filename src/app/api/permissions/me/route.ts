import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/permissions/me - get current user's permissions
export async function GET() {
    const supabase = await createClient()

    // Get current auth user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Find employee record for this user
    const { data: employee } = await adminClient
        .from('employees')
        .select('id, role_id, role:roles(name, level)')
        .eq('user_id', user.id)
        .single()

    if (!employee) {
        return NextResponse.json({ error: 'No employee record' }, { status: 404 })
    }

    // Check if user is Owner, Super Admin, or Admin (level 1–3) - they get full access
    const roleLevel = (employee.role as unknown as { name: string; level: number } | null)?.level
    if (roleLevel && roleLevel <= 3) {
        // Return all features as admin
        const { data: features } = await adminClient
            .from('features')
            .select('id, slug')

        const allAdmin: Record<string, string> = {}
        features?.forEach(f => {
            allAdmin[f.slug] = 'admin'
        })

        return NextResponse.json({
            employee_id: employee.id,
            role: (employee.role as unknown as { name: string; level: number } | null)?.name,
            permissions: allAdmin,
            is_super: roleLevel <= 2,
            is_admin: true,
        })
    }

    // For regular users, get their specific permissions
    const { data: perms } = await adminClient
        .from('employee_permissions')
        .select('access_level, feature:features(slug)')
        .eq('employee_id', employee.id)

    const permMap: Record<string, string> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    perms?.forEach((p: any) => {
        const slug = Array.isArray(p.feature) ? p.feature[0]?.slug : p.feature?.slug
        if (slug) {
            permMap[slug] = p.access_level
        }
    })

    return NextResponse.json({
        employee_id: employee.id,
        role: (employee.role as unknown as { name: string; level: number } | null)?.name,
        permissions: permMap,
        is_super: false,
        is_admin: false,
    })
}
