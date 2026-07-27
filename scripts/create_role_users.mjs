import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import ws from 'ws'

dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  realtime: { transport: ws },
})

const USERS = [
  { email: 'owner@teamtrack.test', name: 'Test Owner', employeeId: 'EMP-OWN', roleName: 'Owner' },
  { email: 'superadmin@teamtrack.test', name: 'Test Super Admin', employeeId: 'EMP-SUP', roleName: 'Super Admin' },
  { email: 'admin@teamtrack.test', name: 'Test Admin', employeeId: 'EMP-ADM', roleName: 'Admin' },
  { email: 'manager@teamtrack.test', name: 'Test Manager', employeeId: 'EMP-MGR', roleName: 'Manager' },
  { email: 'member@teamtrack.test', name: 'Test Member', employeeId: 'EMP-MEM', roleName: 'Member' },
]

const PASSWORD = 'password123'

async function main() {
  const { data: roles, error: rolesError } = await supabase.from('roles').select('*')
  if (rolesError) {
    console.error('Error fetching roles:', rolesError.message)
    process.exit(1)
  }

  const { data: { users: existingUsers }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing existing users:', listError.message)
    process.exit(1)
  }

  for (const u of USERS) {
    const role = roles.find(r => r.name === u.roleName)
    if (!role) {
      console.error(`Skipping ${u.email}: role "${u.roleName}" not found`)
      continue
    }

    let authUser = existingUsers.find(x => x.email === u.email)
    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { role: u.roleName },
      })
      if (error) {
        console.error(`Auth create error for ${u.email}:`, error.message)
        continue
      }
      authUser = data.user
      console.log(`Created auth user: ${u.email}`)
    } else {
      console.log(`Auth user already exists: ${u.email}`)
    }

    const { error: upsertError } = await supabase.from('employees').upsert({
      user_id: authUser.id,
      email: u.email,
      name: u.name,
      employee_id: u.employeeId,
      role_id: role.id,
      is_active: true,
    }, { onConflict: 'email' })

    if (upsertError) {
      console.error(`Employee upsert error for ${u.email}:`, upsertError.message)
    } else {
      console.log(`Linked employee for ${u.email} as ${u.roleName}`)
    }
  }

  console.log('\nDone. All accounts use password:', PASSWORD)
}

main()
