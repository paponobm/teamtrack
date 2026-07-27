import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.DATABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgres://postgres:').replace('.supabase.co', '.supabase.co:5432/postgres') : '') });

async function run() {
    await client.connect();
    const res = await client.query(`
        SELECT tgname, relname, proname 
        FROM pg_trigger 
        JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
        JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
        WHERE relname IN ('tasks', 'task_assignments', 'audit_log');
    `);
    console.log(res.rows);
    await client.end();
}
run().catch(console.error);
