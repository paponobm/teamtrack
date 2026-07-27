import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.rpc('execute_sql', { query: "SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'tasks'::regclass;" });
    console.log("Tasks triggers:", data, error);
}
run();
