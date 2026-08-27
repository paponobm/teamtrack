// Creates (or re-provisions) a Super Admin account — meant for exactly the situation this was
// written for: you've wiped the database (e.g. via 062_full_data_reset.sql or a manual purge)
// and need a first admin to log in with again. Non-destructive: never deletes or wipes
// anything, only creates/updates the one account you name. Safe to re-run — if the email
// already has an auth user, its password is reset and it's (re)linked to the Super Admin role
// instead of erroring out.
//
// Usage:
//   npm run create-super-admin -- <email> <password> [name] [employeeId]
//
// Example:
//   npm run create-super-admin -- owner@company.com "Str0ng!Pass" "Jane Doe" ADM-001

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import ws from 'ws'

dotenv.config({ path: '.env.local' })
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local then .env).')
    process.exit(1)
}

const [, , email, password, name, employeeId] = process.argv

if (!email || !password) {
    console.error('Usage: npm run create-super-admin -- <email> <password> [name] [employeeId]')
    process.exit(1)
}
if (password.length < 6) {
    console.error('Password must be at least 6 characters (Supabase Auth minimum).')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
})

async function main() {
    const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('id, name')
        .eq('name', 'Super Admin')
        .maybeSingle()

    if (roleError || !role) {
        console.error('Could not find the "Super Admin" role — has the roles table been seeded (see 001_initial_schema.sql)?', roleError?.message || '')
        process.exit(1)
    }

    const { data: { users: existingUsers }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (listError) {
        console.error('Error listing existing auth users:', listError.message)
        process.exit(1)
    }

    let authUser = existingUsers.find(u => u.email === email)
    if (authUser) {
        const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, { password, email_confirm: true })
        if (error) {
            console.error(`Failed to reset password for existing auth user ${email}:`, error.message)
            process.exit(1)
        }
        authUser = data.user
        console.log(`Auth user already existed for ${email} — password reset.`)
    } else {
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })
        if (error) {
            console.error(`Failed to create auth user for ${email}:`, error.message)
            process.exit(1)
        }
        authUser = data.user
        console.log(`Created new auth user for ${email}.`)
    }

    const { data: employee, error: upsertError } = await supabase
        .from('employees')
        .upsert({
            user_id: authUser.id,
            email,
            name: name || 'Super Admin',
            employee_id: employeeId || null,
            role_id: role.id,
            is_active: true,
        }, { onConflict: 'email' })
        .select('id, name, employee_id')
        .single()

    if (upsertError) {
        console.error(`Failed to link ${email} to an employee record:`, upsertError.message)
        process.exit(1)
    }

    console.log(`\n${email} is now Super Admin (employee "${employee.name}"${employee.employee_id ? `, ID ${employee.employee_id}` : ''}). Log in with the password you provided.`)
}

main()
