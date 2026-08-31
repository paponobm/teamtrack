import dns from 'dns'
import pg from 'pg'

// This environment's DNS resolution can hang on Neon's IPv6-first "happy eyeballs" attempt
// before falling back to IPv4 — forcing ipv4first avoids that multi-second timeout/ETIMEDOUT.
dns.setDefaultResultOrder('ipv4first')

// node-postgres returns NUMERIC/DECIMAL columns as strings by default (e.g. "10000.00") to
// avoid silent precision loss — but every amount/percentage column in this schema is well
// within safe JS float range, and the app already treats them as numbers everywhere (sums,
// multiplication, toLocaleString). Left unparsed, raw values leak into forms/API responses
// as strings with whatever trailing zeros Postgres stored (unlike Supabase's PostgREST layer,
// which always serialized numeric columns as plain JSON numbers). Parsing them here once,
// globally, matches the old behavior everywhere instead of patching each call site.
pg.types.setTypeParser(1700, (val: string) => parseFloat(val)) // 1700 = NUMERIC/DECIMAL

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL environment variable.')
}

const connectionUrl = new URL(DATABASE_URL)

declare global {
    // eslint-disable-next-line no-var
    var __teamtrackPgPool: pg.Pool | undefined
}

// Some environments hang (ETIMEDOUT) resolving Neon hostnames via IPv6-first "happy eyeballs"
// even with ipv4first set — resolving the A record ourselves and dialing that IP directly is
// the reliable fix. `servername` keeps TLS SNI pointed at the real hostname so Neon's pooler
// proxy still routes to the correct backend.
const resolvedIp = (await dns.promises.resolve4(connectionUrl.hostname))[0]

// Reused across hot-reloads in dev so we don't leak a new pool per file-save.
export const pool: pg.Pool =
    global.__teamtrackPgPool ??
    new pg.Pool({
        host: resolvedIp,
        port: Number(connectionUrl.port) || 5432,
        database: connectionUrl.pathname.replace(/^\//, ''),
        user: decodeURIComponent(connectionUrl.username),
        password: decodeURIComponent(connectionUrl.password),
        ssl: { rejectUnauthorized: false, servername: connectionUrl.hostname },
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
