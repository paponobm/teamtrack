// Runs after `prisma migrate reset` (unless --skip-seed is passed). Re-creates the reference
// data the app can't function without — roles, departments, features (drives the per-member
// Access/permissions tab), point categories, work-log source options, and the app_settings
// singleton row — using plain `pg` (matching how the rest of this project talks to Postgres;
// there's no @prisma/client here, Prisma is used only for schema migrations). Idempotent: safe
// to run against a database that already has these rows. Mirrors the seed data originally in
// supabase/migrations/001_initial_schema.sql, 016_missing_feature_slugs.sql, 008_client_corrections.sql,
// and 020_app_settings.sql — Prisma migrations are schema-only, so none of that original seed
// data survives a `migrate reset` on its own.
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

        // Drives the per-member Access/permissions tab (Members → Edit Member → Access) — every
        // toggle shown there corresponds to one of these rows via employee_permissions.feature_id.
        const features = [
            ['Ecomdrive', 'ইকমড্রাইভ', 'Platform', 'ecomdrive', 1],
            ['Smartcomm', 'স্মার্টকম', 'Platform', 'smartcomm', 2],
            ['Steadfast', 'স্টেডফাস্ট', 'Platform', 'steadfast', 3],
            ['Facebook', 'ফেসবুক', 'Platform', 'facebook', 4],
            ['WhatsApp Group', 'হোয়াটসঅ্যাপ গ্রুপ', 'All Department', 'whatsapp-group', 5],
            ['Main Group', 'অনলাইন বার্মিজ মার্কেট', 'All Department', 'main-group', 6],
            ['Notice Board', 'নোটিশ বোর্ড', 'All Department', 'notice-board', 7],
            ['Problem Box', 'প্রবলেম বক্স', 'All Department', 'problem-box', 8],
            ['Idea Sharing', 'আইডিয়া শেয়ার', 'All Department', 'idea-sharing', 9],
            ['2000+ Orders', '২০০০+ অর্ডার', 'Sales', 'orders-2000-plus', 10],
            ['Suggest Orders', 'সাজেস্ট অর্ডার', 'Sales', 'suggest-orders', 11],
            ['Pending Orders', 'পেন্ডিং অর্ডার', 'Sales', 'pending-orders', 12],
            ['Payment Confirmation', 'পেমেন্ট কনফার্মেশন', 'Sales', 'payment-confirmation', 13],
            ['Daily Order Submit', 'দৈনিক অর্ডার জমা', 'Sales', 'daily-order-submit', 14],
            ['Refund/Exchange', 'রিফান্ড/একচেঞ্জ', 'Sales', 'refund-exchange', 15],
            ['Customer Review', 'কাস্টমার রিভিউ', 'Sales & Marketing', 'customer-review', 16],
            ['PR Sending', 'PR Sending', 'Sales & Marketing', 'pr-sending', 17],
            ['Content Draft', 'কন্টেন্ট ড্রাফ', 'Marketing', 'content-draft', 18],
            ['Final Content', 'ফাইনাল কন্টেন্ট', 'Marketing', 'final-content', 19],
            ['Promotional Video', 'প্রমোশনাল ভিডিও', 'Marketing', 'promotional-video', 20],
            ['Courier Management', 'কুরিয়ার ম্যানেজমেন্ট', 'Courier', 'courier-management', 21],
            ['Packing Dept', 'প্যাকিং ডিপার্টমেন্ট', 'Warehouse', 'packing-dept', 22],
            ['Stock In/Out', 'স্টক ইন/আউট', 'Warehouse', 'stock-in-out', 23],
            ['Work Log', 'ওয়ার্ক লগ', 'Sales', 'work-log', 24],
            ['Courier', 'কুরিয়ার', 'Courier', 'courier', 25],
            ['Content', 'কন্টেন্ট', 'Marketing', 'content', 26],
            ['Tasks', 'টাস্ক', 'All Department', 'tasks', 27],
            ['Requisitions', 'রিকুইজিশন', 'All Department', 'requisitions', 28],
            ['Memories', 'স্মৃতি', 'All Department', 'memories', 29],
        ]
        for (const [name, name_bn, category, slug, sort_order] of features) {
            await client.query(
                `INSERT INTO features (name, name_bn, category, slug, sort_order)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (slug) DO NOTHING`,
                [name, name_bn, category, slug, sort_order]
            )
        }

        // point_categories.name has no unique constraint — guard with NOT EXISTS like departments.
        const pointCategories = [
            ['Time Management', 'টাইম ম্যানেজমেন্ট পয়েন্ট', 10, 1],
            ['Problem Solving', 'প্রবলেম সলভ', 10, 2],
            ['Content/Planning/Marketing/PR', 'কন্টেন্ট, প্লানিং, মার্কেটিং, PR', 10, 3],
            ['Discipline', 'ডিসিপ্লিন পয়েন্ট', 10, 4],
            ['Team & Leader Management', 'টিম ও লিডার ম্যানেজমেন্ট', 10, 5],
            ['Retargeting Orders', 'রিটার্গেটিং অর্ডার', 10, 6],
            ['Incomplete Orders', 'ইনকমপ্লিট অর্ডার', 10, 7],
            ['Office Management & Monitoring', 'অফিস ম্যানেজমেন্ট ও মনিটরিং', 10, 8],
            ['Warehouse & Product Checking', 'ওয়্যারহাউস ও প্রোডাক্ট চেকিং', 10, 9],
        ]
        for (const [name, name_bn, max_points, sort_order] of pointCategories) {
            await client.query(
                `INSERT INTO point_categories (name, name_bn, max_points, sort_order)
                 SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM point_categories WHERE name = $1)`,
                [name, name_bn, max_points, sort_order]
            )
        }

        // source_options has a unique constraint on slug (and name).
        const sourceOptions = [
            ['Facebook', 'facebook', 1],
            ['WhatsApp', 'whatsapp', 2],
            ['Website', 'website', 3],
            ['Instagram', 'instagram', 4],
            ['TikTok', 'tiktok', 5],
            ['Direct', 'direct', 6],
            ['Other', 'other', 7],
        ]
        for (const [name, slug, sort_order] of sourceOptions) {
            await client.query(
                `INSERT INTO source_options (name, slug, sort_order) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING`,
                [name, slug, sort_order]
            )
        }

        // app_settings is a singleton row — only seed it if the table is completely empty.
        await client.query(`
            INSERT INTO app_settings (whatsapp_enabled, auto_assign_problems, smart_notifications, quick_entry_default)
            SELECT false, true, true, false WHERE NOT EXISTS (SELECT 1 FROM app_settings)
        `)

        console.log('Seeded roles, departments, features, point categories, source options, and app_settings.')
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
