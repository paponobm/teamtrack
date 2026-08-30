import { requireAuth, isAuthed, escapeLikePattern } from '@/lib/auth'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// GET /api/members - list employees (admin sees full detail, members see basic directory)
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const isAdmin = auth.employee.roleLevel <= 3

    const search = searchParams.get('search') || ''
    const department = searchParams.get('department') || ''
    const role = searchParams.get('role') || ''
    const status = searchParams.get('status') || ''

    const selectFields = isAdmin
        ? `e.*, json_build_object('id', r.id, 'name', r.name, 'level', r.level) AS role,
           json_build_object('id', d.id, 'name', d.name, 'name_bn', d.name_bn) AS department`
        : `e.id, e.name, e.employee_id, e.designation, e.avatar_url,
           json_build_object('id', d.id, 'name', d.name) AS department,
           json_build_object('id', r.id, 'name', r.name) AS role`

    const conditions: string[] = []
    const params: unknown[] = []

    if (search) {
        const escaped = escapeLikePattern(search)
        params.push(`%${escaped}%`)
        conditions.push(`(e.name ILIKE $${params.length} OR e.employee_id ILIKE $${params.length} OR e.email ILIKE $${params.length})`)
    }
    if (department) {
        params.push(department)
        conditions.push(`e.department_id = $${params.length}`)
    }
    if (role && isAdmin) {
        params.push(role)
        conditions.push(`e.role_id = $${params.length}`)
    }
    if (status === 'active') {
        conditions.push(`e.is_active = true`)
    } else if (status === 'inactive') {
        conditions.push(`e.is_active = false`)
    } else if (!isAdmin) {
        conditions.push(`e.is_active = true`)
    }

    const { rows } = await db.query(
        `SELECT ${selectFields}
         FROM employees e
         LEFT JOIN roles r ON r.id = e.role_id
         LEFT JOIN departments d ON d.id = e.department_id
         ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
         ORDER BY e.created_at DESC`,
        params
    )

    return NextResponse.json(rows)
}

// POST /api/members - create new employee + login account (admin only)
export async function POST(request: Request) {
    const auth = await requireAuth(3)  // Admin+
    if (!isAuthed(auth)) return auth
    const db = auth.db

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
        const { rows: [newRole] } = await db.query(`SELECT level FROM roles WHERE id = $1`, [role_id])
        if (newRole && newRole.level <= 2) {
            return NextResponse.json({ error: 'Admins cannot create Super Admin accounts' }, { status: 403 })
        }
    }

    // 1. Create the login account
    const passwordHash = await bcrypt.hash(password || 'Teamtrack@2026', 10)
    let userId: string
    try {
        const { rows: [user] } = await db.query(
            `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
            [email, passwordHash]
        )
        userId = user.id
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create login account'
        return NextResponse.json({ error: message.includes('duplicate') ? 'An account with this email already exists' : message }, { status: 400 })
    }

    // 2. Create employee record linked to the login account
    let data
    try {
        const { rows: [emp] } = await db.query(
            `WITH ins AS (
                INSERT INTO employees (
                    user_id, employee_id, name, email, designation, address, nid_no, blood_group,
                    personal_contact, whatsapp_number, family_contact_1, family_contact_2,
                    department_id, role_id, joining_date, gender, date_of_birth,
                    duty_start_time, duty_end_time, cv_url, avatar_url, is_active
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,true)
                RETURNING *
             )
             SELECT ins.*,
                json_build_object('id', r.id, 'name', r.name, 'level', r.level) AS role,
                json_build_object('id', d.id, 'name', d.name, 'name_bn', d.name_bn) AS department
             FROM ins
             LEFT JOIN roles r ON r.id = ins.role_id
             LEFT JOIN departments d ON d.id = ins.department_id`,
            [
                userId, empId, name, email, designation, address, nid_no, blood_group,
                personal_contact, whatsapp_number, family_contact_1, family_contact_2,
                department_id || null, role_id || null, joining_date || null, gender || null, date_of_birth || null,
                duty_start_time || null, duty_end_time || null, cv_url || null, avatar_url || null,
            ]
        )
        data = emp
    } catch (err) {
        // Roll back the just-created login account so a half-provisioned account doesn't block retries.
        await db.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => { })
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create employee' }, { status: 500 })
    }

    // 3. Auto-assign default permissions based on features.
    // NOTE: courier & content are intentionally NOT seeded — they must be granted explicitly
    // per the client's request (otherwise every new member sees those pages by default).
    const defaultFeatureSlugs = [
        'whatsapp-group', 'main-group', 'notice-board', 'problem-box', 'idea-sharing',
    ]

    const { rows: defaultFeatures } = await db.query(
        `SELECT id FROM features WHERE slug = ANY($1)`,
        [defaultFeatureSlugs]
    )

    if (defaultFeatures.length > 0) {
        await db.query(
            `INSERT INTO employee_permissions (employee_id, feature_id, access_level)
             SELECT $1, * , 'member' FROM UNNEST($2::uuid[])`,
            [data.id, defaultFeatures.map((f: { id: string }) => f.id)]
        )
    }

    return NextResponse.json(data, { status: 201 })
}
