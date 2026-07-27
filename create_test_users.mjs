import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createUsers() {
  // Create Admin
  const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
    email: 'admin@teamtrack.test',
    password: 'password123',
    email_confirm: true,
    user_metadata: { role: 'admin' }
  })
  
  if (adminError) {
    console.error('Admin create error:', adminError)
  } else {
    console.log('Admin created:', adminData.user.email)
  }

  // Create Member
  const { data: memberData, error: memberError } = await supabase.auth.admin.createUser({
    email: 'member@teamtrack.test',
    password: 'password123',
    email_confirm: true,
    user_metadata: { role: 'user' }
  })
  
  if (memberError) {
    console.error('Member create error:', memberError)
  } else {
    console.log('Member created:', memberData.user.email)
  }
}

createUsers()
