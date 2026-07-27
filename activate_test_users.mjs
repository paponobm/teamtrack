import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function activateUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('Error fetching users:', error)
    return
  }

  const adminUser = users.find(u => u.email === 'admin@teamtrack.test')
  const memberUser = users.find(u => u.email === 'member@teamtrack.test')

  const { data: roles, error: rolesError } = await supabase.from('roles').select('*')
  if (rolesError) {
    console.error('Error fetching roles:', rolesError)
    return
  }

  const adminRole = roles.find(r => r.name === 'Admin' || r.level === 3)
  const memberRole = roles.find(r => r.name === 'Member' || r.level === 5)

  if (adminUser && adminRole) {
    const { error: insertAdminErr } = await supabase.from('employees').upsert({
      user_id: adminUser.id,
      email: adminUser.email,
      name: 'Test Admin',
      employee_id: 'EMP-ADM',
      role_id: adminRole.id,
      is_active: true
    }, { onConflict: 'email' })
    if (insertAdminErr) console.error('Admin Insert Error:', insertAdminErr)
    else console.log('Admin activated')
  } else {
    console.log('Admin user or role not found', { adminUser: !!adminUser, adminRole: !!adminRole })
  }

  if (memberUser && memberRole) {
    const { error: insertMemberErr } = await supabase.from('employees').upsert({
      user_id: memberUser.id,
      email: memberUser.email,
      name: 'Test Member',
      employee_id: 'EMP-MEM',
      role_id: memberRole.id,
      is_active: true
    }, { onConflict: 'email' })
    if (insertMemberErr) console.error('Member Insert Error:', insertMemberErr)
    else console.log('Member activated')
  } else {
    console.log('Member user or role not found', { memberUser: !!memberUser, memberRole: !!memberRole })
  }
}

activateUsers()
