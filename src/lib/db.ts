import dns from 'dns'
import pg from 'pg'

// This environment's DNS resolution can hang on Neon's IPv6-first "happy eyeballs" attempt
// before falling back to IPv4 — forcing ipv4first avoids that multi-second timeout/ETIMEDOUT.
dns.setDefaultResultOrder('ipv4first')

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
