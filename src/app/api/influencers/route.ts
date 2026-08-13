import { requireAuth, isAuthed } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

type PrEntryRow = { id: string; delivery_status: string | null; video_status: string | null; payment_status: string | null; source: string | null; created_at: string; send_date: string | null }

function computeStats(prs: PrEntryRow[]) {
    const total_prs = prs.length
    const total_videos = prs.filter(p => p.video_status === 'Video Uploaded').length
    const pending_products = prs.filter(p => p.delivery_status !== 'Product Received' && p.delivery_status !== 'Returned').length
    const unpaid_count = prs.filter(p => p.payment_status === 'Unpaid').length
    const conversion_rate = total_prs > 0 ? Math.round((total_videos / total_prs) * 100) : 0
    const uploadedPlatforms = Array.from(new Set(prs.filter(p => p.video_status === 'Video Uploaded' && p.source).map(p => p.source as string)))
    const lastActivity = prs.reduce<string | null>((latest, p) => {
        if (!latest || (p.created_at && p.created_at > latest)) return p.created_at
        return latest
    }, null)
    // Most recent PR by send_date (falls back to created_at if send_date is somehow
    // missing) — this is computed from whatever subset of `prs` was passed in, so it's
    // automatically scoped to the active date filter in list mode.
    const latestPr = [...prs].sort((a, b) => {
        const ad = a.send_date || a.created_at || ''
        const bd = b.send_date || b.created_at || ''
        return bd.localeCompare(ad)
    })[0] || null
    return {
        total_prs, total_videos, pending_products, unpaid_count, conversion_rate, uploadedPlatforms, lastActivity,
        lastPrDate: latestPr?.send_date || null,
        latestVideoStatus: latestPr?.video_status || null,
    }
}

// GET /api/influencers            -> list mode (search/status/platform/payment/rating/sort filters)
// GET /api/influencers?id=<uuid>  -> single influencer with PR history, stats, and activity timeline
export async function GET(request: Request) {
    const auth = await requireAuth(0) // any authenticated employee can view
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
        const { data: influencer, error } = await supabase
            .from('influencers')
            .select(`*, pr_entries:pr_management(id, customer_name, customer_phone, send_date, address, parcel_details, source, delivery_status, video_status, payment_status, total_amount, advance_amount, due_amount, payment_method, transaction_id, video_link, video_links, view_note, created_at)`)
            .eq('id', id)
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const prs = (influencer.pr_entries || []) as PrEntryRow[]
        const stats = computeStats(prs)

        const { data: auditRows } = await supabase
            .from('audit_log')
            .select('id, action, details, created_at, actor:employees!audit_log_actor_id_fkey(name)')
            .eq('module', 'influencers')
            .eq('target_id', id)
            .order('created_at', { ascending: false })
            .limit(50)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activity = (auditRows || []).map((a: any) => ({
            type: 'audit',
            id: a.id,
            label: a.action,
            actor: a.actor?.name || null,
            details: a.details,
            at: a.created_at,
        }))

        return NextResponse.json({ data: { ...influencer, stats, activity } })
    }

    const search = searchParams.get('search')?.trim().toLowerCase() || ''
    const payment = searchParams.get('payment') || 'all'
    const sort = searchParams.get('sort') || 'recent'
    // Date filter (Today/Weekly/Monthly/Custom from the UI, or omitted for "All"). Drives:
    // which PRs count toward each influencer's total_prs/total_videos/pending_products
    // (and thus the "Total PR Sent"/"Videos Uploaded"/"Pending Products" summary cards),
    // the new "last PR date"/"latest video status" card fields, and which influencers
    // even show up (must have >=1 PR whose send_date falls in range).
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const hasDateFilter = !!(startDate && endDate)

    const { data: rows, error } = await supabase
        .from('influencers')
        .select(`*, pr_entries:pr_management(id, delivery_status, video_status, payment_status, source, send_date, created_at)`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let list = (rows || []).map((r: any) => {
        const allPrs = (r.pr_entries || []) as PrEntryRow[]
        const scopedPrs = hasDateFilter
            ? allPrs.filter(p => {
                const d = p.send_date || p.created_at?.slice(0, 10)
                return !!d && d >= startDate! && d <= endDate!
            })
            : allPrs
        const stats = computeStats(scopedPrs)
        return { ...r, pr_entries: undefined, stats }
    })

    // Lifetime totals (Total/Active/Paid/Unpaid Influencers) are computed from the full,
    // unfiltered `rows` further down — never from date-scoped `list` — per spec: those
    // cards represent lifetime totals and must not move when the date filter changes.

    if (hasDateFilter) {
        list = list.filter(i => i.stats.total_prs > 0)
    }

    if (search) {
        list = list.filter(i => (i.name || '').toLowerCase().includes(search) || (i.phone || '').toLowerCase().includes(search))
    }
    if (payment !== 'all') {
        list = list.filter(i => (i.payment_status || 'Unpaid') === payment)
    }

    list.sort((a, b) => {
        if (sort === 'name') return (a.name || '').localeCompare(b.name || '')
        if (sort === 'rating') return (b.rating || 0) - (a.rating || 0)
        if (sort === 'total_prs') return b.stats.total_prs - a.stats.total_prs
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() // recent
    })

    const summary = {
        total: (rows || []).length,
        active: (rows || []).filter(r => (r.status || 'Active') === 'Active').length,
        totalPrSent: list.reduce((sum, i) => sum + i.stats.total_prs, 0),
        totalVideosUploaded: list.reduce((sum, i) => sum + i.stats.total_videos, 0),
        pendingProducts: list.reduce((sum, i) => sum + i.stats.pending_products, 0),
        paidInfluencers: (rows || []).filter(r => (r.payment_status || 'Unpaid') === 'Paid').length,
        unpaidInfluencers: (rows || []).filter(r => (r.payment_status || 'Unpaid') === 'Unpaid').length,
        averageRating: (rows || []).length > 0
            ? Math.round(((rows || []).reduce((sum, r) => sum + (r.rating || 0), 0) / (rows || []).length) * 10) / 10
            : 0,
    }

    return NextResponse.json({ data: list, summary })
}

