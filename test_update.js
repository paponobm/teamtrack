import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // get a user
    const { data: users } = await supabase.from('employees').select('id, total_points').limit(1);
    const empId = users[0].id;
    const oldPoints = users[0].total_points;
    console.log("Old points:", oldPoints);

    // create a task
    const { data: task } = await supabase.from('tasks').insert({
        title: "Test trigger task",
        created_by: empId
    }).select().single();

    // check points after create
    const { data: p2 } = await supabase.from('employees').select('total_points').eq('id', empId).single();
    console.log("Points after create:", p2.total_points);

    // update task
    await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
    
    // check points after update
    const { data: p3 } = await supabase.from('employees').select('total_points').eq('id', empId).single();
    console.log("Points after update:", p3.total_points);
}
run();
