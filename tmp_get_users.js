import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('Error fetching users:', error)
    return
  }
  
  if (users.length === 0) {
    console.log("No users found.")
    return
  }
  
  users.forEach(u => {
    console.log(`Email: ${u.email}, Role: ${u.user_metadata?.role || 'user'}`)
  })
}

getUsers()
