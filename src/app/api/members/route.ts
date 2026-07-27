import { requireAuth, isAuthed, escapeLikePattern } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/members - list employees (admin sees full detail, members see basic directory)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3

    const search = searchParams.get('search') || ''
    const department = searchParams.get('department') || ''
    const role = searchParams.get('role') || ''
    const status = searchParams.get('status') || ''

    // Admin sees everything; members see basic directory info only
    const selectFields = isAdmin
        ? `*, role:roles(id, name, level), department:departments(id, name, name_bn)`
        : `id, name, employee_id, designation, avatar_url, department:departments(id, name), role:roles(id, name)`

    let query = supabase
        .from('employees')
        .select(selectFields)
        .order('created_at', { ascending: false })

    if (search) {
        const escaped = escapeLikePattern(search)
        query = query.or(`name.ilike.%${escaped}%,employee_id.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    }

    if (department) query = query.eq('department_id', department)
    if (role && isAdmin) query = query.eq('role_id', role)

    if (status === 'active') {
        query = query.eq('is_active', true)
    } else if (status === 'inactive') {
        query = query.eq('is_active', false)
    } else if (!isAdmin) {
        // Members only see active employees
        query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

// POST /api/members - create new employee + Supabase Auth account (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3)  // Admin+
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const body = await request.json()

    const {
        name, email, password, designation, address, nid_no, blood_group,
        personal_contact, whatsapp_number, family_contact_1, family_contact_2,
        department_id, role_id, joining_date, employee_id: empId,
        gender, date_of_birth, duty_start_time, duty_end_time, cv_url, avatar_url
    } = body

    // Safety guard: Admins cannot create Super Admins
    const isSuperAdmin = auth.employee.roleLevel <= 2
    if (!isSuperAdmin && role_id) {
        const { data: newRole } = await supabase.from('roles').select('level').eq('id', role_id).single()
        if (newRole && newRole.level <= 2) {
            return NextResponse.json({ error: 'Admins cannot create Super Admin accounts' }, { status: 403 })
        }
    }

    // 1. Create Supabase Auth user
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password: password || 'Teamtrack@2026',
            email_confirm: true,
        }),
    })

    const authData = await authResponse.json()

    if (!authResponse.ok) {
        console.error('Auth user creation failed:', authResponse.status, authData)
        return NextResponse.json(
            { error: authData.msg || authData.message || authData.error_description || 'Failed to create auth user' },
            { status: 400 }
        )
    }

    // 2. Create employee record linked to auth user
    const { data, error } = await supabase
        .from('employees')
        .insert({
            user_id: authData.id,
            employee_id: empId,
            name,
            email,
            designation,
            address,
            nid_no,
            blood_group,
            personal_contact,
            whatsapp_number,
            family_contact_1,
            family_contact_2,
            department_id: department_id || null,
            role_id: role_id || null,
            joining_date: joining_date || null,
            gender: gender || null,
            date_of_birth: date_of_birth || null,
            duty_start_time: duty_start_time || null,
            duty_end_time: duty_end_time || null,
            cv_url: cv_url || null,
            avatar_url: avatar_url || null,
            is_active: true
        })
        .select(`*, role:roles(id, name, level), department:departments(id, name, name_bn)`)
        .single()

    if (error) {
        // Roll back the just-created auth user so a half-provisioned account doesn't block retries.
        if (authData?.id) {
            await fetch(`${supabaseUrl}/auth/v1/admin/users/${authData.id}`, {
                method: 'DELETE',
                headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
            }).catch(() => { })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 3. Auto-assign default permissions based on features.
    // NOTE: courier & content are intentionally NOT seeded — they must be granted explicitly
    // per the client's request (otherwise every new member sees those pages by default).
    const defaultFeatureSlugs = [
        'whatsapp-group', 'main-group', 'notice-board', 'problem-box', 'idea-sharing',
    ]

    const { data: defaultFeatures } = await supabase
        .from('features')
        .select('id, slug')
        .in('slug', defaultFeatureSlugs)

    if (defaultFeatures && defaultFeatures.length > 0) {
        const permissionsToInsert = defaultFeatures.map(f => ({
            employee_id: data.id,
            feature_id: f.id,
            access_level: 'member'
        }))
        await supabase.from('employee_permissions').insert(permissionsToInsert)
    }

    return NextResponse.json(data, { status: 201 })
}
