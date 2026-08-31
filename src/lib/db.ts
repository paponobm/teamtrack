import dns from 'dns'
import net from 'net'
import pg from 'pg'

// Some networks have a broken/flaky IPv6 route that makes Node's dual-stack "Happy Eyeballs"
// connection dialing (the default since Node 20) fail outright instead of falling back to IPv4
// — even with DNS ordering set to prefer IPv4. Disabling autoSelectFamily restores the older,
// simpler behavior: resolve one address (honoring ipv4first below) and connect to just that one.
// Both calls are synchronous config, not network I/O, so they're safe to run at import time.
dns.setDefaultResultOrder('ipv4first')
net.setDefaultAutoSelectFamily(false)

// node-postgres returns NUMERIC/DECIMAL columns as strings by default (e.g. "10000.00") to
// avoid silent precision loss — but every amount/percentage column in this schema is well
// within safe JS float range, and the app already treats them as numbers everywhere (sums,
// multiplication, toLocaleString). Left unparsed, raw values leak into forms/API responses
// as strings with whatever trailing zeros Postgres stored (unlike Supabase's PostgREST layer,
// which always serialized numeric columns as plain JSON numbers). Parsing them here once,
// globally, matches the old behavior everywhere instead of patching each call site.
pg.types.setTypeParser(1700, (val: string) => parseFloat(val)) // 1700 = NUMERIC/DECIMAL

// node-postgres's default DATE parser builds a JS Date at local midnight, then every JSON
// response serializes that as a UTC ISO string via .toISOString() — which silently shifts the
// calendar day whenever the server's local timezone is ahead of UTC (e.g. Aug 31 becomes
// "2026-08-30T18:00:00.000Z" at UTC+6), and produces "Invalid Date" wherever the frontend
// expects a plain "YYYY-MM-DD" string to slice/compare/parse directly. Postgres already sends
// DATE values over the wire as plain "YYYY-MM-DD" text — returning that raw string unparsed
// matches what Supabase's PostgREST layer always returned, with no timezone math at all.
pg.types.setTypeParser(1082, (val: string) => val) // 1082 = DATE

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL environment variable.')
}

const connectionUrl = new URL(DATABASE_URL)
// Only ask for SSL when the connection string actually requests it (Neon does via
// ?sslmode=require; a local/self-hosted Postgres typically doesn't have SSL configured at all)
// — forcing it unconditionally would break local/droplet setups.
const sslMode = connectionUrl.searchParams.get('sslmode')
const useSsl = !!(sslMode && sslMode !== 'disable')

declare global {
    // eslint-disable-next-line no-var
    var __teamtrackPgPool: pg.Pool | undefined
}

// Deliberately no DNS resolution (or any other network I/O) at module scope — importing this
// file happens during `next build`'s page-data-collection step too, not just at request time,
// so anything awaited here runs during the build itself. `pg.Pool` doesn't connect until the
// first query, so construction here is synchronous and safe regardless of whether the database
// is even reachable yet. `servername` keeps TLS SNI pointed at the real hostname (needed for
// Neon's pooler to route correctly) even though `host` is also the hostname here.
export const pool: pg.Pool =
    global.__teamtrackPgPool ??
    new pg.Pool({
        host: connectionUrl.hostname,
        port: Number(connectionUrl.port) || 5432,
        database: connectionUrl.pathname.replace(/^\//, ''),
        user: decodeURIComponent(connectionUrl.username),
        password: decodeURIComponent(connectionUrl.password),
        ssl: useSsl ? { rejectUnauthorized: false, servername: connectionUrl.hostname } : undefined,
        max: 10,
    })

if (process.env.NODE_ENV !== 'production') {
    global.__teamtrackPgPool = pool
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<pg.QueryResult<T>> {
    return pool.query<T>(text, params)
}
