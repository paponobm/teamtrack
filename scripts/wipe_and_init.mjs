import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeAndInit() {
    console.log("Starting DB Wipe Phase 2...");
    
    // clear audit_log
    const { error: auditError } = await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (auditError) console.log("Failed to clear audit_log:", auditError.message);
    else console.log("Cleared audit_log");

    // try to clear employees again
    const { error: empError } = await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (empError) console.log(`Failed to clear employees:`, empError.message);
    else console.log(`Cleared employees completely`);

    // Delete all auth users again just to be clean
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersData && usersData.users) {
        for (const u of usersData.users) {
            await supabase.auth.admin.deleteUser(u.id);
        }
        console.log("Cleared all auth users again.");
    }

    console.log("Creating new admin user...");
    const email = 'md.masud15s@gmail.com';
    const password = 'AdminPassword2026!'; // Default password

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
    });

    if (createError) {
        console.error("Failed to create admin user:", createError.message);
        return;
    }

    console.log(`Created auth user ${email} with ID: ${newUser.user.id}`);

    // Get Admin role
    const { data: roles } = await supabase.from('roles').select('*').eq('name', 'Owner').single();
    let roleId = roles?.id;

    // Get a department
    const { data: deps } = await supabase.from('departments').select('*').eq('name', 'All Department').single();
    let depId = deps?.id;

    // Create employee record
    const { error: empInsertError } = await supabase.from('employees').insert({
        user_id: newUser.user.id,
        name: 'Md Masud (Admin)',
        email: email,
        role_id: roleId,
        department_id: depId,
        employee_id: 'ADM-001',
        is_active: true
    });

    if (empInsertError) {
        console.error("Failed to insert employee record:", empInsertError.message);
    } else {
        console.log("Successfully created employee record for admin.");
    }
    
    // Give all feature permissions to this admin
    const { data: features } = await supabase.from('features').select('id');
    if (features && features.length > 0) {
        const { data: emps } = await supabase.from('employees').select('id').eq('user_id', newUser.user.id).single();
        if (emps) {
            const perms = features.map(f => ({
                employee_id: emps.id,
                feature_id: f.id,
                access_level: 'admin'
            }));
            const { error: permError } = await supabase.from('employee_permissions').insert(perms);
            if (permError) console.log("Error setting permissions:", permError.message);
            else console.log("Set all feature permissions to admin.");
        }
    }

    console.log("Done.");
}

wipeAndInit();
