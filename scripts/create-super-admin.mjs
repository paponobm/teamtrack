// Creates (or re-provisions) a Super Admin account on Neon — same purpose and CLI shape as
// before the Supabase → Neon migration, just backed by our own `users` table + bcrypt instead
// of Supabase Auth. Non-destructive: never deletes or wipes anything, only creates/updates the
// one account you name. Safe to re-run — if the email already has a user row, its password is
// reset and it's (re)linked to the Super Admin role instead of erroring out.
//
// Usage:
//   npm run create-super-admin -- <email> <password> [name] [employeeId]

import dns from 'dns'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env' })

// This environment's DNS resolution can hang on Neon's IPv6-first "happy eyeballs" attempt
// before falling back to IPv4 — forcing ipv4first avoids that multi-second timeout.
dns.setDefaultResultOrder('ipv4first')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env.local or .env.')
    process.exit(1)
}

const [, , email, password, name, employeeId] = process.argv

if (!email || !password) {
    console.error('Usage: npm run create-super-admin -- <email> <password> [name] [employeeId]')
    process.exit(1)
}
if (password.length < 6) {
    console.error('Password must be at least 6 characters.')
    process.exit(1)
}

async function connect() {
    const url = new URL(DATABASE_URL)
    const addresses = await dns.promises.resolve4(url.hostname)
    const client = new pg.Client({
        host: addresses[0],
        port: Number(url.port) || 5432,
        database: url.pathname.replace(/^\//, ''),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        ssl: { rejectUnauthorized: false, servername: url.hostname },
        connectionTimeoutMillis: 20000,
    })
    await client.connect()
    return client
}

async function main() {
    const client = await connect()

    try {
        const { rows: [role] } = await client.query(`SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1`)
        if (!role) {
            console.error('Could not find the "Super Admin" role — has the roles table been seeded (see 001_initial_schema.sql)?')
            process.exit(1)
        }

        const passwordHash = await bcrypt.hash(password, 10)

        const { rows: [user] } = await client.query(
            `INSERT INTO users (email, password_hash)
             VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
             RETURNING id`,
            [email, passwordHash]
        )

        // employees' only unique constraint is the composite (email, employee_id) — and since
        // Postgres never treats two NULLs as conflicting, ON CONFLICT can't target a plain
        // email lookup reliably. Look the row up explicitly instead so re-runs stay idempotent.
        const { rows: [existing] } = await client.query(`SELECT id FROM employees WHERE email = $1`, [email])

        const employee = existing
            ? (await client.query(
                `UPDATE employees SET user_id = $1, name = $2, role_id = $3, is_active = true
                 WHERE id = $4
                 RETURNING id, name, employee_id`,
                [user.id, name || 'Super Admin', role.id, existing.id]
            )).rows[0]
            : (await client.query(
                `INSERT INTO employees (user_id, email, name, employee_id, role_id, is_active)
                 VALUES ($1, $2, $3, $4, $5, true)
                 RETURNING id, name, employee_id`,
                [user.id, email, name || 'Super Admin', employeeId || null, role.id]
            )).rows[0]

        console.log(`\n${email} is now Super Admin (employee "${employee.name}"${employee.employee_id ? `, ID ${employee.employee_id}` : ''}). Log in with the password you provided.`)
    } finally {
        await client.end()
    }
}

main().catch(err => {
    console.error('Failed:', err.message)
    process.exit(1)
})