// POST /api/influencers - manually add a new influencer profile (Admin+)
export async function POST(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const payload = await request.json()
    if (!payload.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { data, error } = await auth.supabase
        .from('influencers')
        .insert({
            name: payload.name.trim(),
            phone: payload.phone || null,
            page_url: payload.page_url || null,
            instagram_url: payload.instagram_url || null,
            tiktok_url: payload.tiktok_url || null,
            youtube_url: payload.youtube_url || null,
            address: payload.address || null,
            photo_url: payload.photo_url || null,
            contact_source: payload.contact_source || null,
            contact_value: payload.contact_value || null,
            follower_count: Number(payload.follower_count) || 0,
            status: payload.status || 'Active',
            payment_status: payload.payment_status || 'Unpaid',
            notes: payload.notes || null,
            uploaded_platforms: Array.isArray(payload.uploaded_platforms) ? payload.uploaded_platforms : [],
        })
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(auth.employee.id, `Added influencer profile "${data.name}"`, 'influencers', data.id)

    return NextResponse.json({ data }, { status: 201 })
}

// PUT /api/influencers - update a profile, including the 5-criteria rating (Admin+).
// When any rating_* field is present, the overall `rating` is auto-averaged from all
// five criteria server-side rather than trusting a client-computed value.
export async function PUT(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const payload = await request.json()
    const { id, ...updates } = payload
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const ratingFields = ['rating_responsiveness', 'rating_quality', 'rating_professionalism', 'rating_engagement', 'rating_reliability']
    const isRatingUpdate = ratingFields.some(f => f in updates)

    if (isRatingUpdate) {
        const { data: existing } = await auth.supabase.from('influencers').select(ratingFields.join(',')).eq('id', id).single()
        const existingRow = (existing || {}) as Record<string, number>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const merged: any = { ...existingRow, ...updates }
        const values = ratingFields.map(f => Number(merged[f])).filter(v => !isNaN(v) && v > 0)
        updates.rating = values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0
    }

    const { data, error } = await auth.supabase
        .from('influencers')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (isRatingUpdate) {
        await logAudit(auth.employee.id, `Rated influencer "${data.name}" (${updates.rating}/5 overall)`, 'influencers', id, {
            responsiveness: data.rating_responsiveness, quality: data.rating_quality,
            professionalism: data.rating_professionalism, engagement: data.rating_engagement, reliability: data.rating_reliability,
        })
    } else if ('status' in updates) {
        await logAudit(auth.employee.id, `Set "${data.name}" status to ${updates.status}`, 'influencers', id)
    } else if ('notes' in updates) {
        await logAudit(auth.employee.id, `Updated admin notes for "${data.name}"`, 'influencers', id)
    } else {
        await logAudit(auth.employee.id, `Updated profile for "${data.name}"`, 'influencers', id)
    }

    return NextResponse.json({ data })
}

// DELETE /api/influencers?id=<uuid> - remove a profile (Admin+). Linked PR entries keep
// their history but influencer_id is cleared (ON DELETE SET NULL).
export async function DELETE(request: Request) {
    const auth = await requireAuth(3) // Admin+
    if (!isAuthed(auth)) return auth

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const { data: existing } = await auth.supabase.from('influencers').select('name').eq('id', id).single()

    const { error } = await auth.supabase.from('influencers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(auth.employee.id, `Deleted influencer profile "${existing?.name || id}"`, 'influencers', id)

    return NextResponse.json({ success: true })
}
