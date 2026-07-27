require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function reset() {
  const dates = ['2026-04-26', '2026-04-27']
  console.log(`Deleting attendance for ${dates.join(' and ')}...`)
  
  const { data, error } = await supabase
    .from('attendance')
    .delete()
    .in('date', dates)
    
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Attendance reset successfully.')
  }
}
reset()
