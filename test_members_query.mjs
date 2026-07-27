import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testQuery() {
  const { data, error } = await supabase
    .from('employees')
    .select('*, role:roles(id, name, level), department:departments(id, name, name_bn)')
    .eq('is_active', true)

  console.log('Error:', error)
  console.log('Data count:', data?.length)
  console.log('Data:', JSON.stringify(data, null, 2))
}

testQuery()
