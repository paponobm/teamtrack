// Runs after `prisma migrate reset` (unless --skip-seed is passed). Re-creates the handful of
// rows the app can't function without — roles and departments — using plain `pg` (matching how
// the rest of this project talks to Postgres; there's no @prisma/client here, Prisma is used
// only for schema migrations). Idempotent: safe to run against a database that already has
// these rows.
import dns from 'dns'
import net from 'net'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env' })

// Some networks have a broken/flaky IPv6 route that makes Node's dual-stack "Happy Eyeballs"
// connection dialing (the default since Node 20) fail outright instead of falling back to IPv4
// — even with DNS ordering set to prefer IPv4. Disabling autoSelectFamily restores the older,
// simpler behavior: resolve one address (honoring ipv4first below) and connect to just that one.
dns.setDefaultResultOrder('ipv4first')
net.setDefaultAutoSelectFamily(false)

async function connect() {
    const url = new URL(process.env.DATABASE_URL)
    // Only ask for SSL when the connection string actually requests it (Neon does via
    // ?sslmode=require; a local/self-hosted Postgres like 127.0.0.1 typically doesn't have SSL
    // configured at all) — forcing it unconditionally would break local setups.
    const sslMode = url.searchParams.get('sslmode')
    const useSsl = !!(sslMode && sslMode !== 'disable')
    const client = new pg.Client({
        host: url.hostname,
        port: Number(url.port) || 5432,
        database: url.pathname.replace(/^\//, ''),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        ssl: useSsl ? { rejectUnauthorized: false, servername: url.hostname } : undefined,
        connectionTimeoutMillis: 20000,
    })
    await client.connect()
    return client
}

async function main() {
    const client = await connect()
    try {
        await client.query(`
            INSERT INTO roles (name, level) VALUES
                ('Owner', 1), ('Super Admin', 2), ('Admin', 3), ('Manager', 4), ('Member', 5)
            ON CONFLICT (name) DO NOTHING
        `)

        // departments.name has no unique constraint, so ON CONFLICT can't dedupe here — guard
        // with a plain existence check per row instead.
        const departments = [
            ['Sales', 'সেলস'],
            ['Marketing', 'মার্কেটিং'],
            ['Courier', 'কুরিয়ার'],
            ['Warehouse', 'ওয়্যারহাউস'],
            ['All Department', 'সকল বিভাগ'],
        ]
        for (const [name, name_bn] of departments) {
            await client.query(
                `INSERT INTO departments (name, name_bn)
                 SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = $1)`,
                [name, name_bn]
            )
        }

        console.log('Seeded roles and departments.')
        console.log('No login accounts exist yet — run: npm run create-super-admin -- <email> <password>')
    } finally {
        await client.end()
    }
}

main().catch(err => {
    // err.message can be empty on an AggregateError (multiple failed connection attempts) —
    // logging the whole error, plus any nested .errors, avoids a blank "Seed failed:" message.
    console.error('Seed failed:', err.message || err)
    if (err.errors) for (const e of err.errors) console.error('  -', e.message || e)
    process.exit(1)
})
