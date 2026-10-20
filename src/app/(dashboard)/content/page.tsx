'use client'

import RequireFeature from '@/components/common/RequireFeature'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { usePermissions } from '@/lib/PermissionsContext'
import { getLocalDateString, getMonthRangeFromString } from '@/lib/dateRange'
import {
    STAGE_INFO, STAGE_ORDER, KIND_INFO, CONTENT_ROLES, CONTENT_TABS, PLATFORMS,
    phaseOf, isActivePhase, isItemLate, isSlotLate, firstDateOf, nextStageOf, buildSlotDates,
    type Stage, type Kind, type Platform,
} from '@/lib/contentCalendar'
import {
    IconPlus, IconX, IconChevronLeft, IconChevronRight, IconCamera,
    IconCalendar, IconLayers, IconUsers, IconWrench, IconClipboard, IconFacebook,
    IconInstagram, IconTikTok, IconYouTube, IconGlobe, IconTarget, IconLightbulb, IconClock, IconTrendingUp, IconBarChart3, IconPackage, IconSearch,
} from '@/components/icons/Icons'

// ---------- Types ----------
interface Channel { id: string; name: string; platform: Platform; photo_url: string | null; upload_link: string | null; active: boolean; sort_order: number; slot_count?: string }
type ChannelDraft = { name: string; platform: Platform; upload_link: string; photo_url: string }
type TypeDraft = { name: string; kind: Kind; caption_template: string }
interface PostType { id: string; name: string; kind: Kind; caption_template: string | null; sort_order: number; item_count?: string }
interface TeamMember { id: string; name: string; avatar_url: string | null; roles: string[]; active: boolean; allowed_tabs: string[] }
interface Slot { id?: string; channel_id: string; date: string; time: string | null; posted: boolean; hook: string | null; reach: number | null; msgs: number | null; orders: number | null }
interface LogEntry { id: string; stage: string; by: string | null; at: string }
interface CommentEntry { id: string; text: string; done: boolean; by: string | null; by_employee_id: string | null; at: string }
interface Occasion { id: string; name: string; date: string; lead_days: number; target: number | null; notes: string | null; item_count?: string }
type SubmissionStatus = 'pending' | 'idea' | 'returned' | 'scheduled'
interface Submission {
    id: string; title: string; type_text: string | null; caption: string | null
    status: SubmissionStatus; return_note: string | null; scheduled_item_id: string | null
    created_at: string; updated_at: string
    by_employee: { id: string; name: string } | null
    scheduled_item: { id: string; title: string } | null
}
interface Series { id: string; title: string; gap_days: number; days_of_week: number[]; channel_ids: string[]; notes: string | null; type: { id: string; name: string; kind: Kind; caption_template: string | null } }
interface Product { code: string; name: string | null; cat: string | null }
interface ChannelTarget { channel_id: string; posts: number; videos: number; is_month_custom: boolean }
interface MemberTarget { employee_id: string; target: number; is_month_custom: boolean }
interface ContentItem {
    id: string; title: string; product_code: string | null; caption: string | null; notes: string | null
    stage: string; start_date: string; gap_days: number; stage_since: string | null; created_at: string
    type: { id: string; name: string; kind: Kind; caption_template: string | null }
    assignee: { id: string; name: string } | null
    creator: { id: string; name: string } | null
    occasion: { id: string; name: string; date: string } | null
    series_id: string | null
    slots: Slot[]; logs: LogEntry[]; comments: CommentEntry[]
}
type EditingItem = Partial<ContentItem> & { _channelIds?: string[]; _fromSubmission?: string; _time?: string }
// One draft row in the "এই দিনের সব একসাথে" bulk-add sheet — channelGroup mirrors the single-item
// modal's preset picker ('__all__', 'platform:<p>', or a single channel id).
type BulkRow = { key: string; typeId: string; date: string; time: string; channelGroup: string; title: string; caption: string }

const UPLOAD_LINK: Record<Platform, string> = {
    facebook: 'https://business.facebook.com/latest/composer', instagram: 'https://business.facebook.com/latest/composer',
    tiktok: 'https://www.tiktok.com/tiktokstudio/upload', youtube: 'https://www.youtube.com/upload',
}
const UPLOAD_NAME: Record<Platform, string> = { facebook: 'Meta Business Suite', instagram: 'Meta Business Suite', tiktok: 'TikTok Studio', youtube: 'YouTube Studio' }
const PLATFORM_ICON: Record<Platform, React.ComponentType<{ size?: number; color?: string }>> = { facebook: IconFacebook, instagram: IconInstagram, tiktok: IconTikTok, youtube: IconYouTube }
const PLATFORM_COLOR: Record<Platform, string> = { facebook: '#2563EB', instagram: '#C13584', tiktok: '#111827', youtube: '#DC2626' }
const PLATFORM_LABEL: Record<Platform, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' }

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item_ = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#7C3AED', '#9333EA']
    return colors[(name || 'U').charCodeAt(0) % colors.length]
}
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার']
const BN_DSHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি']
const BN_MSHORT = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে']
const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
function bn(n: number | string) { return String(n).replace(/\d/g, d => BN_DIGITS[Number(d)]) }
// Applied to standalone numeric displays (stat tiles, count badges, table number columns) so
// Bengali digits line up evenly — scoped to this page only, never touches shared global classes.
const monoNum: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace", fontVariantNumeric: 'tabular-nums' }
function shortDateBn(ds: string) { const dt = new Date(ds); return `${bn(dt.getDate())} ${BN_MONTHS[dt.getMonth()]}` }
function addDaysStr(ds: string, days: number) { const [y, m, d] = ds.split('-').map(Number); const dt = new Date(y, m - 1, d + days); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
function daysBetween(a: string, b: string) { const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number); return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000) }

// 4th Friday of November, for a given year — the one annual occasion below with a date that
// moves (by weekday, not by moon) rather than falling on a fixed day of the month.
function fourthFridayOfNovember(year: number): string {
    const dow = new Date(year, 10, 1).getDay() // 0=Sun..6=Sat
    const firstFriday = 1 + ((5 - dow + 7) % 7)
    return `${year}-11-${String(firstFriday + 21).padStart(2, '0')}`
}

// Fixed-date annual occasions (Gregorian calendar, Bangladesh-focused) — Eid, Puja and other
// lunar-calendar festivals move every year by moon sighting, so they're deliberately left out;
// add those by hand once the date is confirmed.
const ANNUAL_OCCASION_TEMPLATE: { name: string; month: number; day: number; leadDays: number; notes?: string }[] = [
    { name: 'নববর্ষ', month: 1, day: 1, leadDays: 7 },
    { name: 'ভালোবাসা দিবস', month: 2, day: 14, leadDays: 10 },
    { name: 'আন্তর্জাতিক মাতৃভাষা দিবস', month: 2, day: 21, leadDays: 5 },
    { name: 'স্বাধীনতা দিবস', month: 3, day: 26, leadDays: 10 },
    { name: 'পহেলা বৈশাখ', month: 4, day: 14, leadDays: 14 },
    { name: 'মে দিবস', month: 5, day: 1, leadDays: 5 },
    { name: '১১.১১ সেল', month: 11, day: 11, leadDays: 7, notes: 'অনলাইন শপিং সেল দিন' },
    { name: 'ব্ল্যাক ফ্রাইডে', month: 11, day: 29, leadDays: 10, notes: 'নভেম্বরের ৪র্থ শুক্রবার — তারিখ বছরভেদে বদলায়' },
    { name: '১২.১২ সেল', month: 12, day: 12, leadDays: 10, notes: 'বছর শেষের সেল' },
    { name: 'বিজয় দিবস', month: 12, day: 16, leadDays: 9 },
    { name: 'বড়দিন', month: 12, day: 25, leadDays: 12 },
    { name: 'থার্টি ফার্স্ট', month: 12, day: 31, leadDays: 5 },
]
function annualOccasionsFor(year: number) {
    return ANNUAL_OCCASION_TEMPLATE.map(o => ({
        name: o.name,
        date: o.name === 'ব্ল্যাক ফ্রাইডে' ? fourthFridayOfNovember(year) : `${year}-${String(o.month).padStart(2, '0')}-${String(o.day).padStart(2, '0')}`,
        lead_days: o.leadDays,
        notes: o.notes || '',
    }))
}
// Which year "বার্ষিক ক্যালেন্ডার থেকে যোগ করুন" would add next — this year, unless every fixed
// occasion is already saved for it, in which case next year. Shared by the button's label and
// the click handler so they can never disagree about which year is about to be added.
function nextAnnualSeedYear(occasions: Occasion[], todayStr: string): number {
    let year = Number(todayStr.slice(0, 4))
    while (ANNUAL_OCCASION_TEMPLATE.every(o => occasions.some(x => x.name === o.name && x.date.slice(0, 4) === String(year)))) {
        year++
    }
    return year
}
function yearRangeLabel(year: number): string { return `${BN_MONTHS[0]} ${bn(year)} - ${BN_MONTHS[11]} ${bn(year)}` }
function formatDate(d: string) { const dt = new Date(d); return `${bn(dt.getDate())} ${BN_MONTHS[dt.getMonth()]}, ${bn(dt.getFullYear())}` }
function formatMonthLabel(month: string) { const [y, m] = month.split('-').map(Number); return `${BN_MONTHS[m - 1]} ${y}` }
function currentMonthString() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function stepMonth(month: string, delta: number) { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function avatar(name: string, url: string | null, size = 24) {
    return url
        ? <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : <span style={{ width: size, height: size, borderRadius: '50%', background: getAvatarColor(name || 'U'), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 700, flexShrink: 0 }}>{(name || 'U')[0]?.toUpperCase()}</span>
}
// A channel's icon wherever it's shown read-only (day lists, board cards, pickers, tables):
// the uploaded photo if there is one, with the platform icon as a small badge in the bottom-right
// corner; falls back to the plain platform-colored icon circle when no photo is set. Clicking a
// photo opens a full-size zoom overlay, same as the editable avatar in Settings.
function ChannelIcon({ channel, size }: { channel: Channel; size: number }) {
    const Icon = PLATFORM_ICON[channel.platform]
    const [zoomed, setZoomed] = useState(false)
    if (!channel.photo_url) {
        return (
            <span style={{ width: size, height: size, borderRadius: '50%', background: PLATFORM_COLOR[channel.platform], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={Math.round(size * 0.6)} />
            </span>
        )
    }
    const badge = Math.max(10, Math.round(size * 0.55))
    return (
        <>
            <span style={{ position: 'relative', width: size, height: size, display: 'inline-flex', flexShrink: 0 }}>
                <img src={channel.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={e => { e.stopPropagation(); setZoomed(true) }} />
                <span style={{ position: 'absolute', bottom: -2, right: -2, width: badge, height: badge, borderRadius: '50%', background: PLATFORM_COLOR[channel.platform], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--color-surface)' }}>
                    <Icon size={Math.round(badge * 0.55)} />
                </span>
            </span>
            <AnimatePresence>
                {zoomed && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ cursor: 'zoom-out' }} onClick={() => setZoomed(false)}>
                        <motion.img src={channel.photo_url} alt="" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
// A channel's platform-icon avatar with a small camera badge that opens a file picker and
// hands the chosen file to onUpload — used in Settings for both saved channels and the draft row.
// Clicking the photo itself (when there is one) opens a full-size zoom overlay instead of
// re-triggering the upload picker, so the camera badge is the only way to change it.
function ChannelAvatar({ photoUrl, platform, onUpload, size = 60 }: { photoUrl: string | null | undefined; platform: Platform; onUpload: (file: File) => void; size?: number }) {
    const Icon = PLATFORM_ICON[platform]
    const [zoomed, setZoomed] = useState(false)
    return (
        <>
            <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: PLATFORM_COLOR[platform], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {photoUrl
                    ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setZoomed(true)} />
                    : <Icon size={size * 0.45} />}
                <label style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', cursor: 'pointer' }} title="ছবি আপলোড করুন">
                    <IconCamera size={12} />
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
                </label>
            </div>
            <AnimatePresence>
                {zoomed && photoUrl && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ cursor: 'zoom-out' }} onClick={() => setZoomed(false)}>
                        <motion.img src={photoUrl} alt="" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
// A post type's collapsible caption-template field — starts open if a template is already set,
// saves on blur, and shows how many posts have used this type so far.
function TypeCaptionRow({ t, onSave }: { t: PostType; onSave: (v: string) => void }) {
    const [open, setOpen] = useState(!!t.caption_template)
    return (
        <div style={{ marginTop: 6 }}>
            <button type="button" onClick={() => setOpen(o => !o)} className="hint"
                style={{ fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                ক্যাপশনের ছাঁচ (ঐচ্ছিক){Number(t.item_count) > 0 ? ` · ${bn(Number(t.item_count))}টা পোস্টে ব্যবহার হয়েছে` : ''}
            </button>
            {open && (
                <textarea className="form-input" style={{ marginTop: 6, width: '100%' }} rows={2} defaultValue={t.caption_template || ''} key={t.id + (t.caption_template || '')}
                    onBlur={e => { const v = e.target.value; if (v !== (t.caption_template || '')) onSave(v) }} />
            )}
        </div>
    )
}
function stagePillStyle(phase: string): { bg: string; color: string } {
    if (phase === 'done') return { bg: 'rgba(22,163,74,0.1)', color: '#16A34A' }
    if (phase === 'ready') return { bg: 'rgba(37,99,235,0.1)', color: '#2563EB' }
    if (phase === 'review') return { bg: 'rgba(176,23,90,0.1)', color: '#B0175A' }
    return { bg: 'rgba(161,92,0,0.1)', color: '#A15C00' }
}
function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
    return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600, background: bg, color }}>{label}</span>
}

export default function ContentCalendarPage() {
    const toast = useToast()
    const { data: perms } = usePermissions()
    const isSuperAdmin = !!(perms.is_super || perms.role === 'Owner' || perms.role === 'Super Admin')

    const [view, setView] = useState<'month' | 'board' | 'work' | 'pages' | 'occ' | 'postbank' | 'products' | 'series' | 'target' | 'report' | 'settings'>('month')
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<ContentItem[]>([])
    const [channels, setChannels] = useState<Channel[]>([])
    const [types, setTypes] = useState<PostType[]>([])
    const [team, setTeam] = useState<TeamMember[]>([])
    const [occasions, setOccasions] = useState<Occasion[]>([])
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [series, setSeries] = useState<Series[]>([])
    const [products, setProducts] = useState<Product[]>([])

    const [month, setMonth] = useState(currentMonthString())
    const [selectedDate, setSelectedDate] = useState(getLocalDateString())
    const [workStage, setWorkStage] = useState('')
    const [workPerson, setWorkPerson] = useState('')
    const [pageChannel, setPageChannel] = useState('')
    const [showPastOcc, setShowPastOcc] = useState(false)
    const [showProductEdit, setShowProductEdit] = useState(false)
    const [productQuery, setProductQuery] = useState('')
    const [productFilter, setProductFilter] = useState<'stale' | 'never' | 'all' | 'top'>('stale')
    const [submissionEdit, setSubmissionEdit] = useState<Partial<Submission> & { _byId?: string } | null>(null)
    const [seriesEdit, setSeriesEdit] = useState<Partial<Series> | null>(null)
    const [channelTargets, setChannelTargets] = useState<ChannelTarget[]>([])
    const [memberTargets, setMemberTargets] = useState<MemberTarget[]>([])
    const [targetsCustom, setTargetsCustom] = useState(false)
    const [targetScope, setTargetScope] = useState<'default' | 'month'>('default')
    const [targetDraft, setTargetDraft] = useState<{ channels: Record<string, { posts: string; videos: string }>; members: Record<string, string> }>({ channels: {}, members: {} })

    const [editing, setEditing] = useState<EditingItem | null>(null)
    const [bulkAddDate, setBulkAddDate] = useState<string | null>(null)
    const [newChannelDraft, setNewChannelDraft] = useState<ChannelDraft | null>(null)
    const [newTypeDraft, setNewTypeDraft] = useState<TypeDraft | null>(null)
    const [occEdit, setOccEdit] = useState<{ id?: string; name: string; date: string; lead_days: string; target: string; notes: string } | null>(null)

    useEffect(() => {
        let cancelled = false
        Promise.all([
            fetch('/api/content-calendar/items').then(r => r.json()),
            fetch('/api/content-calendar/channels').then(r => r.json()),
            fetch('/api/content-calendar/types').then(r => r.json()),
            fetch('/api/content-calendar/team').then(r => r.json()),
            fetch('/api/content-calendar/occasions').then(r => r.json()),
            fetch('/api/content-calendar/post-bank').then(r => r.json()),
            fetch('/api/content-calendar/series').then(r => r.json()),
            fetch('/api/content-calendar/products').then(r => r.json()),
        ]).then(([i, c, t, m, o, id, sr, p]) => {
            if (cancelled) return
            setItems(i.items || []); setChannels(c.channels || []); setTypes(t.types || []); setTeam(m.team || []); setOccasions(o.occasions || []); setSubmissions(id.submissions || []); setSeries(sr.series || []); setProducts(p.products || [])
        }).catch(() => { if (!cancelled) toast.error('কন্টেন্ট ক্যালেন্ডার লোড করা যায়নি।') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Targets are month-specific, so they're fetched separately whenever the displayed month
    // changes, rather than once up front with everything else.
    useEffect(() => {
        let cancelled = false
        fetch(`/api/content-calendar/targets?month=${month}`).then(r => r.json()).then(d => {
            if (cancelled) return
            const ch: ChannelTarget[] = d.channels || []
            const mem: MemberTarget[] = d.members || []
            setChannelTargets(ch); setMemberTargets(mem); setTargetsCustom(!!d.is_month_custom)
            setTargetScope(d.is_month_custom ? 'month' : 'default')
            const chDraft: Record<string, { posts: string; videos: string }> = {}
            ch.forEach(c => { chDraft[c.channel_id] = { posts: String(c.posts), videos: String(c.videos) } })
            const memDraft: Record<string, string> = {}
            mem.forEach(m => { memDraft[m.employee_id] = m.target ? String(m.target) : '' })
            setTargetDraft({ channels: chDraft, members: memDraft })
        }).catch(() => {})
        return () => { cancelled = true }
    }, [month])

    async function saveTargets() {
        const payloadChannels = activeChannels.map(c => ({ channel_id: c.id, posts: Number(targetDraft.channels[c.id]?.posts) || 0, videos: Number(targetDraft.channels[c.id]?.videos) || 0 }))
        const payloadMembers = team.map(m => ({ employee_id: m.id, target: Number(targetDraft.members[m.id]) || 0 }))
        const res = await fetch('/api/content-calendar/targets', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope: targetScope, month, channels: payloadChannels, members: payloadMembers }),
        })
        if (res.ok) {
            toast.success('টার্গেট সেভ হয়েছে')
            const d = await (await fetch(`/api/content-calendar/targets?month=${month}`)).json()
            setChannelTargets(d.channels || []); setMemberTargets(d.members || []); setTargetsCustom(!!d.is_month_custom)
        } else toast.error((await res.json()).error || 'টার্গেট সেভ করা যায়নি')
    }

    const channelById = (id: string) => channels.find(c => c.id === id) || { id, name: '(মুছে ফেলা চ্যানেল)', platform: 'facebook' as Platform, photo_url: null, upload_link: null, active: false, sort_order: 0 }
    const activeChannels = channels.filter(c => c.active)
    const activeTeam = team.filter(m => m.active)
    const [monthStart, monthEnd] = (() => { const r = getMonthRangeFromString(month); return [r.start, r.end] })()
    const todayStr = getLocalDateString()

    function slotsInRange(a: string, b: string) {
        const out: { item: ContentItem; slot: Slot }[] = []
        for (const i of items) for (const s of i.slots) if (s.date >= a && s.date <= b) out.push({ item: i, slot: s })
        return out
    }

    // ---------- Save / mutate helpers ----------
    async function saveItemPut(id: string, payload: Record<string, unknown>) {
        const res = await fetch(`/api/content-calendar/items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (res.ok) {
            const updated = await res.json()
            setItems(prev => prev.map(x => x.id === id ? updated : x))
            return updated
        } else {
            toast.error((await res.json()).error || 'Failed to save')
            return null
        }
    }

    async function togglePosted(it: ContentItem, slot: Slot) {
        const slots = it.slots.map(s => s === slot ? { ...s, posted: !s.posted } : s)
        await saveItemPut(it.id, { slots })
        toast.success(slot.posted ? 'পোস্টেড চিহ্ন তুলে নেওয়া হয়েছে' : `${channelById(slot.channel_id).name}-এ পোস্টেড করা হয়েছে`)
    }

    async function advanceStage(it: ContentItem) {
        const next = nextStageOf(it.type.kind, it.stage)
        if (!next) return
        const updated = await saveItemPut(it.id, { stage: next })
        if (updated) toast.success(`${STAGE_INFO[it.stage as Stage]?.label} শেষ — এখন ${STAGE_INFO[next].label}${updated.assignee ? ` · ${updated.assignee.name}` : ''}`)
    }

    async function deleteItem(it: ContentItem) {
        if (!confirm(`"${it.title}" মুছে ফেলবেন? এটি ফেরানো যাবে না।`)) return
        const res = await fetch(`/api/content-calendar/items/${it.id}`, { method: 'DELETE' })
        if (res.ok) { setItems(prev => prev.filter(x => x.id !== it.id)); setEditing(null); toast.success('মুছে ফেলা হয়েছে') }
        else toast.error((await res.json()).error || 'মুছে ফেলা যায়নি')
    }

    function openAdd(date?: string, occasion?: Occasion) {
        const defaultType = types[0]
        setEditing({
            title: '', product_code: '', caption: defaultType?.caption_template || '', notes: '',
            stage: defaultType ? KIND_INFO[defaultType.kind].stages[0] : 'idea',
            start_date: date || (view === 'month' ? selectedDate : todayStr), gap_days: 3,
            type: defaultType ? { id: defaultType.id, name: defaultType.name, kind: defaultType.kind, caption_template: defaultType.caption_template } : undefined,
            assignee: null, slots: [], comments: [], logs: [],
            occasion: occasion ? { id: occasion.id, name: occasion.name, date: occasion.date } : null,
            _channelIds: activeChannels.filter(c => c.platform === 'facebook').map(c => c.id),
        })
    }
    function openAddForOccasion(o: Occasion) {
        const prepStart = addDaysStr(o.date, -o.lead_days)
        openAdd(prepStart > todayStr ? prepStart : todayStr, o)
    }
    function openEdit(it: ContentItem) {
        setEditing({ ...it, _channelIds: it.slots.map(s => s.channel_id) })
    }
    function openDuplicate(it: ContentItem) {
        setEditing({
            title: it.title + ' (আবার)', product_code: it.product_code, caption: it.caption, notes: it.notes,
            stage: KIND_INFO[it.type.kind].stages[0], start_date: todayStr, gap_days: it.gap_days, occasion: it.occasion,
            type: it.type, assignee: null, slots: [], comments: [], logs: [],
            _channelIds: it.slots.map(s => s.channel_id),
        })
        toast.success('কপি হয়েছে — তারিখ/চ্যানেল বদলে নতুন পোস্ট হিসেবে সেভ করুন')
    }

    async function saveEditing() {
        const e = editing
        if (!e) return
        if (!e.title?.trim()) { toast.error('শিরোনাম লিখুন'); return }
        const channelIds = e._channelIds || []
        if (!channelIds.length) { toast.error('অন্তত একটা চ্যানেল বেছে নিন'); return }

        if (!e.id) {
            const res = await fetch('/api/content-calendar/items', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: e.title.trim(), type_id: e.type?.id, product_code: e.product_code || null,
                    caption: e.caption || null, notes: e.notes || null, start_date: e.start_date,
                    gap_days: e.gap_days ?? 3, channel_ids: channelIds, occasion_id: e.occasion?.id || null,
                    time: e._time || null, stage: e.stage || null, assignee_id: e.assignee?.id || null,
                    // The modal's per-row preview may have been hand-adjusted — send it as-is so
                    // those edits land instead of being silently recomputed from scratch.
                    slots: (e.slots || []).map(s => ({ channel_id: s.channel_id, date: s.date, time: s.time || null })),
                }),
            })
            if (res.ok) {
                const created = await res.json()
                setItems(prev => [created, ...prev]); setEditing(null)
                if (e._fromSubmission) {
                    const res2 = await fetch('/api/content-calendar/post-bank', {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: e._fromSubmission, status: 'scheduled', scheduled_item_id: created.id }),
                    })
                    if (res2.ok) { const row = await res2.json(); setSubmissions(prev => prev.map(x => x.id === row.id ? row : x)) }
                    toast.success('শিডিউল হয়েছে')
                } else toast.success('কন্টেন্ট যোগ হয়েছে')
            } else toast.error((await res.json()).error || 'কন্টেন্ট যোগ করা যায়নি')
            return
        }

        // Existing item: rebuild slots only if the channel selection actually changed (otherwise
        // keep posted slots exactly as they are — rebuilding would wipe their reach/msgs/orders).
        const currentChannelIds = (e.slots || []).map(s => s.channel_id)
        const channelsChanged = channelIds.length !== currentChannelIds.length || channelIds.some(id => !currentChannelIds.includes(id))
        const payload: Record<string, unknown> = {
            title: e.title.trim(), product_code: e.product_code || null, caption: e.caption || null, notes: e.notes || null,
            start_date: e.start_date, gap_days: e.gap_days ?? 3, stage: e.stage, assignee_id: e.assignee?.id ?? null,
            occasion_id: e.occasion?.id || null,
        }
        if (channelsChanged) {
            // Rebuild locally using the same rotation the server uses for new items, by asking
            // the server: simplest is to just send the new channel set as a flat same-day list
            // if nothing was posted yet, otherwise keep existing + append new ones at the start date.
            const kept = (e.slots || []).filter(s => channelIds.includes(s.channel_id))
            const added = channelIds.filter(id => !currentChannelIds.includes(id)).map(id => ({ channel_id: id, date: e.start_date, time: e._time || null, posted: false, hook: null, reach: null, msgs: null, orders: null }))
            payload.slots = [...kept, ...added]
        } else {
            payload.slots = e.slots
        }
        const updated = await saveItemPut(e.id, payload)
        if (updated) { setEditing(null); toast.success('সেভ হয়েছে') }
    }

    // Creates one item per filled-in row (blank titles are silently skipped) — each posts to
    // every channel in its group on its own date with gap_days 0, so a group never staggers
    // across days the way the single-item form's rotation does; this is "all at once, one day".
    async function saveBulkPosts(rows: BulkRow[]) {
        const valid = rows.filter(r => r.title.trim())
        if (!valid.length) { toast.error('অন্তত একটা শিরোনাম লিখুন'); return }
        const created: ContentItem[] = []
        for (const r of valid) {
            const channelIds = r.channelGroup === '__all__' ? activeChannels.map(c => c.id)
                : r.channelGroup.startsWith('platform:') ? activeChannels.filter(c => c.platform === r.channelGroup.slice(9)).map(c => c.id)
                : r.channelGroup ? [r.channelGroup] : []
            if (!channelIds.length) continue
            const res = await fetch('/api/content-calendar/items', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: r.title.trim(), type_id: r.typeId, caption: r.caption || null,
                    start_date: r.date, gap_days: 0, channel_ids: channelIds, time: r.time || null,
                }),
            })
            if (res.ok) created.push(await res.json())
        }
        if (created.length) {
            setItems(prev => [...created, ...prev])
            toast.success(`${bn(created.length)}টা পোস্ট যোগ হয়েছে`)
            setBulkAddDate(null)
        } else toast.error('কোনো পোস্ট যোগ করা যায়নি')
    }

    async function addComment(text: string, byId: string) {
        if (!editing?.id || !text.trim()) return
        const updated = await saveItemPut(editing.id, { new_comment: { employee_id: byId, text } })
        if (updated) setEditing({ ...updated, _channelIds: updated.slots.map((s: Slot) => s.channel_id) })
    }
    async function toggleComment(commentId: string) {
        if (!editing?.id) return
        const updated = await saveItemPut(editing.id, { toggle_comment_id: commentId })
        if (updated) setEditing({ ...updated, _channelIds: updated.slots.map((s: Slot) => s.channel_id) })
    }

    function copyCaption(it: ContentItem, slot: Slot) {
        const text = [slot.hook, it.caption].filter(Boolean).join('\n\n')
        if (!text) { toast.error('এখনো ক্যাপশন লেখা হয়নি'); return }
        navigator.clipboard?.writeText(text).then(() => toast.success('ক্যাপশন কপি হয়েছে')).catch(() => toast.error('কপি করা যায়নি'))
    }

    // ---------- Settings: channels/types/team mutations ----------
    async function saveNewChannel() {
        if (!newChannelDraft || !newChannelDraft.name.trim()) { toast.error('চ্যানেলের নাম দিন'); return }
        const res = await fetch('/api/content-calendar/channels', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newChannelDraft.name.trim(), platform: newChannelDraft.platform, upload_link: newChannelDraft.upload_link.trim(), photo_url: newChannelDraft.photo_url }),
        })
        if (res.ok) {
            const row = await res.json()
            setChannels(prev => [...prev, row])
            setNewChannelDraft(null)
            toast.success('চ্যানেল যোগ হয়েছে')
        } else toast.error((await res.json()).error || 'চ্যানেল যোগ করা যায়নি')
    }
    async function toggleChannelActive(c: Channel) {
        const res = await fetch('/api/content-calendar/channels', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) })
        if (res.ok) setChannels(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x))
    }
    async function deleteChannel(c: Channel) {
        if (!confirm(`"${c.name}" মুছে ফেলবেন?`)) return
        const res = await fetch(`/api/content-calendar/channels?id=${c.id}`, { method: 'DELETE' })
        if (res.ok) { setChannels(prev => prev.filter(x => x.id !== c.id)); toast.success('চ্যানেল মুছে ফেলা হয়েছে') }
        else toast.error((await res.json()).error || 'মুছে ফেলা যায়নি')
    }
    // Inline-editable name/upload-link/photo fields in Settings — saves on blur (or right after
    // upload, for the photo), reverting the local value if the server rejects it (empty name, or
    // a link that isn't https://).
    async function saveChannelField(c: Channel, field: 'name' | 'upload_link' | 'photo_url', value: string) {
        const res = await fetch('/api/content-calendar/channels', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, [field]: value }) })
        if (res.ok) {
            const row = await res.json()
            setChannels(prev => prev.map(x => x.id === c.id ? { ...x, ...row } : x))
        } else {
            toast.error((await res.json()).error || 'সেভ করা যায়নি')
            setChannels(prev => prev.map(x => x.id === c.id ? { ...x, [field]: c[field] } : x))
        }
    }
    async function reorderChannel(c: Channel, direction: -1 | 1) {
        const group = channels.filter(x => x.platform === c.platform).sort((a, b) => a.sort_order - b.sort_order)
        const idx = group.findIndex(x => x.id === c.id)
        const other = group[idx + direction]
        if (!other) return
        const [aOrder, bOrder] = [c.sort_order, other.sort_order]
        setChannels(prev => prev.map(x => x.id === c.id ? { ...x, sort_order: bOrder } : x.id === other.id ? { ...x, sort_order: aOrder } : x))
        await Promise.all([
            fetch('/api/content-calendar/channels', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, sort_order: bOrder }) }),
            fetch('/api/content-calendar/channels', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: other.id, sort_order: aOrder }) }),
        ])
    }
    // Uploads a channel's profile picture. For an existing channel it saves photo_url right
    // after upload; for the not-yet-created draft row it just updates the local draft, and
    // the URL goes out with the rest of the fields when the draft is saved.
    async function uploadChannelPhoto(c: Channel | null, file: File) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'channels')
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) { toast.error((await res.json()).error || 'ছবি আপলোড করা যায়নি'); return }
        const { url } = await res.json()
        if (c) saveChannelField(c, 'photo_url', url)
        else setNewChannelDraft(prev => prev ? { ...prev, photo_url: url } : prev)
    }
    async function saveNewType() {
        if (!newTypeDraft || !newTypeDraft.name.trim()) { toast.error('ধরনের নাম দিন'); return }
        const res = await fetch('/api/content-calendar/types', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newTypeDraft.name.trim(), kind: newTypeDraft.kind, caption_template: newTypeDraft.caption_template }),
        })
        if (res.ok) {
            const row = await res.json()
            setTypes(prev => [...prev, row])
            setNewTypeDraft(null)
            toast.success('ধরন যোগ হয়েছে')
        } else toast.error((await res.json()).error || 'ধরন যোগ করা যায়নি')
    }
    // Inline-editable name/kind/caption-template fields in Settings — saves on blur/change,
    // reverting the local value if the server rejects it.
    async function saveTypeField(t: PostType, field: 'name' | 'kind' | 'caption_template', value: string) {
        const res = await fetch('/api/content-calendar/types', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, [field]: value }) })
        if (res.ok) {
            const row = await res.json()
            setTypes(prev => prev.map(x => x.id === t.id ? { ...x, ...row } : x))
        } else {
            toast.error((await res.json()).error || 'সেভ করা যায়নি')
            setTypes(prev => prev.map(x => x.id === t.id ? { ...x, [field]: t[field] } : x))
        }
    }
    async function reorderType(t: PostType, direction: -1 | 1) {
        const sorted = [...types].sort((a, b) => a.sort_order - b.sort_order)
        const idx = sorted.findIndex(x => x.id === t.id)
        const other = sorted[idx + direction]
        if (!other) return
        const [aOrder, bOrder] = [t.sort_order, other.sort_order]
        setTypes(prev => prev.map(x => x.id === t.id ? { ...x, sort_order: bOrder } : x.id === other.id ? { ...x, sort_order: aOrder } : x))
        await Promise.all([
            fetch('/api/content-calendar/types', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, sort_order: bOrder }) }),
            fetch('/api/content-calendar/types', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: other.id, sort_order: aOrder }) }),
        ])
    }
    async function deleteType(t: PostType) {
        if (!confirm(`"${t.name}" মুছে ফেলবেন?`)) return
        const res = await fetch(`/api/content-calendar/types?id=${t.id}`, { method: 'DELETE' })
        if (res.ok) { setTypes(prev => prev.filter(x => x.id !== t.id)); toast.success('ধরন মুছে ফেলা হয়েছে') }
        else toast.error((await res.json()).error || 'মুছে ফেলা যায়নি')
    }
    async function toggleTeamActive(m: TeamMember) {
        const active = !m.active
        const res = await fetch('/api/content-calendar/team', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: m.id, active }) })
        if (res.ok) setTeam(prev => prev.map(x => x.id === m.id ? { ...x, active } : x))
    }
    async function toggleTeamTab(m: TeamMember, tab: string) {
        // Empty allowed_tabs means "no restriction, every tab visible" — toggling a single tab
        // off from that state has to first expand it to the explicit full list.
        const current = m.allowed_tabs.length ? m.allowed_tabs : CONTENT_TABS.map(t => t.key)
        const allowed_tabs = current.includes(tab) ? current.filter(t => t !== tab) : [...current, tab]
        const res = await fetch('/api/content-calendar/team', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: m.id, allowed_tabs }) })
        if (res.ok) setTeam(prev => prev.map(x => x.id === m.id ? { ...x, allowed_tabs } : x))
    }
    async function selectAllTeamTabs(m: TeamMember) {
        const allowed_tabs: string[] = []
        const res = await fetch('/api/content-calendar/team', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: m.id, allowed_tabs }) })
        if (res.ok) setTeam(prev => prev.map(x => x.id === m.id ? { ...x, allowed_tabs } : x))
    }

    // ---------- Occasions ----------
    function openNewOccasion() { setOccEdit({ name: '', date: '', lead_days: '14', target: '', notes: '' }) }
    function openEditOccasion(o: Occasion) { setOccEdit({ id: o.id, name: o.name, date: o.date, lead_days: String(o.lead_days), target: o.target != null ? String(o.target) : '', notes: o.notes || '' }) }
    async function saveOccasion() {
        const f = occEdit
        if (!f || !f.name.trim() || !f.date) { toast.error('নাম আর তারিখ দিন'); return }
        const data = { id: f.id, name: f.name.trim(), date: f.date, lead_days: Math.max(0, parseInt(f.lead_days) || 0), target: f.target, notes: f.notes.trim() }
        const res = await fetch('/api/content-calendar/occasions', {
            method: data.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        })
        if (res.ok) {
            const row = await res.json()
            setOccasions(prev => data.id ? prev.map(o => o.id === row.id ? { ...o, ...row } : o) : [...prev, row])
            setOccEdit(null); toast.success('উপলক্ষ সেভ হয়েছে')
        } else toast.error((await res.json()).error || 'উপলক্ষ সেভ করা যায়নি')
    }
    async function deleteOccasion(o: Occasion) {
        if (!confirm(`"${o.name}" মুছে ফেলবেন?`)) return
        const res = await fetch(`/api/content-calendar/occasions?id=${o.id}`, { method: 'DELETE' })
        if (res.ok) { setOccasions(prev => prev.filter(x => x.id !== o.id)); toast.success('উপলক্ষ মুছে ফেলা হয়েছে') }
        else toast.error((await res.json()).error || 'মুছে ফেলা যায়নি')
    }
    // Adds this year's (or next year's, if this year's list is already there) fixed-date
    // occasions — skips any name already saved for that year, so clicking again is harmless.
    // Shows the exact range (e.g. জানুয়ারি ২০২৬ - ডিসেম্বর ২০২৬) before adding, since silently
    // picking this/next year left the user unsure which year was about to be touched.
    async function seedAnnualOccasions() {
        const year = nextAnnualSeedYear(occasions, todayStr)
        const range = yearRangeLabel(year)
        const toAdd = annualOccasionsFor(year).filter(o => !occasions.some(x => x.name === o.name && x.date.slice(0, 4) === String(year)))
        if (!toAdd.length) { toast.success(`${range} - এর সব ফিক্সড উপলক্ষ আগে থেকেই আছে`); return }
        if (!window.confirm(`${range} এর ${bn(toAdd.length)}টা ফিক্সড উপলক্ষ যোগ হবে। এগিয়ে যাবেন?`)) return
        const added: Occasion[] = []
        for (const o of toAdd) {
            const res = await fetch('/api/content-calendar/occasions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o),
            })
            if (res.ok) added.push(await res.json())
        }
        if (added.length) { setOccasions(prev => [...prev, ...added]); toast.success(`${range} - এর ${bn(added.length)}টা উপলক্ষ যোগ হয়েছে`) }
        else toast.error('উপলক্ষ যোগ করা যায়নি')
    }

    // ---------- Post Bank ----------
    // Anyone submits a written post ('pending', ready for review) or a loose idea ('idea').
    // A scheduler either turns it into real content ("schedule") or sends it back with a note
    // ("return"); editing a returned one resubmits it.
    function openNewSubmission() { setSubmissionEdit({ title: '', type_text: '', caption: '', status: 'pending', _byId: '' }) }
    function openEditSubmission(x: Submission) { setSubmissionEdit({ ...x, _byId: x.by_employee?.id || '' }) }
    async function saveSubmission() {
        const f = submissionEdit
        if (!f || !f.title?.trim()) { toast.error('শিরোনাম লিখুন'); return }
        const status = f.id ? (f.status === 'returned' ? 'pending' : f.status) : f.status
        const payload = { id: f.id, title: f.title.trim(), type_text: f.type_text || '', caption: f.caption || '', by_employee_id: f._byId || '', status }
        const res = await fetch('/api/content-calendar/post-bank', {
            method: f.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (res.ok) {
            const row = await res.json()
            setSubmissions(prev => f.id ? prev.map(x => x.id === row.id ? row : x) : [row, ...prev])
            setSubmissionEdit(null); toast.success(f.id && status === 'pending' ? 'আবার জমা দেওয়া হয়েছে' : 'জমা হয়েছে')
        } else toast.error((await res.json()).error || 'জমা দেওয়া যায়নি')
    }
    async function deleteSubmission(x: Submission) {
        if (!confirm(`"${x.title}" বাদ দেবেন?`)) return
        const res = await fetch(`/api/content-calendar/post-bank?id=${x.id}`, { method: 'DELETE' })
        if (res.ok) { setSubmissions(prev => prev.filter(y => y.id !== x.id)); toast.success('বাদ দেওয়া হয়েছে') }
        else toast.error((await res.json()).error || 'বাদ দেওয়া যায়নি')
    }
    async function returnSubmission(x: Submission) {
        const note = prompt(`"${x.title}" কেন ফেরত দিচ্ছেন?`)
        if (note == null) return
        const res = await fetch('/api/content-calendar/post-bank', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x.id, status: 'returned', return_note: note }),
        })
        if (res.ok) { const row = await res.json(); setSubmissions(prev => prev.map(y => y.id === row.id ? row : y)); toast.success('ফেরত দেওয়া হয়েছে') }
        else toast.error((await res.json()).error || 'ফেরত দেওয়া যায়নি')
    }
    function scheduleSubmission(x: Submission) {
        const defaultType = types[0]
        setEditing({
            title: x.title, product_code: '', caption: x.caption || defaultType?.caption_template || '', notes: '',
            stage: defaultType ? KIND_INFO[defaultType.kind].stages[0] : 'idea',
            start_date: todayStr, gap_days: 3,
            type: defaultType ? { id: defaultType.id, name: defaultType.name, kind: defaultType.kind, caption_template: defaultType.caption_template } : undefined,
            assignee: null, slots: [], comments: [], logs: [], occasion: null,
            _channelIds: activeChannels.filter(c => c.platform === 'facebook').map(c => c.id),
            _fromSubmission: x.id,
        })
    }

    // ---------- Recurring series ----------
    function openNewSeries() {
        setSeriesEdit({ title: '', type: types[0] ? { id: types[0].id, name: types[0].name, kind: types[0].kind, caption_template: types[0].caption_template } : undefined, gap_days: 0, days_of_week: [5], channel_ids: activeChannels.filter(c => c.platform === 'facebook').map(c => c.id), notes: '' })
    }
    function openEditSeries(s: Series) { setSeriesEdit({ ...s }) }
    async function saveSeries() {
        const f = seriesEdit
        if (!f || !f.title?.trim()) { toast.error('সিরিজের নাম লিখুন'); return }
        if (!f.days_of_week?.length) { toast.error('অন্তত একটা বার বেছে নিন'); return }
        if (!f.channel_ids?.length) { toast.error('অন্তত একটা চ্যানেল বেছে নিন'); return }
        const payload = { id: f.id, title: f.title.trim(), type_id: f.type?.id, gap_days: f.gap_days ?? 0, days_of_week: f.days_of_week, channel_ids: f.channel_ids, notes: f.notes || '' }
        const res = await fetch('/api/content-calendar/series', {
            method: f.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (res.ok) {
            const row = await res.json()
            setSeries(prev => f.id ? prev.map(x => x.id === row.id ? row : x) : [...prev, row])
            setSeriesEdit(null); toast.success('সিরিজ সেভ হয়েছে')
        } else toast.error((await res.json()).error || 'সিরিজ সেভ করা যায়নি')
    }
    async function deleteSeries(s: Series) {
        if (!confirm(`"${s.title}" সিরিজ মুছে ফেলবেন?`)) return
        const res = await fetch(`/api/content-calendar/series?id=${s.id}`, { method: 'DELETE' })
        if (res.ok) { setSeries(prev => prev.filter(x => x.id !== s.id)); toast.success('সিরিজ মুছে ফেলা হয়েছে') }
        else toast.error((await res.json()).error || 'মুছে ফেলা যায়নি')
    }
    function seriesDatesNeeded(s: Series): string[] {
        const days = new Set(s.days_of_week)
        const out: string[] = []
        for (let ds = monthStart > todayStr ? monthStart : todayStr; ds <= monthEnd; ds = addDaysStr(ds, 1)) {
            if (!days.has(new Date(ds).getDay())) continue
            if (items.some(i => i.series_id === s.id && i.start_date === ds)) continue
            out.push(ds)
        }
        return out
    }
    async function genSeries(s: Series) {
        const dates = seriesDatesNeeded(s)
        if (!dates.length) return
        for (const ds of dates) {
            const res = await fetch('/api/content-calendar/items', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: s.title, type_id: s.type.id, start_date: ds, gap_days: s.gap_days, channel_ids: s.channel_ids, series_id: s.id, notes: s.notes }),
            })
            if (res.ok) { const created = await res.json(); setItems(prev => [created, ...prev]) }
        }
        toast.success(`${bn(dates.length)}টা কন্টেন্ট ক্যালেন্ডারে বসানো হয়েছে`)
    }

    // ---------- Product rotation ----------
    function openAddForProduct(code: string, name: string) {
        const defaultType = types[0]
        setEditing({
            title: name || '', product_code: code, caption: defaultType?.caption_template || '', notes: '',
            stage: defaultType ? KIND_INFO[defaultType.kind].stages[0] : 'idea',
            start_date: view === 'month' ? selectedDate : todayStr, gap_days: 3,
            type: defaultType ? { id: defaultType.id, name: defaultType.name, kind: defaultType.kind, caption_template: defaultType.caption_template } : undefined,
            assignee: null, slots: [], comments: [], logs: [], occasion: null,
            _channelIds: activeChannels.filter(c => c.platform === 'facebook').map(c => c.id),
        })
    }
    // The textarea always submits the whole catalog — one line per product: code | name | cat.
    async function saveProducts(text: string) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
        const seen = new Set<string>()
        const list: Product[] = []
        for (const line of lines) {
            const parts = (line.includes('|') ? line.split('|') : line.split('\t')).map(x => x.trim())
            const code = parts[0]
            if (!code || seen.has(code)) continue
            seen.add(code)
            list.push({ code, name: parts[1] || null, cat: parts[2] || null })
        }
        if (list.length > 3000) { toast.error('একসাথে সর্বোচ্চ ৩০০০টা প্রোডাক্ট রাখা যাবে'); return }
        const res = await fetch('/api/content-calendar/products', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: list }),
        })
        if (res.ok) {
            const data = await res.json()
            setProducts(data.products || []); setShowProductEdit(false); toast.success(`${bn((data.products || []).length)}টা প্রোডাক্ট সেভ হয়েছে`)
        } else toast.error('প্রোডাক্ট সেভ করা যায়নি')
    }

    const TABS: { key: typeof view; label: string; icon: React.ReactNode }[] = [
        { key: 'month', label: 'মাস', icon: <IconCalendar size={14} /> },
         { key: 'work', label: 'কার কী কাজ', icon: <IconUsers size={14} /> },
         { key: 'board', label: 'প্রোডাকশন', icon: <IconLayers size={14} /> },
        { key: 'pages', label: 'পেজ অনুযায়ী', icon: <IconGlobe size={14} /> },
        { key: 'occ', label: 'উপলক্ষ', icon: <IconTarget size={14} /> },
         { key: 'postbank', label: 'পোস্ট ব্যাংক', icon: <IconLightbulb size={14} /> },
         { key: 'products', label: 'প্রোডাক্ট', icon: <IconPackage size={14} /> },
        { key: 'series', label: 'সিরিজ', icon: <IconClock size={14} /> },
        { key: 'target', label: 'টার্গেট', icon: <IconTrendingUp size={14} /> },
         { key: 'report', label: 'রিপোর্ট', icon: <IconBarChart3 size={14} /> },
        { key: 'settings', label: 'সেটিংস', icon: <IconWrench size={14} /> },
    ]
    // Owner/Super Admin always see every tab; everyone else is limited to whatever's checked for
    // them in Settings → টিমের দায়িত্ব (an empty allowed_tabs list there means "no restriction").
    const myAllowedTabs = team.find(m => m.id === perms.employee_id)?.allowed_tabs || []
    const visibleTabs = isSuperAdmin || !myAllowedTabs.length ? TABS : TABS.filter(t => myAllowedTabs.includes(t.key))
    // Redirect off a tab that just became hidden (e.g. restrictions loaded in after the default
    // 'month' view was already picked) — done during render, React's recommended pattern for
    // adjusting state in response to changed data, so it doesn't cost an extra effect round-trip.
    const visibleTabKeys = visibleTabs.map(t => t.key).join(',')
    const [lastTabKeys, setLastTabKeys] = useState(visibleTabKeys)
    if (visibleTabKeys !== lastTabKeys) {
        setLastTabKeys(visibleTabKeys)
        if (visibleTabs.length && !visibleTabs.some(t => t.key === view)) setView(visibleTabs[0].key)
    }

    return (
        <RequireFeature slugs={['content']}>
            <motion.div className="content-calendar-page" variants={container} initial="hidden" animate="show">
                <motion.div className="page-header" variants={item_}>
                    <div>
                        <h1 className="page-title">কন্টেন্ট ক্যালেন্ডার</h1>
                        {/* <p className="page-subtitle">আইডিয়া থেকে পোস্ট হওয়া পর্যন্ত প্রতিটি সোশ্যাল পোস্ট প্ল্যান, দায়িত্ব ও ট্র্যাক করুন।</p> */}
                    </div>
                     {view !== 'settings' && (
                        <button className="btn" style={{ background: '#B0175A', color: '#fff', border: 'none' }} onClick={() => openAdd()}>
                            <IconPlus size={16} /> নতুন কন্টেন্ট
                        </button>
                    )} 
                </motion.div>

                <motion.div variants={item_} style={{ display: 'flex', gap: '6px', padding: '6px', width: 'fit-content', borderRadius: '16px', background: 'rgba(118,118,128,0.08)', marginBottom: '20px' }}>
                    {visibleTabs.map(t => (
                        <button key={t.key} onClick={() => setView(t.key)}
                            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: view === t.key ? '#fff' : 'var(--color-text-secondary)' }}>
                            {view === t.key && (
                                <motion.div layoutId="contentCalendarTab" style={{ position: 'absolute', inset: 0, borderRadius: '12px', background: 'linear-gradient(135deg, #B0175A, #8B1047)', zIndex: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {t.icon}{t.label}
                                {t.key === 'postbank' && submissions.filter(s => s.status === 'pending').length > 0 && (
                                    <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: '50%', background: view === t.key ? '#fff' : '#DC2626', color: view === t.key ? '#B0175A' : '#fff', fontSize: '0.6875rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {bn(submissions.filter(s => s.status === 'pending').length)}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))}
                </motion.div>

                {loading ? (
                    <div className="card" style={{ textAlign: 'center', padding: '60px' }}>লোড হচ্ছে…</div>
                ) : (
                    <>
                        {view === 'month' && (
                            <MonthView {...{ month, setMonth, selectedDate, setSelectedDate, monthStart, monthEnd, todayStr, slotsInRange, channelById, channels: activeChannels, channelTargets, occasions, openAdd, openEdit, togglePosted, copyCaption, onBulkAdd: setBulkAddDate, team: activeTeam, monthPerson: workPerson, setMonthPerson: setWorkPerson }} />
                        )}
                        {view === 'board' && (
                            <BoardView {...{ items, team: activeTeam, channelById, month, setMonth, openEdit, advanceStage }} />
                        )}
                        {view === 'work' && (
                            <WorkView {...{ items, team: activeTeam, month, setMonth, workStage, setWorkStage, workPerson, setWorkPerson, openEdit, advanceStage }} />
                        )}
                        {view === 'pages' && (
                            <PagesView {...{ channels: activeChannels, month, setMonth, monthStart, monthEnd, todayStr, pageChannel, setPageChannel, slotsInRange, channelById, openEdit, copyCaption }} />
                        )}
                        {view === 'occ' && (
                            <OccasionsView {...{
                                occasions, items, todayStr, showPastOcc, setShowPastOcc, occEdit, setOccEdit,
                                onAdd: openNewOccasion, onEdit: openEditOccasion, onSave: saveOccasion,
                                onDelete: deleteOccasion, onAddContent: openAddForOccasion, onSeedAnnual: seedAnnualOccasions,
                            }} />
                        )}
                        {view === 'postbank' && (
                            <PostBankView {...{
                                submissions, team: activeTeam, submissionEdit, setSubmissionEdit,
                                onNew: openNewSubmission, onEdit: openEditSubmission, onSave: saveSubmission,
                                onDelete: deleteSubmission, onReturn: returnSubmission, onSchedule: scheduleSubmission,
                            }} />
                        )}
                        {view === 'products' && (
                            <ProductsView {...{
                                items, products, monthStart, monthEnd, todayStr,
                                showEdit: showProductEdit, setShowEdit: setShowProductEdit,
                                query: productQuery, setQuery: setProductQuery, filter: productFilter, setFilter: setProductFilter,
                                onSave: saveProducts, onAddContent: openAddForProduct,
                            }} />
                        )}
                        {view === 'series' && (
                            <SeriesView {...{
                                series, items, types, channels: activeChannels, channelById, month, setMonth, monthStart, monthEnd,
                                seriesEdit, setSeriesEdit,
                                onNew: openNewSeries, onEdit: openEditSeries, onSave: saveSeries, onDelete: deleteSeries, onGenerate: genSeries, seriesDatesNeeded,
                            }} />
                        )}
                        {view === 'target' && (
                            <TargetView {...{
                                items, channels: activeChannels, team: activeTeam, month, setMonth, monthStart, monthEnd, todayStr,
                                channelTargets, memberTargets, targetsCustom, targetScope, setTargetScope, targetDraft, setTargetDraft,
                                onSave: saveTargets,
                            }} />
                        )}
                        {view === 'report' && (
                            <ReportView {...{ items, channels: activeChannels, types, occasions, team: activeTeam, channelTargets, memberTargets, month, setMonth, monthStart, monthEnd }} />
                        )}
                        {view === 'settings' && (
                            <SettingsView {...{
                                channels, types, team, isSuperAdmin,
                                newChannelDraft, setNewChannelDraft, onSaveNewChannel: saveNewChannel,
                                toggleChannelActive, deleteChannel, saveChannelField, reorderChannel, uploadChannelPhoto,
                                newTypeDraft, setNewTypeDraft, onSaveNewType: saveNewType,
                                saveTypeField, reorderType, deleteType, toggleTeamActive, toggleTeamTab, selectAllTeamTabs,
                            }} />
                        )}
                    </>
                )}

                <AnimatePresence>
                    {editing && (
                        <ItemModal
                            editing={editing} setEditing={setEditing} types={types} channels={activeChannels} team={team} occasions={occasions}
                            onClose={() => setEditing(null)} onSave={saveEditing} onDelete={() => editing.id && deleteItem(editing as ContentItem)}
                            onDuplicate={() => editing.id && openDuplicate(editing as ContentItem)}
                            onAddComment={addComment} onToggleComment={toggleComment} onCopyCaption={copyCaption}
                        />
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {bulkAddDate && (
                        <BulkAddModal date={bulkAddDate} types={types} channels={activeChannels}
                            onClose={() => setBulkAddDate(null)} onSaveAll={saveBulkPosts} />
                    )}
                </AnimatePresence>
            </motion.div>
        </RequireFeature>
    )
}

// ================= Month view =================
function MonthView({ month, setMonth, selectedDate, setSelectedDate, monthStart, monthEnd, todayStr, slotsInRange, channelById, channels, channelTargets, occasions, openAdd, openEdit, togglePosted, copyCaption, onBulkAdd, team, monthPerson, setMonthPerson }: {
    month: string; setMonth: (m: string) => void
    selectedDate: string; setSelectedDate: (d: string) => void; monthStart: string; monthEnd: string; todayStr: string
    slotsInRange: (a: string, b: string) => { item: ContentItem; slot: Slot }[]
    channelById: (id: string) => Channel; channels: Channel[]; channelTargets: ChannelTarget[]
    occasions: Occasion[]; openAdd: (d?: string) => void; openEdit: (i: ContentItem) => void
    togglePosted: (i: ContentItem, s: Slot) => void; copyCaption: (i: ContentItem, s: Slot) => void
    onBulkAdd: (date: string) => void
    team: TeamMember[]; monthPerson: string; setMonthPerson: (id: string) => void
}) {
    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Monday-first grid
    // When an employee is picked, every number and cell on this tab narrows to just their
    // assigned work — one filter, consistently applied, rather than only some of the view.
    const slotsFor = (a: string, b: string) => {
        const list = slotsInRange(a, b)
        return monthPerson ? list.filter(x => x.item.assignee?.id === monthPerson) : list
    }
    const monthSlots = slotsFor(monthStart, monthEnd)
    const posted = monthSlots.filter(x => x.slot.posted).length
    const late = monthSlots.filter(x => isSlotLate(x.slot)).length
    const msgs = monthSlots.reduce((t, x) => t + (Number(x.slot.msgs) || 0), 0)
    const orders = monthSlots.reduce((t, x) => t + (Number(x.slot.orders) || 0), 0)
    const occasionsOn = (ds: string) => occasions.filter(o => o.date === ds)
    const isLeadDay = (ds: string) => occasions.some(o => ds < o.date && daysBetween(ds, o.date) <= o.lead_days)
    const nextOccasion = occasions.filter(o => o.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0]

    // Aggregate target progress across every active channel, for the amber "so far this month"
    // banner — same channelTargets/monthSlots data the per-page row and Target page use.
    const [showTargetBreakdown, setShowTargetBreakdown] = useState(false)
    const totalTarget = channels.reduce((s, c) => s + (channelTargets.find(t => t.channel_id === c.id)?.posts || 0), 0)
    const totalVideoTarget = channels.reduce((s, c) => s + (channelTargets.find(t => t.channel_id === c.id)?.videos || 0), 0)
    const totalPosted = monthSlots.filter(x => x.slot.posted).length
    const totalVideoPosted = monthSlots.filter(x => x.slot.posted && KIND_INFO[x.item.type.kind]?.isVideo).length
    const remaining = Math.max(0, totalTarget - totalPosted)
    const remainingVideo = Math.max(0, totalVideoTarget - totalVideoPosted)
    const todayCount = slotsFor(todayStr, todayStr).length

    const cells: React.ReactNode[] = []
    const WD = ['সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি', 'রবি']
    WD.forEach(w => cells.push(<div key={'wd' + w} style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '2px 0', textTransform: 'uppercase' }}>{w}</div>))
    for (let k = 0; k < firstDow; k++) cells.push(<div key={'b' + k} />)
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const list = slotsFor(ds, ds)
        const dayLate = list.some(x => isSlotLate(x.slot)), dayDone = list.length > 0 && list.every(x => x.slot.posted)
        const dotColor = !list.length ? undefined : dayLate ? '#DC2626' : dayDone ? '#16A34A' : '#A15C00'
        const isToday = ds === todayStr, isSel = ds === selectedDate, isPast = ds < todayStr
        const occs = occasionsOn(ds), lead = !occs.length && isLeadDay(ds)
        cells.push(
            <button key={ds} onClick={() => setSelectedDate(ds)}
                style={{
                    minHeight: 58, padding: '4px 5px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                    background: isToday ? '#B0175A' : isPast ? 'var(--color-bg-tertiary, #E2E8F0)' : 'var(--color-surface)',
                    border: isSel ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-light)',
                    boxShadow: lead ? 'inset 0 3px 0 #6A3FC8' : undefined,
                    color: isToday ? '#fff' : 'var(--color-text-primary)', display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '0.875rem', ...monoNum }}>
                    {bn(d)}{dotColor && <span style={{ width: 7, height: 7, borderRadius: '50%', background: isToday ? '#fff' : dotColor, display: 'inline-block' }} />}
                </span>
                {occs.map(o => <span key={o.id} style={{ fontSize: '0.625rem', fontWeight: 700, borderRadius: 3, padding: '1px 3px', background: isToday ? 'rgba(255,255,255,0.25)' : 'rgba(106,63,200,0.1)', color: isToday ? '#fff' : '#6A3FC8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>)}
                {list.length > 0 && <span style={{ fontSize: '0.6875rem', opacity: 0.85 }}>{bn(list.length)}টা পোস্ট</span>}
            </button>
        )
    }

    const dayList = slotsFor(selectedDate, selectedDate)
    const leadOccasion = occasions.find(o => selectedDate < o.date && daysBetween(selectedDate, o.date) <= o.lead_days)

    return (
        <>
            {nextOccasion && (
                <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#B0175A', color: '#fff', marginBottom: 12 }}>
                    <b>আজ {BN_DAYS[new Date(todayStr).getDay()]}, {formatDate(todayStr)}</b>
                    <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>· পরের উপলক্ষ: {nextOccasion.name} {daysBetween(todayStr, nextOccasion.date) === 0 ? 'আজ' : `আর ${bn(daysBetween(todayStr, nextOccasion.date))} দিন`}</span>
                </motion.div>
            )}

            {totalTarget > 0 && (
                <motion.div variants={item_} style={{ border: '1px solid #A15C00', background: 'rgba(161,92,0,0.12)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#A15C00', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, flex: 1, minWidth: 200 }}>
                            এ মাসে পোস্ট হয়েছে {bn(totalPosted)}/{bn(totalTarget)} · ভিডিও {bn(totalVideoPosted)}/{bn(totalVideoTarget)} · আরো {bn(remaining)}টা বাকি (ভিডিও {bn(remainingVideo)}টা)
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowTargetBreakdown(v => !v)}>{showTargetBreakdown ? '▲ লুকান' : '▼ পেজ অনুযায়ী'}</button>
                    </div>
                    {todayCount === 0 && remaining > 0 && (
                        <div style={{ marginTop: 6, fontSize: '0.8125rem', color: '#A15C00' }}>
                            ⚠️ আজকের জন্য কোনো পোস্ট প্ল্যান করা নেই — এ মাসে আরো {bn(remaining)}টা পোস্ট বাকি
                        </div>
                    )}
                    {showTargetBreakdown && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                            {channels.map(c => {
                                const cPosted = monthSlots.filter(x => x.slot.channel_id === c.id && x.slot.posted).length
                                const cTarget = channelTargets.find(t => t.channel_id === c.id)?.posts || 0
                                const cVideoTarget = channelTargets.find(t => t.channel_id === c.id)?.videos || 0
                                return (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}>
                                        <ChannelIcon channel={c} size={22} />
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name} {bn(cPosted)}/{bn(cTarget)}{cVideoTarget > 0 ? ` · ভিডিও ${bn(cVideoTarget)}` : ''}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>
            )}
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>{formatMonthLabel(month)}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, -1))}><IconChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMonth(currentMonthString())}>এই মাস</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, 1))}><IconChevronRight size={16} /></button>
                <select className="form-input" style={{ width: 'auto' }} value={monthPerson} onChange={e => setMonthPerson(e.target.value)}>
                    <option value="">সবাই</option>
                    {team.map(mem => <option key={mem.id} value={mem.id}>{mem.name}</option>)}
                </select>
            </motion.div>

            <motion.div variants={item_} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div className="stat-card"><span className="stat-label">মোট পোস্ট প্ল্যান</span><span className="stat-value" style={{ fontSize: '1.5rem', ...monoNum }}>{bn(monthSlots.length)}</span></div>
                <div className="stat-card"><span className="stat-label">পোস্ট হয়েছে</span><span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A', ...monoNum }}>{bn(posted)}</span></div>
                <div className="stat-card"><span className="stat-label">সময় পার, পোস্ট হয়নি</span><span className="stat-value" style={{ fontSize: '1.5rem', color: late ? '#DC2626' : undefined, ...monoNum }}>{bn(late)}</span></div>
                <div className="stat-card"><span className="stat-label">মেসেজ</span><span className="stat-value" style={{ fontSize: '1.5rem', ...monoNum }}>{bn(msgs)}</span></div>
                <div className="stat-card"><span className="stat-label">অর্ডার</span><span className="stat-value" style={{ fontSize: '1.5rem', ...monoNum }}>{bn(orders)}</span></div>
            </motion.div>

            {channels.length > 0 && (
                <motion.div variants={item_} style={{ marginBottom: 20 }}>
                    <p className="hint" style={{ margin: '0 0 8px', fontSize: '0.8125rem' }}>এই মাসে প্রতিটি অ্যাকাউন্টে প্ল্যান করা পোস্ট / মাসিক টার্গেট — বিস্তারিত &quot;টার্গেট&quot; পাতায়</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {channels.map(c => {
                            const planned = monthSlots.filter(x => x.slot.channel_id === c.id).length
                            const target = channelTargets.find(t => t.channel_id === c.id)?.posts || 0
                            const pct = target > 0 ? Math.min(100, Math.round(planned / target * 100)) : 0
                            return (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}>
                                    <ChannelIcon channel={c} size={22} />
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name} {bn(planned)}/{bn(target)}</span>
                                    <span style={{ width: 50, height: 4, borderRadius: 2, background: 'var(--color-border-light)', overflow: 'hidden', flexShrink: 0 }}>
                                        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: '#B0175A' }} />
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </motion.div>
            )}

            <motion.div variants={item_} className="card" style={{ padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 }}>{cells}</div>
            </motion.div>

            <motion.div variants={item_} style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '10px 0 4px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#B0175A' }} /> আজ</span>
               <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-border-light, #E2E8F0)' }} /> চলে যাওয়া দিন</span>
                 <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid var(--color-border-light)', opacity: 0.6 }} />সামনের দিন</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 3, borderRadius: 2, background: '#6A3FC8' }} /> উপলক্ষের প্রস্তুতি</span>
            </motion.div>
            <motion.div variants={item_} style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 16, fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} /> সময় পার, পোস্ট হয়নি</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#A15C00' }} /> বাকি আছে</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} /> সব পোস্ট হয়েছে</span>
            </motion.div>

            <motion.div variants={item_} className="card" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.0625rem', flex: 1, minWidth: 0 }}>{formatDate(selectedDate)}{selectedDate === todayStr ? ' — আজ' : ''}</h3>
                    <button className="btn btn-secondary btn-sm" onClick={() => openAdd(selectedDate)}><IconPlus size={14} /> এই তারিখে নতুন</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => onBulkAdd(selectedDate)}>☰ এই দিনের সব একসাথে</button>
                </div>
                {occasionsOn(selectedDate).map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(106,63,200,0.15)', color: '#A78BFA', marginBottom: 10, fontWeight: 600, fontSize: '0.875rem' }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#DC2626', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <IconTarget size={12} />
                        </span>
                        আজ {o.name}
                    </div>
                ))}
                {leadOccasion && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(106,63,200,0.1)', color: '#6A3FC8', marginBottom: 10, fontWeight: 600, fontSize: '0.875rem' }}>
                        🎯 {leadOccasion.name} আসছে — আর {bn(daysBetween(selectedDate, leadOccasion.date))} দিন ({shortDateBn(leadOccasion.date)})
                    </div>
                )}
                {dayList.length === 0 ? (
                    <p className="hint" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>এই তারিখে কিছু প্ল্যান করা নেই।</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {dayList.map(({ item, slot }) => {
                            const ch = channelById(slot.channel_id)
                            const phase = phaseOf(item)
                            return (
                                <div key={(slot.id || slot.channel_id) + item.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: '1px solid var(--color-border-light)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: PLATFORM_COLOR[ch.platform] }}>
                                        <ChannelIcon channel={ch} size={36} />
                                        <b style={{ fontSize: '1rem', color: 'var(--color-text-primary)' }}>{ch.name}</b>
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: 160, cursor: 'pointer' }} onClick={() => openEdit(item)}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.title}</div>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                                {isActivePhase(item) && <Pill label={`এখনো ${STAGE_INFO[item.stage as Stage]?.label}`} {...stagePillStyle(phase)} />}
                                                {item.occasion && <Pill label={`🎯 ${item.occasion.name}`} bg="rgba(106,63,200,0.1)" color="#6A3FC8" />}
                                                {item.assignee && <span>{item.assignee.name}</span>}
                                            </div>
                                        </div>
                                        <button className="btn btn-sm" style={{ background: slot.posted ? 'rgba(22,163,74,0.12)' : 'var(--color-surface-secondary, #F1F5F9)', color: slot.posted ? '#16A34A' : undefined, border: 'none', whiteSpace: 'nowrap' }} onClick={() => togglePosted(item, slot)}>
                                            {slot.posted ? '✓ পোস্টেড' : 'পোস্ট হয়েছে'}
                                        </button>
                                    </div>
                                    {!slot.posted && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => copyCaption(item, slot)}><IconClipboard size={14} /> ক্যাপশন কপি</button>
                                            <a className="btn btn-secondary btn-sm" href={ch.upload_link || UPLOAD_LINK[ch.platform]} target="_blank" rel="noopener noreferrer">↗ {UPLOAD_NAME[ch.platform]} খুলুন</a>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </motion.div>
        </>
    )
}

// ================= Production board =================
function BoardCard({ it, channelById, onOpen, onAdvance }: { it: ContentItem; channelById: (id: string) => Channel; onOpen: (i: ContentItem) => void; onAdvance: (i: ContentItem) => void }) {
    const phase = phaseOf(it)
    const next = nextStageOf(it.type.kind, it.stage)
    const first = firstDateOf(it)
    const prodLate = isActivePhase(it) && first && first <= getLocalDateString()
    return (
        <div className="card" style={{ padding: 10, borderLeft: `4px solid ${stagePillStyle(phase).color}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }} onClick={() => onOpen(it)}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{it.title}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Pill label={phase === 'done' ? 'সব পোস্টেড' : phase === 'ready' ? 'পোস্টের জন্য প্রস্তুত' : STAGE_INFO[it.stage as Stage]?.label} {...stagePillStyle(phase)} />
                {prodLate && <Pill label="পোস্টের দিন চলে এসেছে" bg="rgba(220,38,38,0.1)" color="#DC2626" />}
                {it.occasion && <Pill label={`🎯 ${it.occasion.name}`} bg="rgba(106,63,200,0.1)" color="#6A3FC8" />}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{it.type.name}</span>
            {it.slots.length > 0 && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {it.slots.map(s => {
                        const ch = channelById(s.channel_id)
                        return (
                            <span key={(s.id || s.channel_id)} title={ch.name} style={{ display: 'inline-flex', borderRadius: '50%', boxShadow: s.posted ? '0 0 0 2px #16A34A' : undefined }}>
                                <ChannelIcon channel={ch} size={20} />
                            </span>
                        )
                    })}
                </div>
            )}
            <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                {it.assignee ? <>{avatar(it.assignee.name, null, 18)}{it.assignee.name}</> : <span className="hint">দায়িত্ব দেওয়া হয়নি</span>}
                {first && <span className="hint">· পোস্ট {formatDate(first)}</span>}
            </span>
            {isActivePhase(it) && next && (
                <button className="btn btn-sm" style={{ background: '#B0175A', color: '#fff', border: 'none', fontSize: '0.75rem', width: '100%' }}
                    onClick={e => { e.stopPropagation(); onAdvance(it) }}>{STAGE_INFO[it.stage as Stage].label} শেষ → {STAGE_INFO[next].label}</button>
            )}
        </div>
    )
}

function BoardView({ items, team, channelById, month, setMonth, openEdit, advanceStage }: {
    items: ContentItem[]; team: TeamMember[]; channelById: (id: string) => Channel
    month: string; setMonth: (m: string) => void; openEdit: (i: ContentItem) => void; advanceStage: (i: ContentItem) => void
}) {
    const [who, setWho] = useState('')
    const visible = items.filter(i => !who || i.assignee?.id === who)
    // These five always show as their own column, even empty — every format passes through at
    // least one of them. The rarer stages (plan/collect/prep/thumb — only used by some formats,
    // e.g. Live or Customer Review) only show up once something's actually in them.
    const alwaysShown: Stage[] = ['idea', 'shoot', 'design', 'edit', 'review']
    const cols = STAGE_ORDER.filter(s => s !== 'ready').map(s => ({ key: s, label: STAGE_INFO[s].label, items: visible.filter(i => isActivePhase(i) && i.stage === s) }))
        .filter(c => alwaysShown.includes(c.key) || c.items.length > 0)
    const ready = visible.filter(i => phaseOf(i) === 'ready')
    const done = visible.filter(i => phaseOf(i) === 'done')

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>{formatMonthLabel(month)}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, -1))}><IconChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMonth(currentMonthString())}>এই মাস</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, 1))}><IconChevronRight size={16} /></button>
                <select className="form-input" style={{ width: 'auto', height: 34, fontSize: '0.8125rem' }} value={who} onChange={e => setWho(e.target.value)}>
                    <option value="">সবার কাজ</option>
                    {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
            </motion.div>
            <p className="hint" style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>প্রতিটি ধাপের জন্য আলাদা কলাম। প্রতিটি পোস্ট ফরম্যাটের নিজস্ব ধাপ আছে, আর প্রতি ধাপে সঠিক ব্যক্তি অটো দায়িত্ব পান।</p>
            <motion.div variants={item_} className="board-scroll" style={{ display: 'flex', gap: 12, overflowX: 'scroll', paddingBottom: 12 }}>
                {cols.map(c => (
                    <div key={c.key} style={{ flex: '0 0 260px', background: 'var(--color-surface-secondary, #F1F5F9)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <h3 style={{ fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>{c.label}<span className="hint" style={monoNum}>{bn(c.items.length)}</span></h3>
                        {c.items.map(it => <BoardCard key={it.id} it={it} channelById={channelById} onOpen={openEdit} onAdvance={advanceStage} />)}
                    </div>
                ))}
                {[{ key: 'ready', label: 'পোস্টের জন্য প্রস্তুত', items: ready }, { key: 'done', label: 'সব পোস্টেড', items: done }].map(c => (
                    <div key={c.key} style={{ flex: '0 0 260px', background: 'var(--color-surface-secondary, #F1F5F9)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <h3 style={{ fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>{c.label}<span className="hint" style={monoNum}>{bn(c.items.length)}</span></h3>
                        {c.items.map(it => <BoardCard key={it.id} it={it} channelById={channelById} onOpen={openEdit} onAdvance={advanceStage} />)}
                        {!c.items.length && <span className="hint">খালি</span>}
                    </div>
                ))}
            </motion.div>
        </>
    )
}

// ================= Workload =================
function WorkView({ items, team, month, setMonth, workStage, setWorkStage, workPerson, setWorkPerson, openEdit, advanceStage }: {
    items: ContentItem[]; team: TeamMember[]; month: string; setMonth: (m: string) => void
    workStage: string; setWorkStage: (s: string) => void; workPerson: string; setWorkPerson: (p: string) => void
    openEdit: (i: ContentItem) => void; advanceStage: (i: ContentItem) => void
}) {
    const active = items.filter(isActivePhase)
    const todayStr = getLocalDateString()
    const [y, m] = month.split('-').map(Number)
    const logsInMonth = items.flatMap(i => i.logs.map(l => ({ item: i, log: l }))).filter(x => { const d = x.log.at.slice(0, 7); return d === `${y}-${String(m).padStart(2, '0')}` })

    const stageCounts = STAGE_ORDER.filter(s => s !== 'ready').map(s => ({ key: s, label: STAGE_INFO[s].label, count: active.filter(i => i.stage === s).length }))
        .filter(s => s.count > 0)
    const inStage = (i: ContentItem) => !workStage || i.stage === workStage

    const rows = team.map(member => {
        const pending = active.filter(i => i.assignee?.id === member.id && inStage(i))
        const late = pending.filter(isItemLate).length
        const done = logsInMonth.filter(x => x.log.by === member.name && (!workStage || x.log.stage === workStage)).length
        const nextDue = pending.map(firstDateOf).filter(Boolean).sort()[0]
        if (workStage && !pending.length && !done && !member.roles.includes(STAGE_INFO[workStage as Stage].role)) return null
        return { member, pending: pending.length, late, done, nextDue }
    }).filter((r): r is NonNullable<typeof r> => !!r)

    const queue = active.filter(i => inStage(i) && (!workPerson || i.assignee?.id === workPerson)).sort((a, b) => firstDateOf(a).localeCompare(firstDateOf(b)))
    const finished = logsInMonth.filter(x => (!workPerson || team.find(m => m.id === workPerson)?.name === x.log.by) && (!workStage || x.log.stage === workStage))
        .sort((a, b) => b.log.at.localeCompare(a.log.at))

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>{formatMonthLabel(month)}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, -1))}><IconChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMonth(currentMonthString())}>এই মাস</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, 1))}><IconChevronRight size={16} /></button>
            </motion.div>

            <motion.div variants={item_} style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
                <button onClick={() => setWorkStage('')} style={{ flex: '0 0 auto', padding: '8px 12px', borderRadius: 10, border: workStage === '' ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-light)', background: 'var(--color-surface)', minWidth: 90, textAlign: 'left' }}>
                    <b style={{ display: 'block', fontSize: '1.25rem', ...monoNum }}>{bn(active.length)}</b><small className="hint">সব ধাপ</small>
                </button>
                {stageCounts.map(s => (
                    <button key={s.key} onClick={() => setWorkStage(s.key)} style={{ flex: '0 0 auto', padding: '8px 12px', borderRadius: 10, border: workStage === s.key ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-light)', background: 'var(--color-surface)', minWidth: 90, textAlign: 'left' }}>
                        <b style={{ display: 'block', fontSize: '1.25rem', ...monoNum }}>{bn(s.count)}</b><small className="hint">{s.label}</small>
                    </button>
                ))}
            </motion.div>

            <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h3 style={{ fontSize: '1.0625rem' }}>কার কাছে কত কাজ — {workStage ? STAGE_INFO[workStage as Stage].label : 'সব ধাপ'}</h3>
                    {workPerson && <button className="btn btn-ghost btn-sm" onClick={() => setWorkPerson('')}>সবাইকে দেখুন</button>}
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead><tr><th>সদস্য</th><th style={{ textAlign: 'right' }}>বাকি</th><th style={{ textAlign: 'right' }}>দেরি</th><th style={{ textAlign: 'right' }}>এ মাসে শেষ</th><th>পরের পোস্ট</th></tr></thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.member.id} style={{ cursor: 'pointer', background: workPerson === r.member.id ? 'rgba(176,23,90,0.06)' : undefined }} onClick={() => setWorkPerson(workPerson === r.member.id ? '' : r.member.id)}>
                                    <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{avatar(r.member.name, r.member.avatar_url, 24)}<b>{r.member.name}</b></td>
                                    <td style={{ textAlign: 'right', ...monoNum }}>{bn(r.pending)}</td>
                                    <td style={{ textAlign: 'right', color: r.late ? '#DC2626' : undefined, ...monoNum }}>{bn(r.late)}</td>
                                    <td style={{ textAlign: 'right', ...monoNum }}>{bn(r.done)}</td>
                                    <td>{r.nextDue ? formatDate(r.nextDue) : '—'}</td>
                                </tr>
                            ))}
                            {!rows.length && <tr><td colSpan={5} className="hint" style={{ textAlign: 'center', padding: 16 }}>এই দায়িত্বে এখনো কেউ নেই — সেটিংসে গিয়ে দায়িত্ব দিন।</td></tr>}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.0625rem', marginBottom: 8 }}>বাকি কাজ — {workPerson ? team.find(m => m.id === workPerson)?.name : 'সবাই'}</h3>
                {!queue.length && <p className="hint">কোনো কাজ বাকি নেই।</p>}
                {queue.map(it => {
                    const d = new Date(firstDateOf(it))
                    const stageStart = (it.stage_since || it.created_at).slice(0, 10)
                    const daysInStage = Math.max(0, daysBetween(stageStart, todayStr))
                    return (
                        <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--color-border-light)' }}>
                            <div style={{ textAlign: 'center', background: isItemLate(it) ? 'rgba(220,38,38,0.08)' : 'var(--color-surface-secondary, #F1F5F9)', borderRadius: 8, padding: '3px 0' }}>
                                <small className="hint" style={{ display: 'block', fontSize: '0.6875rem' }}>{BN_DSHORT[d.getDay()]}</small>
                                <b style={{ display: 'block', fontSize: '1rem', ...monoNum }}>{bn(d.getDate())}</b>
                                <small className="hint" style={{ display: 'block', fontSize: '0.6875rem' }}>{BN_MSHORT[d.getMonth()]}</small>
                            </div>
                            <div style={{ cursor: 'pointer', minWidth: 0 }} onClick={() => openEdit(it)}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{it.title}</div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                                    <Pill label={STAGE_INFO[it.stage as Stage]?.label} {...stagePillStyle(phaseOf(it))} />
                                    <span>{it.type.name}</span>
                                    {!workPerson && it.assignee && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{avatar(it.assignee.name, null, 16)}{it.assignee.name}</span>}
                                    <span>· এই ধাপে {bn(daysInStage)} দিন</span>
                                </div>
                            </div>
                            {nextStageOf(it.type.kind, it.stage) && (
                                <button className="btn btn-sm" style={{ background: 'rgba(176,23,90,0.1)', color: '#B0175A', border: 'none' }} onClick={() => advanceStage(it)}>{STAGE_INFO[it.stage as Stage].label} শেষ →</button>
                            )}
                        </div>
                    )
                })}
            </motion.div>

            <motion.div variants={item_} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ fontSize: '1.0625rem' }}>এ মাসে শেষ করা কাজ — {workPerson ? team.find(m => m.id === workPerson)?.name : 'সবাই'}</h3>
                    <span className="hint">{bn(finished.length)}টা ধাপ শেষ</span>
                </div>
                {!finished.length && <p className="hint">এখনো কিছু রেকর্ড হয়নি।</p>}
                {finished.map((x, k) => (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 10, padding: '6px 0', borderTop: '1px solid var(--color-border-light)', alignItems: 'center', fontSize: '0.875rem' }}>
                        <span className="hint">{shortDateBn(x.log.at.slice(0, 10))}</span>
                        <b style={{ cursor: 'pointer', fontWeight: 600 }} onClick={() => openEdit(x.item)}>{x.item.title}</b>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Pill label={STAGE_INFO[x.log.stage as Stage]?.label || x.log.stage} bg="rgba(22,163,74,0.1)" color="#16A34A" />{!workPerson && x.log.by && <span className="hint">{x.log.by}</span>}</span>
                    </div>
                ))}
            </motion.div>
        </>
    )
}

// ================= By page =================
function PagesView({ channels, month, setMonth, monthStart, monthEnd, todayStr, pageChannel, setPageChannel, slotsInRange, channelById, openEdit, copyCaption }: {
    channels: Channel[]; month: string; setMonth: (m: string) => void; monthStart: string; monthEnd: string; todayStr: string
    pageChannel: string; setPageChannel: (id: string) => void
    slotsInRange: (a: string, b: string) => { item: ContentItem; slot: Slot }[]
    channelById: (id: string) => Channel; openEdit: (i: ContentItem) => void; copyCaption: (i: ContentItem, s: Slot) => void
}) {
    if (!channels.length) {
        return <p className="hint">সেটিংসে কোনো চ্যানেল নেই।</p>
    }
    const current = channels.find(c => c.id === pageChannel) ? pageChannel : channels[0].id
    const ch = channelById(current)
    const monthSlots = slotsInRange(monthStart, monthEnd)
    const countFor = (id: string) => monthSlots.filter(x => x.slot.channel_id === id).length
    const channelSlots = monthSlots.filter(x => x.slot.channel_id === current)

    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const rows: React.ReactNode[] = []
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const list = channelSlots.filter(x => x.slot.date === ds)
        if (!list.length && ds < todayStr) continue
        rows.push(
            <div key={ds} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10, padding: '10px 0', borderTop: '1px solid var(--color-border-light)' }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{bn(d)} {BN_MONTHS[m - 1]}</div>
                    <div className="hint" style={{ fontSize: '0.75rem' }}>{BN_DAYS[new Date(ds).getDay()]}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                    {!list.length && <span style={{ fontSize: '0.8125rem', color: '#A15C00' }}>এই দিনে কোনো পোস্ট নেই</span>}
                    {list.map(({ item, slot }) => {
                        const phase = phaseOf(item)
                        const others = item.slots.filter(s => s.channel_id !== current).map(s => `${channelById(s.channel_id).name} ${shortDateBn(s.date)}`).join(', ')
                        return (
                            <div key={(slot.id || slot.channel_id) + item.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }} onClick={() => openEdit(item)}>{item.title}</span>
                                    {slot.posted ? <Pill label="পোস্টেড" bg="rgba(22,163,74,0.1)" color="#16A34A" /> : <Pill label={STAGE_INFO[item.stage as Stage]?.label} {...stagePillStyle(phase)} />}
                                </div>
                                {others && <div className="hint" style={{ fontSize: '0.75rem' }}>অন্য জায়গায়: {others}</div>}
                                {slot.hook && <div className="hint" style={{ fontSize: '0.75rem' }}>হুক: {slot.hook}</div>}
                                {!slot.posted && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => copyCaption(item, slot)}><IconClipboard size={13} /> ক্যাপশন কপি</button>
                                        <a className="btn btn-ghost btn-sm" href={ch.upload_link || UPLOAD_LINK[ch.platform]} target="_blank" rel="noopener noreferrer">↗ {UPLOAD_NAME[ch.platform]} খুলুন</a>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>{formatMonthLabel(month)}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, -1))}><IconChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMonth(currentMonthString())}>এই মাস</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, 1))}><IconChevronRight size={16} /></button>
            </motion.div>

            <motion.div variants={item_} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {channels.map(c => (
                    <button key={c.id} onClick={() => setPageChannel(c.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 600, border: c.id === current ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}>
                        <ChannelIcon channel={c} size={26} />{c.name}<span className="hint">{bn(countFor(c.id))}</span>
                    </button>
                ))}
            </motion.div>

            <motion.div variants={item_} className="card">
                <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}><ChannelIcon channel={ch} size={28} />{ch.name} — {formatMonthLabel(month)}</h3>
                <p className="hint" style={{ margin: '0 0 4px', fontSize: '0.8125rem' }}>আজ থেকে মাসের শেষ পর্যন্ত প্রতিটি দিন, আর আগের যেসব দিনে পোস্ট ছিল। একই কন্টেন্ট অন্য কোন পেজে কবে যাচ্ছে তাও দেখা যাবে।</p>
                {rows.length ? rows : <p className="hint">এই মাসে এই অ্যাকাউন্টে কিছু নেই।</p>}
            </motion.div>
        </>
    )
}

// ================= Occasions =================
type OccDraft = { id?: string; name: string; date: string; lead_days: string; target: string; notes: string }
function OccasionsView({ occasions, items, todayStr, showPastOcc, setShowPastOcc, occEdit, setOccEdit, onAdd, onEdit, onSave, onDelete, onAddContent, onSeedAnnual }: {
    occasions: Occasion[]; items: ContentItem[]; todayStr: string; showPastOcc: boolean; setShowPastOcc: (v: boolean) => void
    occEdit: OccDraft | null; setOccEdit: (f: OccDraft | null) => void
    onAdd: () => void; onEdit: (o: Occasion) => void; onSave: () => void; onDelete: (o: Occasion) => void; onAddContent: (o: Occasion) => void
    onSeedAnnual: () => void
}) {
    const upcoming = occasions.filter(o => o.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))
    const gone = occasions.filter(o => o.date < todayStr).sort((a, b) => b.date.localeCompare(a.date))
    const seedRange = yearRangeLabel(nextAnnualSeedYear(occasions, todayStr))
    const f = occEdit

    function statsFor(o: Occasion) {
        const linked = items.filter(i => i.occasion?.id === o.id)
        const planned = linked.reduce((n, i) => n + i.slots.length, 0)
        const posted = linked.reduce((n, i) => n + i.slots.filter(s => s.posted).length, 0)
        return { planned, posted }
    }

    function Row({ o }: { o: Occasion }) {
        const d = new Date(o.date)
        const n = daysBetween(todayStr, o.date)
        const prepStart = addDaysStr(o.date, -o.lead_days)
        const { planned, posted } = statsFor(o)
        const when = n < 0 ? `${bn(-n)} দিন আগে গেছে` : n === 0 ? 'আজ' : `আর ${bn(n)} দিন`
        const prep = n < 0 ? null : todayStr >= prepStart
            ? <Pill label={`প্রস্তুতি চলছে (শুরু ${formatDate(prepStart)})`} bg="rgba(106,63,200,0.1)" color="#6A3FC8" />
            : <Pill label={`প্রস্তুতি শুরু ${formatDate(prepStart)}`} bg="var(--color-surface-secondary, #F1F5F9)" color="var(--color-text-tertiary)" />
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 12, padding: '12px 0', borderTop: '1px solid var(--color-border-light)', opacity: n < 0 ? 0.6 : 1 }}>
                <div style={{ textAlign: 'center', background: 'rgba(106,63,200,0.1)', color: '#6A3FC8', borderRadius: 8, padding: '4px 0' }}>
                    <small style={{ display: 'block', fontSize: '0.6875rem' }}>{BN_DSHORT[d.getDay()]}</small>
                    <b style={{ display: 'block', fontSize: '1.25rem' }}>{bn(d.getDate())}</b>
                    <small style={{ display: 'block', fontSize: '0.6875rem' }}>{BN_MSHORT[d.getMonth()]}</small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{o.name} <span className="hint" style={{ fontWeight: 400 }}>· {when}</span></div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
                        {prep}
                        <span>
                            {o.target ? `${bn(planned)}/${bn(o.target)}টা পোস্ট প্ল্যান · ${bn(posted)}টা পোস্টেড` : `${bn(planned)}টা পোস্ট প্ল্যান · ${bn(posted)}টা পোস্টেড`}
                            {o.target && planned < o.target && n >= 0 && <span style={{ color: '#A15C00' }}> · আরো {bn(o.target - planned)}টা প্ল্যান বাকি</span>}
                        </span>
                    </div>
                    {o.notes && <div className="hint" style={{ fontSize: '0.8125rem' }}>{o.notes}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: 6, flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'center' }}>
                    {n >= 0 && <button className="btn btn-secondary btn-sm" onClick={() => onAddContent(o)}>+ এই উপলক্ষে কন্টেন্ট</button>}
                    <button className="btn btn-secondary btn-sm" onClick={() => onEdit(o)}>এডিট</button>
                    <button className="btn btn-secondary btn-sm" style={{ color: '#DC2626' }} onClick={() => onDelete(o)}>মুছুন</button>
                </div>
            </div>
        )
    }

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>উপলক্ষ ও সিজন</h2>
                <button className="btn btn-secondary" onClick={onSeedAnnual}><IconClock size={14} /> বার্ষিক ক্যালেন্ডার থেকে যোগ করুন ({seedRange})</button>
                <button className="btn" style={{ background: '#B0175A', color: '#fff', border: 'none' }} onClick={onAdd}><IconPlus size={14} /> নতুন উপলক্ষ</button>
            </motion.div>
            <p className="hint" style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>প্রতিটি উপলক্ষের তারিখ আর কত দিন আগে থেকে কাজ শুরু হবে তা দিন। ক্যালেন্ডারে উপলক্ষের দিনে নাম দেখাবে, আর প্রস্তুতির দিনগুলোর উপরে বেগুনি দাগ থাকবে। কন্টেন্ট যোগ করার সময় উপলক্ষ বেছে নিলে এখানে হিসাব দেখা যাবে। &quot;বার্ষিক ক্যালেন্ডার থেকে যোগ করুন&quot; প্রতি বছরের নির্দিষ্ট দিনের উপলক্ষগুলো (নববর্ষ, স্বাধীনতা দিবস, ১১.১১ সেল ইত্যাদি) এক চাপে বসিয়ে দেয় — ঈদ, পূজার মতো চাঁদ দেখার উপর নির্ভরশীল উপলক্ষ তারিখ নিশ্চিত হলে নিজে যোগ করবেন।</p>

            {f && (
                <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '1.0625rem', marginBottom: 10 }}>{f.id ? 'উপলক্ষ এডিট' : 'নতুন উপলক্ষ'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group"><label className="form-label">নাম *</label>
                            <input className="form-input" value={f.name} onChange={e => setOccEdit({ ...f, name: e.target.value })} placeholder="যেমন: ঈদুল ফিতর, ১১.১১ সেল" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div className="form-group"><label className="form-label">তারিখ *</label>
                                <input className="form-input" type="date" value={f.date} onChange={e => setOccEdit({ ...f, date: e.target.value })} />
                            </div>
                            <div className="form-group"><label className="form-label">কত দিন আগে প্রস্তুতি</label>
                                <input className="form-input" type="number" min={0} max={120} value={f.lead_days} onChange={e => setOccEdit({ ...f, lead_days: e.target.value })} />
                            </div>
                            <div className="form-group"><label className="form-label">পোস্টের টার্গেট (ঐচ্ছিক)</label>
                                <input className="form-input" type="number" min={0} value={f.target} onChange={e => setOccEdit({ ...f, target: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group"><label className="form-label">নোট</label>
                            <input className="form-input" value={f.notes} onChange={e => setOccEdit({ ...f, notes: e.target.value })} placeholder="যেমন: চাঁদ দেখার উপর নির্ভর করে" />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary btn-sm" disabled={!f.name.trim() || !f.date} onClick={onSave}>সেভ করুন</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setOccEdit(null)}>বাতিল</button>
                        </div>
                    </div>
                </motion.div>
            )}

            <motion.div variants={item_} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h3 style={{ fontSize: '1.0625rem' }}>সামনের উপলক্ষ</h3><span className="hint">{bn(upcoming.length)}টা</span>
                </div>
                {upcoming.length ? upcoming.map(o => <Row key={o.id} o={o} />) : <p className="hint">সামনে কোনো উপলক্ষ যোগ করা নেই। উপরের বাটন থেকে যোগ করুন।</p>}
            </motion.div>

            {gone.length > 0 && (
                <motion.div variants={item_} className="card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h3 style={{ fontSize: '1.0625rem' }}>গত উপলক্ষ</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowPastOcc(!showPastOcc)}>{showPastOcc ? 'লুকান' : `দেখুন (${bn(gone.length)}টা)`}</button>
                    </div>
                    {showPastOcc && gone.map(o => <Row key={o.id} o={o} />)}
                </motion.div>
            )}
        </>
    )
}

// ================= Ideas =================
const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = { pending: 'অনুমোদনের অপেক্ষায়', returned: 'ফেরত দেওয়া', idea: 'শুধু আইডিয়া', scheduled: 'শিডিউল হয়েছে' }

function PostBankView({ submissions, team, submissionEdit, setSubmissionEdit, onNew, onEdit, onSave, onDelete, onReturn, onSchedule }: {
    submissions: Submission[]; team: TeamMember[]
    submissionEdit: (Partial<Submission> & { _byId?: string }) | null; setSubmissionEdit: (f: (Partial<Submission> & { _byId?: string }) | null) => void
    onNew: () => void; onEdit: (x: Submission) => void; onSave: () => void; onDelete: (x: Submission) => void
    onReturn: (x: Submission) => void; onSchedule: (x: Submission) => void
}) {
    const [tab, setTab] = useState<SubmissionStatus>('pending')
    const f = submissionEdit
    const counts: Record<SubmissionStatus, number> = { pending: 0, returned: 0, idea: 0, scheduled: 0 }
    submissions.forEach(s => { counts[s.status]++ })
    const list = submissions.filter(s => s.status === tab)

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>পোস্ট ব্যাংক</h2>
                <button className="btn" style={{ background: '#B0175A', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '0.9375rem' }} onClick={onNew}><IconPlus size={16} /> নতুন পোস্ট জমা দিন</button>
            </motion.div>
            <p className="hint" style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>টিমের যে কেউ লেখা পোস্ট বা আইডিয়া এখানে জমা দেবেন। যিনি শিডিউল করেন, তিনি দেখে &quot;✓ শিডিউল করুন&quot; চাপে শুধু তারিখ, সময় আর পেজ বাছবেন — পোস্টটা ক্যালেন্ডারে চলে যাবে। ঠিক না লাগলে মন্তব্যসহ ফেরত দেওয়া যায়।</p>

            {f && (
                <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '1.0625rem', marginBottom: 10 }}>{f.id ? 'পোস্ট এডিট' : 'নতুন পোস্ট জমা দিন'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group"><label className="form-label">ধরন</label>
                                <input className="form-input" value={f.type_text || ''} onChange={e => setSubmissionEdit({ ...f, type_text: e.target.value })} placeholder="যেমন: স্টোরিটেলিং" />
                            </div>
                            <div className="form-group"><label className="form-label">কে জমা দিচ্ছেন</label>
                                <select className="form-input" value={f._byId || ''} onChange={e => setSubmissionEdit({ ...f, _byId: e.target.value })}>
                                    <option value="">— নাম বাছুন —</option>
                                    {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group"><label className="form-label">শিরোনাম</label>
                            <input className="form-input" value={f.title || ''} onChange={e => setSubmissionEdit({ ...f, title: e.target.value })} placeholder="যেমন: মায়ের হাতের আচারের গল্প" />
                        </div>
                        <div className="form-group"><label className="form-label">পুরো লেখা / ক্যাপশন</label>
                            <textarea className="form-input" rows={5} value={f.caption || ''} onChange={e => setSubmissionEdit({ ...f, caption: e.target.value })} placeholder="পোস্টে যে লেখা যাবে, পুরোটা এখানে লিখুন" />
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.875rem' }}>
                            <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><input type="radio" style={{ marginTop: 3 }} checked={f.status !== 'idea'} onChange={() => setSubmissionEdit({ ...f, status: 'pending' })} /> লেখা তৈরি — অনুমোদনের জন্য পাঠান</label>
                            <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><input type="radio" style={{ marginTop: 3 }} checked={f.status === 'idea'} onChange={() => setSubmissionEdit({ ...f, status: 'idea' })} /> শুধু আইডিয়া — পরে বানানো হবে</label>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={onSave}>জমা দিন</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSubmissionEdit(null)}>বাতিল</button>
                        </div>
                    </div>
                </motion.div>
            )}

            <motion.div variants={item_} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {(['pending', 'returned', 'idea', 'scheduled'] as SubmissionStatus[]).map(s => (
                    <button key={s} onClick={() => setTab(s)}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 600, border: tab === s ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}>
                        {SUBMISSION_STATUS_LABEL[s]}
                        <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: '50%', background: '#B0175A', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            {bn(counts[s])}
                        </span>
                    </button>
                ))}
            </motion.div>

            <motion.div variants={item_} className="card">
                {!list.length && <p className="hint">এই তালিকায় এখনো কিছু নেই।</p>}
                {list.map(x => (
                    <div key={x.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderTop: '1px solid var(--color-border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{x.title}</div>
                            {(x.status === 'pending' || x.status === 'idea') && (
                                <button className="btn btn-sm" style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', border: 'none', whiteSpace: 'nowrap' }} onClick={() => onSchedule(x)}>✓ শিডিউল করুন</button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
                            {x.type_text && <Pill label={x.type_text} bg="var(--color-surface-secondary, #F1F5F9)" color="var(--color-text-secondary)" />}
                            {x.by_employee && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{avatar(x.by_employee.name, null, 16)}{x.by_employee.name}</span>}
                            <span>· জমা {formatDate(x.created_at.slice(0, 10))}</span>
                        </div>
                        {x.status === 'returned' && x.return_note && (
                            <div style={{ fontSize: '0.8125rem', color: '#A15C00', background: 'rgba(161,92,0,0.1)', borderRadius: 8, padding: '6px 10px' }}>মন্তব্য: {x.return_note}</div>
                        )}
                        {x.status === 'scheduled' && x.scheduled_item && (
                            <div style={{ fontSize: '0.8125rem' }}><Pill label={`শিডিউল হয়েছে: ${x.scheduled_item.title}`} bg="rgba(22,163,74,0.1)" color="#16A34A" /></div>
                        )}
                        {x.caption && <div className="hint" style={{ fontSize: '0.8125rem', background: 'var(--color-surface-secondary, #F1F5F9)', borderRadius: 8, padding: '8px 10px', whiteSpace: 'pre-wrap' }}>{x.caption}</div>}
                        {x.status !== 'scheduled' && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => onEdit(x)}>এডিট</button>
                                {x.status !== 'returned' && <button className="btn btn-secondary btn-sm" onClick={() => onReturn(x)}>↩ ফেরত দিন</button>}
                                <button className="btn btn-secondary btn-sm" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => onDelete(x)}>✕ বাদ দিন</button>
                            </div>
                        )}
                    </div>
                ))}
            </motion.div>
        </>
    )
}

// ================= Recurring series =================
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] // Saturday-first, matching the rest of this page's week

function SeriesView({ series, items, types, channels, channelById, month, setMonth, monthStart, monthEnd, seriesEdit, setSeriesEdit, onNew, onEdit, onSave, onDelete, onGenerate, seriesDatesNeeded }: {
    series: Series[]; items: ContentItem[]; types: PostType[]; channels: Channel[]; channelById: (id: string) => Channel
    month: string; setMonth: (m: string) => void; monthStart: string; monthEnd: string
    seriesEdit: Partial<Series> | null; setSeriesEdit: (f: Partial<Series> | null) => void
    onNew: () => void; onEdit: (s: Series) => void; onSave: () => void; onDelete: (s: Series) => void; onGenerate: (s: Series) => void
    seriesDatesNeeded: (s: Series) => string[]
}) {
    const f = seriesEdit
    const toggleDay = (d: number) => { const days = f?.days_of_week || []; setSeriesEdit({ ...f, days_of_week: days.includes(d) ? days.filter(x => x !== d) : [...days, d] }) }
    const toggleChannel = (id: string) => { const ids = f?.channel_ids || []; setSeriesEdit({ ...f, channel_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }) }

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>{formatMonthLabel(month)}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, -1))}><IconChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMonth(currentMonthString())}>এই মাস</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, 1))}><IconChevronRight size={16} /></button>
            </motion.div>

            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h2 style={{ fontSize: '1.0625rem', flex: 1 }}>নিয়মিত সিরিজ</h2>
                <button className="btn" style={{ background: '#B0175A', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '0.9375rem' }} onClick={onNew}><IconPlus size={16} /> নতুন সিরিজ</button>
            </motion.div>
            <p className="hint" style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>যে কন্টেন্ট প্রতি সপ্তাহে একই বারে যায়, যেমন প্রতি শুক্রবার কাস্টমার রিভিউ বা প্রতি মঙ্গলবার লাইভ, সেটা একবার সেট করুন। &quot;বসান&quot; চাপলে বাছাই করা মাসের আজ থেকে বাকি সব তারিখে কন্টেন্ট তৈরি হবে, দায়িত্বও অটো বসবে।</p>

            {f && (
                <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '1.0625rem', marginBottom: 10 }}>{f.id ? 'সিরিজ এডিট' : 'নতুন সিরিজ'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group"><label className="form-label">সিরিজের নাম</label>
                            <input className="form-input" value={f.title || ''} onChange={e => setSeriesEdit({ ...f, title: e.target.value })} placeholder="যেমন: শুক্রবারের কাস্টমার রিভিউ" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group"><label className="form-label">ফরম্যাট</label>
                                <select className="form-input" value={f.type?.id || ''} onChange={e => { const t = types.find(x => x.id === e.target.value); setSeriesEdit({ ...f, type: t ? { id: t.id, name: t.name, kind: t.kind, caption_template: t.caption_template } : undefined }) }}>
                                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label className="form-label">পরের চ্যানেলে কত দিন পর</label>
                                <input className="form-input" type="number" min={0} max={30} value={f.gap_days ?? 0} onChange={e => setSeriesEdit({ ...f, gap_days: Math.max(0, parseInt(e.target.value) || 0) })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">কোন বারে</label>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {WEEK_ORDER.map(d => (
                                    <button key={d} type="button" onClick={() => toggleDay(d)}
                                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--color-border-light)', background: (f.days_of_week || []).includes(d) ? 'var(--color-text-primary)' : 'var(--color-surface)', color: (f.days_of_week || []).includes(d) ? 'var(--color-bg-primary)' : undefined }}>
                                        {BN_DAYS[d]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">কোন চ্যানেলে</label>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {channels.map(c => {
                                    const Icon = PLATFORM_ICON[c.platform]
                                    return (
                                        <button key={c.id} type="button" onClick={() => toggleChannel(c.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--color-border-light)', background: (f.channel_ids || []).includes(c.id) ? PLATFORM_COLOR[c.platform] : 'var(--color-surface)', color: (f.channel_ids || []).includes(c.id) ? '#fff' : undefined }}>
                                            <Icon size={14} />{c.name}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="form-group"><label className="form-label">নোট / স্ক্রিপ্টের ধরন</label>
                            <input className="form-input" value={f.notes || ''} onChange={e => setSeriesEdit({ ...f, notes: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={onSave}>সেভ করুন</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSeriesEdit(null)}>বাতিল</button>
                        </div>
                    </div>
                </motion.div>
            )}

            <motion.div variants={item_} className="card">
                <h3 style={{ fontSize: '1.0625rem', marginBottom: 4 }}>সিরিজ</h3>
                {!series.length && <p className="hint">এখনো কোনো সিরিজ নেই।</p>}
                {series.map(s => {
                    const made = items.filter(i => i.series_id === s.id && i.start_date >= monthStart && i.start_date <= monthEnd).length
                    const need = seriesDatesNeeded(s).length
                    return (
                        <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderTop: '1px solid var(--color-border-light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{s.title}</div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
                                        {s.type.name} · প্রতি {WEEK_ORDER.filter(d => s.days_of_week.includes(d)).map(d => BN_DAYS[d]).join(', ')} · {s.channel_ids.map(id => channelById(id).name).join(', ')}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
                                        {formatMonthLabel(month)}-এ বসানো হয়েছে {bn(made)}টা{need ? `, বাকি ${bn(need)}টা তারিখ` : ''}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(s)}>এডিট</button>
                                        <button className="btn btn-secondary btn-sm" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => onDelete(s)}>মুছুন</button>
                                    </div>
                                </div>
                                {need > 0
                                    ? <button className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => onGenerate(s)}>{formatMonthLabel(month)}-এ বসান ({bn(need)})</button>
                                    : <Pill label="সব বসানো" bg="rgba(22,163,74,0.1)" color="#16A34A" />}
                            </div>
                        </div>
                    )
                })}
            </motion.div>
        </>
    )
}

// ================= Targets =================
interface Clock { elapsed: number; left: number; days: number }
function monthClockOf(monthStart: string, monthEnd: string, todayStr: string, daysInMonthN: number): Clock {
    if (todayStr < monthStart) return { elapsed: 0, left: daysInMonthN, days: daysInMonthN }
    if (todayStr > monthEnd) return { elapsed: daysInMonthN, left: 0, days: daysInMonthN }
    const d = Number(todayStr.slice(8, 10))
    return { elapsed: d, left: daysInMonthN - d + 1, days: daysInMonthN }
}
function analyseTarget(target: number, planned: number, posted: number, clock: Clock) {
    const remaining = Math.max(0, target - posted)
    const needPlan = Math.max(0, target - planned)
    const extra = Math.max(0, posted - target)
    const expected = clock.days ? Math.round(target * clock.elapsed / clock.days) : 0
    const behind = expected - posted
    const perDay = clock.left > 0 ? Math.ceil(remaining / clock.left) : remaining
    let status: string, color: string
    if (!target) { status = 'টার্গেট নেই'; color = 'var(--color-text-tertiary)' }
    else if (posted >= target) { status = extra ? `টার্গেট পূরণ, ${bn(extra)}টা বেশি` : 'টার্গেট পূরণ'; color = '#16A34A' }
    else if (clock.left === 0) { status = `${bn(remaining)}টা কম হয়েছে`; color = '#DC2626' }
    else if (behind > 0) { status = `আজ পর্যন্ত ${bn(behind)}টা পিছিয়ে`; color = '#DC2626' }
    else { status = 'ঠিক পথে আছে'; color = '#16A34A' }
    return { remaining, needPlan, extra, perDay, expected, status, color }
}
interface TargetRow { channel: Channel; target: number; planned: number; posted: number; a: ReturnType<typeof analyseTarget> }
interface TargetTableData { rows: TargetRow[]; tT: number; tP: number; tD: number; totalA: ReturnType<typeof analyseTarget> }

function TargetTable({ title, hint, data, clockLeft }: { title: string; hint?: string; data: TargetTableData; clockLeft: number }) {
    return (
        <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.0625rem', marginBottom: hint ? 4 : 8 }}>{title}</h3>
            {hint && <p className="hint" style={{ margin: '0 0 8px', fontSize: '0.8125rem' }}>{hint}</p>}
            <div style={{ overflowX: 'auto' }}>
                <table className="table">
                    <thead><tr><th>অ্যাকাউন্ট</th><th style={{ textAlign: 'right' }}>টার্গেট</th><th style={{ textAlign: 'right' }}>প্ল্যান</th><th style={{ textAlign: 'right' }}>পোস্টেড</th><th>অগ্রগতি</th><th style={{ textAlign: 'right' }}>বাকি</th><th style={{ textAlign: 'right' }}>দিনে লাগবে</th><th>অবস্থা</th></tr></thead>
                    <tbody>
                        {data.rows.map(r => {
                            return (
                                <tr key={r.channel.id}>
                                    <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChannelIcon channel={r.channel} size={16} />{r.channel.name}</td>
                                    <td style={{ textAlign: 'right' }}>{bn(r.target)}</td>
                                    <td style={{ textAlign: 'right' }}>{bn(r.planned)}</td>
                                    <td style={{ textAlign: 'right' }}>{bn(r.posted)}</td>
                                    <td><TargetBar target={r.target} planned={r.planned} posted={r.posted} expected={r.a.expected} /></td>
                                    <td style={{ textAlign: 'right' }}>{bn(r.a.remaining)}</td>
                                    <td style={{ textAlign: 'right' }}>{clockLeft && r.a.remaining ? bn(r.a.perDay) : '—'}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <span style={{ color: r.a.color, fontWeight: 600 }}>{r.a.status}</span>
                                        {r.a.needPlan > 0 && r.target > 0 && <div style={{ color: '#A15C00', fontSize: '0.75rem' }}>আরো {bn(r.a.needPlan)}টা প্ল্যান করতে হবে</div>}
                                    </td>
                                </tr>
                            )
                        })}
                        <tr style={{ fontWeight: 700 }}>
                            <td>মোট</td><td style={{ textAlign: 'right' }}>{bn(data.tT)}</td><td style={{ textAlign: 'right' }}>{bn(data.tP)}</td><td style={{ textAlign: 'right' }}>{bn(data.tD)}</td>
                            <td><TargetBar target={data.tT} planned={data.tP} posted={data.tD} expected={data.totalA.expected} /></td>
                            <td style={{ textAlign: 'right' }}>{bn(data.totalA.remaining)}</td><td style={{ textAlign: 'right' }}>{clockLeft && data.totalA.remaining ? bn(data.totalA.perDay) : '—'}</td>
                            <td style={{ color: data.totalA.color }}>{data.totalA.status}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </motion.div>
    )
}

function TargetBar({ target, planned, posted, expected }: { target: number; planned: number; posted: number; expected: number }) {
    const max = Math.max(target, planned, posted, 1)
    const pw = Math.min(100, planned / max * 100)
    const po = Math.min(100, posted / max * 100)
    const met = target > 0 && posted >= target
    const mk = target && expected ? Math.min(100, expected / max * 100) : null
    return (
        <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--color-surface-secondary, #F1F5F9)', overflow: 'hidden', minWidth: 80 }}>
            <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pw}%`, borderRadius: 4, background: 'rgba(176,23,90,0.25)' }} />
            <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${po}%`, borderRadius: 4, background: met ? '#16A34A' : '#B0175A' }} />
            {mk != null && <div style={{ position: 'absolute', top: -2, bottom: -2, width: 2, background: 'var(--color-text-primary)', opacity: 0.55, left: `${mk}%` }} />}
        </div>
    )
}

function TargetView({ items, channels, team, month, setMonth, monthStart, monthEnd, todayStr, channelTargets, memberTargets, targetsCustom, targetScope, setTargetScope, targetDraft, setTargetDraft, onSave }: {
    items: ContentItem[]; channels: Channel[]; team: TeamMember[]; month: string; setMonth: (m: string) => void
    monthStart: string; monthEnd: string; todayStr: string
    channelTargets: ChannelTarget[]; memberTargets: MemberTarget[]; targetsCustom: boolean
    targetScope: 'default' | 'month'; setTargetScope: (s: 'default' | 'month') => void
    targetDraft: { channels: Record<string, { posts: string; videos: string }>; members: Record<string, string> }
    setTargetDraft: (d: { channels: Record<string, { posts: string; videos: string }>; members: Record<string, string> }) => void
    onSave: () => void
}) {
    const [y, m] = month.split('-').map(Number)
    const daysInMonthN = new Date(y, m, 0).getDate()
    const clock = monthClockOf(monthStart, monthEnd, todayStr, daysInMonthN)
    const mname = formatMonthLabel(month)

    const monthSlots: { item: ContentItem; slot: Slot }[] = []
    items.forEach(i => i.slots.forEach(s => { if (s.date >= monthStart && s.date <= monthEnd) monthSlots.push({ item: i, slot: s }) }))
    const targetFor = (channelId: string) => channelTargets.find(t => t.channel_id === channelId) || { posts: 0, videos: 0 }

    function buildRows(kind: 'posts' | 'videos') {
        let tT = 0, tP = 0, tD = 0
        const rows = channels.map(c => {
            const list = monthSlots.filter(x => x.slot.channel_id === c.id && (kind === 'posts' || KIND_INFO[x.item.type.kind].isVideo))
            const target = kind === 'posts' ? targetFor(c.id).posts : targetFor(c.id).videos
            const planned = list.length, posted = list.filter(x => x.slot.posted).length
            tT += target; tP += planned; tD += posted
            return { channel: c, target, planned, posted, a: analyseTarget(target, planned, posted, clock) }
        })
        return { rows, tT, tP, tD, totalA: analyseTarget(tT, tP, tD, clock) }
    }
    const P = buildRows('posts')
    const V = buildRows('videos')

    const logsInMonth = items.flatMap(i => i.logs.map(l => ({ log: l }))).filter(x => x.log.at.slice(0, 7) === month)
    const memberRows = team.map(mem => {
        const target = memberTargets.find(t => t.employee_id === mem.id)?.target || 0
        const mine = logsInMonth.filter(x => x.log.by === mem.name)
        const done = mine.length
        const a = analyseTarget(target, Math.max(done, target), done, clock)
        const byStage: Record<string, number> = {}
        mine.forEach(x => { byStage[x.log.stage] = (byStage[x.log.stage] || 0) + 1 })
        const stageText = Object.entries(byStage).map(([k, v]) => `${STAGE_INFO[k as Stage]?.label || k} ${bn(v)}`).join(' · ')
        return { member: mem, target, done, a, stageText }
    })

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>{mname}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, -1))}><IconChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMonth(currentMonthString())}>এই মাস</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, 1))}><IconChevronRight size={16} /></button>
            </motion.div>

            <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                    <div><b style={{ display: 'block', fontSize: '1.5rem' }}>{bn(P.tD)}/{bn(P.tT)}</b><small className="hint">পোস্ট (পোস্টেড / টার্গেট)</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem' }}>{bn(V.tD)}/{bn(V.tT)}</b><small className="hint">ভিডিও (পোস্টেড / টার্গেট)</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem' }}>{bn(P.totalA.remaining)}</b><small className="hint">পোস্ট বাকি</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem' }}>{bn(P.totalA.needPlan)}</b><small className="hint">আরো প্ল্যান করতে হবে</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem' }}>{bn(clock.left)}</b><small className="hint">মাসের দিন বাকি (আজসহ)</small></div>
                </div>
                <p className="hint" style={{ margin: '10px 0 0', fontSize: '0.8125rem' }}>বারে হালকা রং = প্ল্যান করা, গাঢ় রং = পোস্ট হয়েছে, দাগ = আজ পর্যন্ত যতটা হওয়ার কথা। {targetsCustom ? 'এই মাসের জন্য আলাদা টার্গেট সেট করা আছে।' : 'সব মাসের ডিফল্ট টার্গেট দেখাচ্ছে।'}</p>
            </motion.div>

            <TargetTable title={`পোস্টের টার্গেট — ${mname}`} data={P} clockLeft={clock.left} />
            <TargetTable title={`ভিডিওর টার্গেট — ${mname}`} hint="রিল, ইউটিউব ভিডিও আর লাইভ ভিডিও হিসেবে গোনা হয়।" data={V} clockLeft={clock.left} />

            <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.0625rem' }}>টিমের টার্গেট — {mname}</h3>
                <p className="hint" style={{ margin: '0 0 8px', fontSize: '0.8125rem' }}>&quot;শেষ&quot; মানে এ মাসে &quot;… শেষ →&quot; বাটন চেপে যতগুলো ধাপ শেষ করেছেন। এডিটরের জন্য এটা এডিট করা ভিডিওর সংখ্যা।</p>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead><tr><th>সদস্য</th><th style={{ textAlign: 'right' }}>টার্গেট</th><th style={{ textAlign: 'right' }}>শেষ</th><th>অগ্রগতি</th><th style={{ textAlign: 'right' }}>বাকি</th><th style={{ textAlign: 'right' }}>দিনে লাগবে</th><th>অবস্থা</th></tr></thead>
                        <tbody>
                            {memberRows.map(r => (
                                <tr key={r.member.id}>
                                    <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{avatar(r.member.name, r.member.avatar_url, 22)}<div><b>{r.member.name}</b><div className="hint" style={{ fontSize: '0.75rem' }}>{r.member.roles.map(k => CONTENT_ROLES.find(cr => cr.key === k)?.label || k).join(', ')}</div></div></td>
                                    <td style={{ textAlign: 'right' }}>{r.target ? bn(r.target) : '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{bn(r.done)}</td>
                                    <td>{r.target ? <TargetBar target={r.target} planned={0} posted={r.done} expected={r.a.expected} /> : null}</td>
                                    <td style={{ textAlign: 'right' }}>{r.target ? bn(r.a.remaining) : '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{r.target && clock.left && r.a.remaining ? bn(r.a.perDay) : '—'}</td>
                                    <td>
                                        <span style={{ color: r.target ? r.a.color : 'var(--color-text-tertiary)', fontWeight: 600 }}>{r.target ? r.a.status : 'টার্গেট দেওয়া হয়নি'}</span>
                                        {r.stageText && <div className="hint" style={{ fontSize: '0.75rem' }}>{r.stageText}</div>}
                                    </td>
                                </tr>
                            ))}
                            {!memberRows.length && <tr><td colSpan={7} className="hint" style={{ textAlign: 'center', padding: 16 }}>কেউ এখনো কোনো দায়িত্ব পাননি — সেটিংসে গিয়ে দায়িত্ব দিন।</td></tr>}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            <motion.div variants={item_} className="card">
                <h3 style={{ fontSize: '1.0625rem', marginBottom: 6 }}>টার্গেট সেট করুন</h3>
                <p className="hint" style={{ margin: '0 0 8px', fontSize: '0.8125rem' }}>প্রতিটি অ্যাকাউন্টে মাসে কয়টা পোস্ট, তার মধ্যে কয়টা ভিডিও।</p>
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table className="table">
                        <thead><tr><th>অ্যাকাউন্ট</th><th>মাসে পোস্ট</th><th>এর মধ্যে ভিডিও</th></tr></thead>
                        <tbody>
                            {channels.map(c => {
                                const d = targetDraft.channels[c.id] || { posts: '', videos: '' }
                                return (
                                    <tr key={c.id}>
                                        <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChannelIcon channel={c} size={16} />{c.name}</td>
                                        <td><input className="form-input" type="number" min={0} style={{ width: 90 }} value={d.posts} onChange={e => setTargetDraft({ ...targetDraft, channels: { ...targetDraft.channels, [c.id]: { ...d, posts: e.target.value } } })} /></td>
                                        <td><input className="form-input" type="number" min={0} style={{ width: 90 }} value={d.videos} onChange={e => setTargetDraft({ ...targetDraft, channels: { ...targetDraft.channels, [c.id]: { ...d, videos: e.target.value } } })} /></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <h4 style={{ fontSize: '0.9375rem', marginBottom: 6 }}>সদস্যদের মাসিক টার্গেট (কতগুলো কাজ শেষ করবেন)</h4>
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table className="table">
                        <thead><tr><th>সদস্য</th><th>মাসে কাজ</th></tr></thead>
                        <tbody>
                            {team.map(mem => (
                                <tr key={mem.id}>
                                    <td><b>{mem.name}</b><div className="hint" style={{ fontSize: '0.75rem' }}>{mem.roles.map(k => CONTENT_ROLES.find(cr => cr.key === k)?.label || k).join(', ')}</div></td>
                                    <td><input className="form-input" type="number" min={0} placeholder="০" style={{ width: 90 }} value={targetDraft.members[mem.id] || ''} onChange={e => setTargetDraft({ ...targetDraft, members: { ...targetDraft.members, [mem.id]: e.target.value } })} /></td>
                                </tr>
                            ))}
                            {!team.length && <tr><td colSpan={2} className="hint">সেটিংসে গিয়ে প্রথমে টিমের দায়িত্ব দিন।</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.875rem', marginBottom: 12 }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={targetScope === 'default'} onChange={() => setTargetScope('default')} /> {mname} ও পরের সব মাসের জন্য</label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={targetScope === 'month'} onChange={() => setTargetScope('month')} /> শুধু {mname} মাসের জন্য</label>
                </div>
                <button className="btn btn-primary btn-sm" onClick={onSave}>টার্গেট সেভ করুন</button>
            </motion.div>
        </>
    )
}

// ================= Monthly report =================
function ReportPanel({ title, children }: { title: string; children: React.ReactNode }) {
    return <motion.div variants={item_} className="card">
        <h3 style={{ fontSize: '1.0625rem', marginBottom: 8 }}>{title}</h3>
        {children}
    </motion.div>
}

function ReportView({ items, channels, types, occasions, team, channelTargets, memberTargets, month, setMonth, monthStart, monthEnd }: {
    items: ContentItem[]; channels: Channel[]; types: PostType[]; occasions: Occasion[]; team: TeamMember[]
    channelTargets: ChannelTarget[]; memberTargets: MemberTarget[]
    month: string; setMonth: (m: string) => void; monthStart: string; monthEnd: string
}) {
    const toast = useToast()
    const mname = formatMonthLabel(month)

    const monthSlots: { item: ContentItem; slot: Slot }[] = []
    items.forEach(i => i.slots.forEach(s => { if (s.date >= monthStart && s.date <= monthEnd) monthSlots.push({ item: i, slot: s }) }))
    const posted = monthSlots.filter(x => x.slot.posted)
    const sum = (list: typeof posted, key: 'reach' | 'msgs' | 'orders') => list.reduce((t, x) => t + (Number(x.slot[key]) || 0), 0)

    const byAcc = channels.map(c => {
        const l = monthSlots.filter(x => x.slot.channel_id === c.id), p = l.filter(x => x.slot.posted)
        const target = channelTargets.find(t => t.channel_id === c.id)?.posts || 0
        return { channel: c, target, planned: l.length, posted: p.length, msgs: sum(p, 'msgs'), orders: sum(p, 'orders') }
    })
    const tPosts = byAcc.reduce((t, r) => t + r.target, 0)

    const byFmt = types.map(t => {
        const p = posted.filter(x => x.item.type.id === t.id)
        return { name: t.name, posted: p.length, msgs: sum(p, 'msgs'), orders: sum(p, 'orders') }
    }).filter(r => r.posted > 0)

    const byOcc = occasions.map(o => {
        const p = posted.filter(x => x.item.occasion?.id === o.id)
        return { name: o.name, posted: p.length, orders: sum(p, 'orders') }
    }).filter(r => r.posted > 0)

    const logsInMonth = items.flatMap(i => i.logs.map(l => l)).filter(l => l.at.slice(0, 7) === month)
    const byMem = team.map(m => ({ member: m, done: logsInMonth.filter(l => l.by === m.name).length, target: memberTargets.find(t => t.employee_id === m.id)?.target || 0 }))

    const perItem: Record<string, { title: string; orders: number; msgs: number; reach: number }> = {}
    posted.forEach(x => {
        const r = perItem[x.item.id] || (perItem[x.item.id] = { title: x.item.title, orders: 0, msgs: 0, reach: 0 })
        r.orders += Number(x.slot.orders) || 0; r.msgs += Number(x.slot.msgs) || 0; r.reach += Number(x.slot.reach) || 0
    })
    const top = Object.values(perItem).sort((a, b) => b.orders - a.orders || b.msgs - a.msgs).slice(0, 5)

    const prod: Record<string, number> = {}
    posted.forEach(x => { const code = (x.item.product_code || '').trim(); if (code) prod[code] = (prod[code] || 0) + (Number(x.slot.orders) || 0) })
    const topProd = Object.entries(prod).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)

    const late = monthSlots.filter(x => isSlotLate(x.slot)).length
    const reach = sum(posted, 'reach'), msgs = sum(posted, 'msgs'), orders = sum(posted, 'orders')
    const videos = posted.filter(x => KIND_INFO[x.item.type.kind].isVideo).length
    const conv = msgs ? `${bn(Math.round(orders / msgs * 100))}%` : '—'

    function reportText() {
        const L = [`📊 কন্টেন্ট রিপোর্ট — ${mname}`, '', `পোস্ট: ${bn(posted.length)}/${bn(tPosts)} (টার্গেট)`, `ভিডিও পোস্ট: ${bn(videos)}`, `রিচ: ${bn(reach)} · মেসেজ: ${bn(msgs)} · অর্ডার: ${bn(orders)}`, `সময় পার, পোস্ট হয়নি: ${bn(late)}`, '', 'পেজ অনুযায়ী:']
        byAcc.forEach(r => L.push(`• ${r.channel.name}: ${bn(r.posted)}/${bn(r.target)} পোস্ট, ${bn(r.orders)} অর্ডার`))
        if (byFmt.length) { L.push('', 'ফরম্যাট অনুযায়ী অর্ডার:'); byFmt.forEach(r => L.push(`• ${r.name}: ${bn(r.orders)} (${bn(r.posted)}টা পোস্ট)`)) }
        if (top.length) { L.push('', 'সেরা কন্টেন্ট:'); top.forEach((r, k) => L.push(`${bn(k + 1)}. ${r.title} — ${bn(r.orders)} অর্ডার`)) }
        L.push('', 'টিম:'); byMem.forEach(r => L.push(`• ${r.member.name}: ${bn(r.done)}টা কাজ শেষ${r.target ? ` (টার্গেট ${bn(r.target)})` : ''}`))
        return L.join('\n')
    }
    function copyReport() {
        navigator.clipboard?.writeText(reportText()).then(() => toast.success('রিপোর্ট কপি হয়েছে, এখন যেকোনো জায়গায় পেস্ট করুন')).catch(() => toast.error('কপি করা যায়নি'))
    }

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>{mname}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, -1))}><IconChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMonth(currentMonthString())}>এই মাস</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, 1))}><IconChevronRight size={16} /></button>
            </motion.div>

            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h2 style={{ fontSize: '1.0625rem', flex: 1 }}>{mname}-এর রিপোর্ট</h2>
                <button className="btn" style={{ background: '#B0175A', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '0.9375rem' }} onClick={copyReport}><IconClipboard size={16} /> রিপোর্ট কপি করুন</button>
            </motion.div>

            <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
                    <div><b style={{ display: 'block', fontSize: '1.5rem', ...monoNum }}>{bn(posted.length)}/{bn(tPosts)}</b><small className="hint">পোস্ট / টার্গেট</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem', ...monoNum }}>{bn(videos)}</b><small className="hint">ভিডিও পোস্ট</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem', ...monoNum }}>{bn(reach)}</b><small className="hint">রিচ</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem', ...monoNum }}>{bn(msgs)}</b><small className="hint">মেসেজ</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem', ...monoNum }}>{bn(orders)}</b><small className="hint">অর্ডার</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem', ...monoNum }}>{conv}</b><small className="hint">মেসেজ থেকে অর্ডার</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem', color: late ? '#DC2626' : undefined, ...monoNum }}>{bn(late)}</b><small className="hint">সময় পার, পোস্ট হয়নি</small></div>
                </div>
                <p className="hint" style={{ margin: '10px 0 0', fontSize: '0.8125rem' }}>রিচ, মেসেজ আর অর্ডারের হিসাব আসে পোস্টের পর প্রতিটি পেজে লেখা ফলাফল থেকে। না লিখলে এখানে শূন্য দেখাবে।</p>
            </motion.div>

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
                <ReportPanel title="পেজ অনুযায়ী">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead><tr><th>অ্যাকাউন্ট</th><th style={{ textAlign: 'right' }}>টার্গেট</th><th style={{ textAlign: 'right' }}>পোস্টেড</th><th style={{ textAlign: 'right' }}>মেসেজ</th><th style={{ textAlign: 'right' }}>অর্ডার</th><th style={{ textAlign: 'right' }}>পোস্ট প্রতি অর্ডার</th></tr></thead>
                            <tbody>
                                {byAcc.map(r => (
                                    <tr key={r.channel.id}>
                                        <td>{r.channel.name}</td><td style={{ textAlign: 'right' }}>{bn(r.target)}</td>
                                        <td style={{ textAlign: 'right', color: r.posted < r.target ? '#DC2626' : '#16A34A' }}>{bn(r.posted)}</td>
                                        <td style={{ textAlign: 'right' }}>{bn(r.msgs)}</td><td style={{ textAlign: 'right' }}>{bn(r.orders)}</td>
                                        <td style={{ textAlign: 'right' }}>{r.posted ? bn((r.orders / r.posted).toFixed(1)) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ReportPanel>

                <ReportPanel title="ফরম্যাট অনুযায়ী">
                    {byFmt.length ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead><tr><th>ফরম্যাট</th><th style={{ textAlign: 'right' }}>পোস্টেড</th><th style={{ textAlign: 'right' }}>মেসেজ</th><th style={{ textAlign: 'right' }}>অর্ডার</th><th style={{ textAlign: 'right' }}>পোস্ট প্রতি অর্ডার</th></tr></thead>
                                <tbody>
                                    {byFmt.map(r => (
                                        <tr key={r.name}><td>{r.name}</td><td style={{ textAlign: 'right' }}>{bn(r.posted)}</td><td style={{ textAlign: 'right' }}>{bn(r.msgs)}</td><td style={{ textAlign: 'right' }}>{bn(r.orders)}</td><td style={{ textAlign: 'right' }}>{bn((r.orders / r.posted).toFixed(1))}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="hint">এ মাসে এখনো পোস্ট হয়নি।</p>}
                </ReportPanel>

                <ReportPanel title="সেরা ৫ কন্টেন্ট">
                    {top.length ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead><tr><th>কন্টেন্ট</th><th style={{ textAlign: 'right' }}>রিচ</th><th style={{ textAlign: 'right' }}>মেসেজ</th><th style={{ textAlign: 'right' }}>অর্ডার</th></tr></thead>
                                <tbody>
                                    {top.map((r, k) => <tr key={k}><td>{r.title}</td><td style={{ textAlign: 'right' }}>{bn(r.reach)}</td><td style={{ textAlign: 'right' }}>{bn(r.msgs)}</td><td style={{ textAlign: 'right' }}>{bn(r.orders)}</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="hint">ফলাফল লেখা হলে দেখা যাবে।</p>}
                </ReportPanel>

                <ReportPanel title="সবচেয়ে বেশি অর্ডার আনা প্রোডাক্ট">
                    {topProd.length ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead><tr><th>প্রোডাক্ট</th><th style={{ textAlign: 'right' }}>অর্ডার</th></tr></thead>
                                <tbody>{topProd.map(([code, o]) => <tr key={code}><td>{code}</td><td style={{ textAlign: 'right' }}>{bn(o)}</td></tr>)}</tbody>
                            </table>
                        </div>
                    ) : <p className="hint">কন্টেন্টে প্রোডাক্ট কোড আর অর্ডার লেখা হলে দেখা যাবে।</p>}
                </ReportPanel>

                <ReportPanel title="উপলক্ষ অনুযায়ী">
                    {byOcc.length ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead><tr><th>উপলক্ষ</th><th style={{ textAlign: 'right' }}>পোস্টেড</th><th style={{ textAlign: 'right' }}>অর্ডার</th></tr></thead>
                                <tbody>{byOcc.map(r => <tr key={r.name}><td>{r.name}</td><td style={{ textAlign: 'right' }}>{bn(r.posted)}</td><td style={{ textAlign: 'right' }}>{bn(r.orders)}</td></tr>)}</tbody>
                            </table>
                        </div>
                    ) : <p className="hint">এ মাসে কোনো উপলক্ষের কন্টেন্ট পোস্ট হয়নি।</p>}
                </ReportPanel>

                <ReportPanel title="টিম">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead><tr><th>সদস্য</th><th style={{ textAlign: 'right' }}>শেষ করা কাজ</th><th style={{ textAlign: 'right' }}>টার্গেট</th></tr></thead>
                            <tbody>
                                {byMem.map(r => <tr key={r.member.id}><td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{avatar(r.member.name, r.member.avatar_url, 20)}{r.member.name}</td><td style={{ textAlign: 'right' }}>{bn(r.done)}</td><td style={{ textAlign: 'right' }}>{r.target ? bn(r.target) : '—'}</td></tr>)}
                                {!byMem.length && <tr><td colSpan={3} className="hint" style={{ textAlign: 'center', padding: 16 }}>কেউ এখনো কোনো দায়িত্ব পাননি।</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </ReportPanel>
            </div>
        </>
    )
}

// ================= Product rotation =================
interface ProductStat { code: string; name: string; cat: string; inCat: boolean; last: string; next: string; month: number; total: number; orders: number; since: number | null }

function productStats(items: ContentItem[], products: Product[], todayStr: string, monthStart: string, monthEnd: string): ProductStat[] {
    const map: Record<string, ProductStat> = {}
    const get = (code: string) => map[code] || (map[code] = { code, name: '', cat: '', inCat: false, last: '', next: '', month: 0, total: 0, orders: 0, since: null })
    products.forEach(p => { const r = get(p.code); r.name = p.name || ''; r.cat = p.cat || ''; r.inCat = true })
    items.forEach(i => {
        const code = (i.product_code || '').trim()
        if (!code) return
        const r = get(code)
        r.total++
        i.slots.forEach(s => {
            if (s.posted && s.date > r.last) r.last = s.date
            if (!s.posted && s.date >= todayStr && (!r.next || s.date < r.next)) r.next = s.date
            if (s.date >= monthStart && s.date <= monthEnd) r.month++
            r.orders += Number(s.orders) || 0
        })
    })
    return Object.values(map).map(r => ({ ...r, since: r.last ? daysBetween(r.last, todayStr) : null }))
}

function ProductsView({ items, products, monthStart, monthEnd, todayStr, showEdit, setShowEdit, query, setQuery, filter, setFilter, onSave, onAddContent }: {
    items: ContentItem[]; products: Product[]; monthStart: string; monthEnd: string; todayStr: string
    showEdit: boolean; setShowEdit: (v: boolean) => void
    query: string; setQuery: (v: string) => void; filter: 'stale' | 'never' | 'all' | 'top'; setFilter: (v: 'stale' | 'never' | 'all' | 'top') => void
    onSave: (text: string) => void; onAddContent: (code: string, name: string) => void
}) {
    const [draft, setDraft] = useState(() => products.map(p => [p.code, p.name, p.cat].filter((x, k) => k === 0 || x).join(' | ')).join('\n'))
    const stats = productStats(items, products, todayStr, monthStart, monthEnd)
    const stale = stats.filter(r => !r.next && (r.since === null || r.since >= 30)).length
    const never = stats.filter(r => !r.last && !r.next).length

    const q = query.trim().toLowerCase()
    let list = stats
    if (q) list = list.filter(r => (r.code + ' ' + r.name + ' ' + r.cat).toLowerCase().includes(q))
    if (filter === 'stale') list = list.filter(r => !r.next && (r.since === null || r.since >= 30))
    else if (filter === 'never') list = list.filter(r => !r.last && !r.next)
    else if (filter === 'top') list = list.filter(r => r.orders > 0).sort((a, b) => b.orders - a.orders)
    if (filter !== 'top') list = [...list].sort((a, b) => (a.since === null ? -1 : 0) - (b.since === null ? -1 : 0) || (b.since ?? 0) - (a.since ?? 0) || a.code.localeCompare(b.code))
    const shown = list.slice(0, 150)

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>প্রোডাক্ট রোটেশন</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => { if (!showEdit) setDraft(products.map(p => [p.code, p.name, p.cat].filter((x, k) => k === 0 || x).join(' | ')).join('\n')); setShowEdit(!showEdit) }}>
                    {showEdit ? 'তালিকা লুকান' : 'প্রোডাক্ট তালিকা বসান'}
                </button>
            </motion.div>

            <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                    <div><b style={{ display: 'block', fontSize: '1.5rem' }}>{bn(products.length)}</b><small className="hint">তালিকায় প্রোডাক্ট</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem', color: stale ? '#DC2626' : undefined }}>{bn(stale)}</b><small className="hint">৩০ দিনে আসেনি, প্ল্যানেও নেই</small></div>
                    <div><b style={{ display: 'block', fontSize: '1.5rem' }}>{bn(never)}</b><small className="hint">কখনো আসেনি</small></div>
                </div>
                <p className="hint" style={{ margin: '10px 0 0', fontSize: '0.8125rem' }}>কন্টেন্টে প্রোডাক্ট কোড লিখলে সেটা এখানে গোনা হয়। যে প্রোডাক্ট অনেক দিন আসেনি সেগুলো উপরে থাকে।</p>
            </motion.div>

            {showEdit && (
                <motion.div variants={item_} className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '1.0625rem', marginBottom: 6 }}>প্রোডাক্ট তালিকা</h3>
                    <p className="hint" style={{ margin: '0 0 8px', fontSize: '0.8125rem' }}>প্রতি লাইনে একটা: <b>কোড | নাম | ক্যাটাগরি</b>। এক্সেল থেকে তিনটা কলাম কপি করে পেস্ট করলেও হবে।</p>
                    <textarea className="form-input" style={{ minHeight: 220, fontFamily: 'monospace', fontSize: '0.8125rem' }} value={draft} onChange={e => setDraft(e.target.value)} />
                    <div style={{ marginTop: 10 }}><button className="btn btn-primary btn-sm" onClick={() => onSave(draft)}>তালিকা সেভ করুন</button></div>
                </motion.div>
            )}

            <motion.div variants={item_} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ position: 'relative', flex: '1 1 220px' }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                    <input className="form-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="কোড বা নাম দিয়ে খুঁজুন" style={{ paddingLeft: 34, height: 34, fontSize: '0.8125rem', width: '100%' }} />
                </div>
                <select className="form-input" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} style={{ width: 'auto', height: 34, fontSize: '0.8125rem' }}>
                    <option value="stale">৩০ দিনে আসেনি</option>
                    <option value="never">কখনো আসেনি</option>
                    <option value="all">সব প্রোডাক্ট</option>
                    <option value="top">বেশি অর্ডার</option>
                </select>
            </motion.div>

            <motion.div variants={item_} className="card">
                <p className="hint" style={{ margin: '0 0 8px', fontSize: '0.8125rem' }}>{bn(list.length)}টা প্রোডাক্ট{list.length > 150 ? ', প্রথম ১৫০টা দেখাচ্ছে' : ''}</p>
                {!shown.length && <p className="hint">কিছু পাওয়া যায়নি।</p>}
                {shown.map(r => (
                    <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--color-border-light)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}><span style={{ fontFamily: 'monospace' }}>{r.code}</span>{r.name ? ` — ${r.name}` : ''}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
                                {r.cat && <span>{r.cat}</span>}
                                <span>{r.last ? `শেষ পোস্ট ${formatDate(r.last)} (${bn(r.since ?? 0)} দিন আগে)` : 'কখনো পোস্ট হয়নি'}</span>
                                {r.next
                                    ? <Pill label={`পরের পোস্ট ${formatDate(r.next)}`} bg="rgba(22,163,74,0.1)" color="#16A34A" />
                                    : (r.since === null || r.since >= 30) && <Pill label="প্ল্যানে নেই" bg="rgba(220,38,38,0.1)" color="#DC2626" />}
                                <span>· এ মাসে {bn(r.month)}টা</span>
                                {r.orders > 0 && <span>· মোট অর্ডার {bn(r.orders)}</span>}
                                {!r.inCat && <Pill label="তালিকায় নেই" bg="var(--color-surface-secondary, #F1F5F9)" color="var(--color-text-secondary)" />}
                            </div>
                        </div>
                        <button className="btn btn-sm" style={{ background: '#B0175A', color: '#fff', border: 'none', whiteSpace: 'nowrap' }} onClick={() => onAddContent(r.code, r.name)}>+ কন্টেন্ট</button>
                    </div>
                ))}
            </motion.div>
        </>
    )
}

// ================= Settings =================
function SettingsView({ channels, types, team, isSuperAdmin, newChannelDraft, setNewChannelDraft, onSaveNewChannel, toggleChannelActive, deleteChannel, saveChannelField, reorderChannel, uploadChannelPhoto, newTypeDraft, setNewTypeDraft, onSaveNewType, saveTypeField, reorderType, deleteType, toggleTeamActive, toggleTeamTab, selectAllTeamTabs }: {
    channels: Channel[]; types: PostType[]; team: TeamMember[]; isSuperAdmin: boolean
    newChannelDraft: ChannelDraft | null
    setNewChannelDraft: (d: ChannelDraft | null) => void; onSaveNewChannel: () => void
    toggleChannelActive: (c: Channel) => void; deleteChannel: (c: Channel) => void
    saveChannelField: (c: Channel, field: 'name' | 'upload_link' | 'photo_url', value: string) => void; reorderChannel: (c: Channel, direction: -1 | 1) => void
    uploadChannelPhoto: (c: Channel | null, file: File) => void
    newTypeDraft: TypeDraft | null; setNewTypeDraft: (d: TypeDraft | null) => void; onSaveNewType: () => void
    saveTypeField: (t: PostType, field: 'name' | 'kind' | 'caption_template', value: string) => void; reorderType: (t: PostType, direction: -1 | 1) => void
    deleteType: (t: PostType) => void
    toggleTeamActive: (m: TeamMember) => void
    toggleTeamTab: (m: TeamMember, tab: string) => void; selectAllTeamTabs: (m: TeamMember) => void
}) {
    const activeChannelCount = channels.filter(c => c.active).length
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <motion.div variants={item_} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h3 style={{ fontSize: '1.0625rem' }}>চ্যানেল</h3>
                    <span className="hint" style={{ fontSize: '0.8125rem' }}>{bn(activeChannelCount)}টা চালু</span>
                </div>
                <p className="hint" style={{ margin: '0 0 10px', fontSize: '0.8125rem' }}>আপনার প্রতিটি পেজ ও অ্যাকাউন্টের আসল নাম, প্ল্যাটফর্ম আর প্রোফাইল ছবি দিন। লিংকে চাপ দিয়ে বদলান। একই প্ল্যাটফর্মের চ্যানেলগুলোতে পোস্ট পালা করে যায়, তাই ↑ ↓ দিয়ে ক্রম ঠিক করুন। যে চ্যানেলে পোস্ট আছে সেটা মোছা যায় না, &quot;বন্ধ&quot; করে রাখা যায়।</p>
                {channels.map(c => {
                    const group = channels.filter(x => x.platform === c.platform)
                    const posInGroup = group.findIndex(x => x.id === c.id)
                    return (
                        <div key={c.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: 10, padding: 10, marginBottom: 10, opacity: c.active ? 1 : 0.55 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gridTemplateRows: 'auto auto', gap: 8, alignItems: 'center' }}>
                                <div style={{ gridRow: '1 / 3' }}>
                                    <ChannelAvatar photoUrl={c.photo_url} platform={c.platform} onUpload={file => uploadChannelPhoto(c, file)} />
                                </div>
                                <input className="form-input" style={{ gridColumn: 2, gridRow: 1 }} defaultValue={c.name} key={c.id + c.name}
                                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== c.name) saveChannelField(c, 'name', v); else e.target.value = c.name }} />
                                <select className="form-input" style={{ gridColumn: 3, gridRow: 1, width: 140 }} value={c.platform} disabled>
                                    <option value={c.platform}>{PLATFORM_LABEL[c.platform]}</option>
                                </select>
                                <button className="btn btn-ghost btn-icon" style={{ gridColumn: 4, gridRow: 1 }} disabled={posInGroup === 0} onClick={() => reorderChannel(c, -1)} title="উপরে সরান">↑</button>
                                <input className="form-input" style={{ gridColumn: '2 / 4', gridRow: 2 }} defaultValue={c.upload_link || ''} key={c.id + (c.upload_link || '')} placeholder="আপলোড লিংক (ঐচ্ছিক) — যেমন এই পেজের Business Suite লিংক"
                                    onBlur={e => { const v = e.target.value.trim(); if (v !== (c.upload_link || '')) saveChannelField(c, 'upload_link', v) }} />
                                <button className="btn btn-ghost btn-icon" style={{ gridColumn: 4, gridRow: 2 }} disabled={posInGroup === group.length - 1} onClick={() => reorderChannel(c, 1)} title="নিচে সরান">↓</button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                <span className="hint" style={{ fontSize: '0.8125rem' }}>{Number(c.slot_count) > 0 ? `${bn(Number(c.slot_count))}টা পোস্ট` : 'কোনো পোস্ট নেই'}{!c.active ? ' · বন্ধ আছে' : ''}</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => toggleChannelActive(c)}>{c.active ? 'বন্ধ করুন' : 'চালু করুন'}</button>
                                    <button className="btn btn-ghost btn-sm" style={{ color: '#DC2626' }} onClick={() => deleteChannel(c)}>মুছুন</button>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {newChannelDraft && (
                    <div style={{ border: '2px solid #B0175A', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gridTemplateRows: 'auto auto', gap: 8, alignItems: 'center' }}>
                            <div style={{ gridRow: '1 / 3' }}>
                                <ChannelAvatar photoUrl={newChannelDraft.photo_url} platform={newChannelDraft.platform} onUpload={file => uploadChannelPhoto(null, file)} />
                            </div>
                            <input className="form-input" style={{ gridColumn: 2, gridRow: 1 }} autoFocus value={newChannelDraft.name} placeholder="চ্যানেলের নাম"
                                onChange={e => setNewChannelDraft({ ...newChannelDraft, name: e.target.value })} />
                            <select className="form-input" style={{ gridColumn: 3, gridRow: 1, width: 140 }} value={newChannelDraft.platform}
                                onChange={e => setNewChannelDraft({ ...newChannelDraft, platform: e.target.value as Platform })}>
                                {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
                            </select>
                            <input className="form-input" style={{ gridColumn: '2 / 4', gridRow: 2 }} value={newChannelDraft.upload_link} placeholder="আপলোড লিংক (ঐচ্ছিক) — যেমন এই পেজের Business Suite লিংক"
                                onChange={e => setNewChannelDraft({ ...newChannelDraft, upload_link: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <span className="hint" style={{ fontSize: '0.8125rem' }}>এখনো কোনো পোস্ট নেই</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => setNewChannelDraft(null)}>✕ বাতিল</button>
                        </div>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {!newChannelDraft && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setNewChannelDraft({ name: '', platform: 'facebook', upload_link: '', photo_url: '' })}><IconPlus size={14} /> নতুন চ্যানেল</button>
                    )}
                    {newChannelDraft && (
                        <>
                            <button className="btn btn-sm" style={{ background: '#B0175A', color: '#fff', border: 'none' }} disabled={!newChannelDraft.name.trim()} onClick={onSaveNewChannel}>চ্যানেল সেভ করুন</button>
                            <span className="hint" style={{ fontSize: '0.8125rem' }}>সেভ করা হয়নি এমন পরিবর্তন আছে</span>
                        </>
                    )}
                </div>
            </motion.div>

            <motion.div variants={item_} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h3 style={{ fontSize: '1.0625rem' }}>পোস্টের ধরন</h3>
                    <span className="hint" style={{ fontSize: '0.8125rem' }}>{bn(types.length)}টা</span>
                </div>
                <p className="hint" style={{ margin: '0 0 10px', fontSize: '0.8125rem' }}>প্রতিটি ধরনের নাম আর সেটা কীভাবে তৈরি হয় বাছুন — তা থেকে কাজের ধাপ আর দায়িত্ব নিজে থেকে ঠিক হয়; 🎬 ভিডিও আর 🔴 লাইভ ভিডিওর টার্গেটে গোনা হয়। ↑ ↓ দিয়ে ক্রম সাজান।</p>
                {(() => {
                    const sorted = [...types].sort((a, b) => a.sort_order - b.sort_order)
                    return sorted.map((t, i) => (
                        <div key={t.id} style={{ borderTop: '1px solid var(--color-border-light)', padding: '10px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="hint" style={{ width: 18, textAlign: 'center', fontSize: '0.8125rem', flexShrink: 0 }}>{bn(i + 1)}</span>
                                <input className="form-input" style={{ flex: 1 }} defaultValue={t.name} key={t.id + t.name}
                                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.name) saveTypeField(t, 'name', v); else e.target.value = t.name }} />
                                <select className="form-input" style={{ width: 170, flexShrink: 0 }} value={t.kind}
                                    onChange={e => saveTypeField(t, 'kind', e.target.value)}>
                                    {(Object.keys(KIND_INFO) as Kind[]).map(k => <option key={k} value={k}>{KIND_INFO[k].label}</option>)}
                                </select>
                                <button className="btn btn-ghost btn-icon" disabled={i === 0} onClick={() => reorderType(t, -1)} title="উপরে সরান">↑</button>
                                <button className="btn btn-ghost btn-icon" disabled={i === sorted.length - 1} onClick={() => reorderType(t, 1)} title="নিচে সরান">↓</button>
                                <button className="btn btn-ghost btn-icon" style={{ color: '#DC2626' }} onClick={() => deleteType(t)} title="মুছুন">✕</button>
                            </div>
                            <TypeCaptionRow t={t} onSave={v => saveTypeField(t, 'caption_template', v)} />
                        </div>
                    ))
                })()}
                {newTypeDraft && (
                    <div style={{ border: '2px solid #B0175A', borderRadius: 10, padding: 10, marginTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input className="form-input" style={{ flex: 1 }} autoFocus value={newTypeDraft.name} placeholder="ধরনের নাম"
                                onChange={e => setNewTypeDraft({ ...newTypeDraft, name: e.target.value })} />
                            <select className="form-input" style={{ width: 170, flexShrink: 0 }} value={newTypeDraft.kind}
                                onChange={e => setNewTypeDraft({ ...newTypeDraft, kind: e.target.value as Kind })}>
                                {(Object.keys(KIND_INFO) as Kind[]).map(k => <option key={k} value={k}>{KIND_INFO[k].label}</option>)}
                            </select>
                            <button className="btn btn-ghost btn-sm" onClick={() => setNewTypeDraft(null)}>✕ বাতিল</button>
                        </div>
                        <textarea className="form-input" style={{ marginTop: 8, width: '100%' }} rows={2} placeholder="ডিফল্ট ক্যাপশন (ঐচ্ছিক)" value={newTypeDraft.caption_template}
                            onChange={e => setNewTypeDraft({ ...newTypeDraft, caption_template: e.target.value })} />
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    {!newTypeDraft && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setNewTypeDraft({ name: '', kind: 'video', caption_template: '' })}><IconPlus size={14} /> নতুন ধরন</button>
                    )}
                    {newTypeDraft && (
                        <>
                            <button className="btn btn-sm" style={{ background: '#B0175A', color: '#fff', border: 'none' }} disabled={!newTypeDraft.name.trim()} onClick={onSaveNewType}>ধরন সেভ করুন</button>
                            <span className="hint" style={{ fontSize: '0.8125rem' }}>সেভ করা হয়নি এমন পরিবর্তন আছে</span>
                        </>
                    )}
                </div>
            </motion.div>

            <motion.div variants={item_} className="card">
                <h3 style={{ fontSize: '1.0625rem', marginBottom: 6 }}>টিমের দায়িত্ব</h3>
                <p className="hint" style={{ margin: '0 0 10px', fontSize: '0.8125rem' }}>কন্টেন্ট ক্যালেন্ডারে যাদের অ্যাক্সেস আছে তারাই এখানে দেখাবে। প্রত্যেকে কোন কোন ট্যাব দেখতে পারবেন বেছে দিন — কিছু না বাছলে সব ট্যাব দেখা যাবে।</p>
                {team.map(m => {
                    const restricted = m.allowed_tabs.length > 0
                    return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--color-border-light)', flexWrap: 'wrap', opacity: m.active ? 1 : 0.55 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>{avatar(m.name, m.avatar_url, 24)}<b style={{ fontSize: '0.875rem' }}>{m.name}</b>{!m.active && <span className="hint" style={{ fontSize: '0.75rem' }}>বন্ধ আছে</span>}</span>
                            <details style={{ position: 'relative' }}>
                                <summary className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', listStyle: 'none' }}>
                                    {restricted ? `${bn(m.allowed_tabs.length)}/${bn(CONTENT_TABS.length)} ট্যাব` : 'সব ট্যাব'}
                                </summary>
                                <div style={{ position: 'absolute', zIndex: 10, marginTop: 6, padding: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.12)', minWidth: 220 }}>
                                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }} onClick={() => selectAllTeamTabs(m)}>
                                        সব সিলেক্ট করুন
                                    </button>
                                    {CONTENT_TABS.map(t => (
                                        <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={!restricted || m.allowed_tabs.includes(t.key)} onChange={() => toggleTeamTab(m, t.key)} />
                                            {t.label}
                                        </label>
                                    ))}
                                </div>
                            </details>
                            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => toggleTeamActive(m)}>{m.active ? 'বন্ধ করুন' : 'চালু করুন'}</button>
                        </div>
                    )
                })}
                {!isSuperAdmin && <p className="hint" style={{ marginTop: 8 }}>যেকোনো কর্মী এটা পরিবর্তন করতে পারেন।</p>}
            </motion.div>
        </div>
    )
}

// ================= Item Add/Edit modal =================
function ItemModal({ editing, setEditing, types, channels, team, occasions, onClose, onSave, onDelete, onDuplicate, onAddComment, onToggleComment, onCopyCaption }: {
    editing: EditingItem
    setEditing: (e: EditingItem | null) => void
    types: PostType[]; channels: Channel[]; team: TeamMember[]; occasions: Occasion[]
    onClose: () => void; onSave: () => void; onDelete: () => void; onDuplicate: () => void
    onAddComment: (text: string, byId: string) => void; onToggleComment: (id: string) => void
    onCopyCaption: (i: ContentItem, s: Slot) => void
}) {
    const activeTeam = team.filter(m => m.active)
    // Keeps an already-assigned member visible/selectable even after they're deactivated,
    // instead of silently dropping them off the editing item.
    const assigneeOptions = editing.assignee && !activeTeam.some(m => m.id === editing.assignee!.id)
        ? [...activeTeam, ...team.filter(m => m.id === editing.assignee!.id)]
        : activeTeam
    const [commentText, setCommentText] = useState('')
    const [commentBy, setCommentBy] = useState(activeTeam[0]?.id || '')
    const [showMore, setShowMore] = useState(false)
    // Starts empty (not pre-filled with the selected type's name) so every post type the
    // Settings page defines shows up by default — typing only narrows it further from there.
    const [typeQuery, setTypeQuery] = useState('')
    const [customChannelPicker, setCustomChannelPicker] = useState(false)
    const isEdit = !!editing.id
    const selectedType = editing.type
    const byPlatform: Record<Platform, Channel[]> = { facebook: [], instagram: [], tiktok: [], youtube: [] }
    channels.forEach(c => byPlatform[c.platform].push(c))
    const selectedIds = editing._channelIds || []
    const filteredTypes = typeQuery.trim() ? types.filter(t => t.name.toLowerCase().includes(typeQuery.trim().toLowerCase())) : types

    function setType(t: PostType) {
        setEditing({ ...editing, type: { id: t.id, name: t.name, kind: t.kind, caption_template: t.caption_template }, stage: KIND_INFO[t.kind].stages[0], caption: editing.caption?.trim() ? editing.caption : (t.caption_template || '') })
        // Doesn't touch the search box — filling it with the picked name would immediately
        // filter the pill list down to just that match, hiding every other type to pick from.
    }
    function updateSlot(idx: number, patch: Partial<Slot>) {
        const slots = [...(editing.slots || [])]
        slots[idx] = { ...slots[idx], ...patch }
        setEditing({ ...editing, slots })
    }
    // Channel picker is a dropdown of presets (all channels, or a whole platform) plus an
    // explicit "নিজে বাছাই" that reveals the full toggleable pill grid for fine-grained picks —
    // the preview line right below always shows exactly who ends up picked and when.
    function selectChannelGroup(value: string) {
        if (value === '__custom__') { setCustomChannelPicker(true); return }
        setCustomChannelPicker(false)
        if (value === '__all__') setEditing({ ...editing, _channelIds: channels.map(c => c.id) })
        else if (value.startsWith('platform:')) setEditing({ ...editing, _channelIds: byPlatform[value.slice(9) as Platform].map(c => c.id) })
    }
    function toggleChannel(id: string) {
        const ids = editing._channelIds || []
        setEditing({ ...editing, _channelIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] })
    }
    const fullPlatform = (PLATFORMS as readonly Platform[]).find(p => byPlatform[p].length > 0 && byPlatform[p].every(c => selectedIds.includes(c.id)) && selectedIds.length === byPlatform[p].length)
    const channelSelectValue = selectedIds.length === 0 ? ''
        : selectedIds.length === channels.length ? '__all__'
        : fullPlatform ? `platform:${fullPlatform}`
        : '__custom__'
    const showChannelPicker = customChannelPicker || channelSelectValue === '__custom__'
    // Preview of who gets what date — real slot dates once saved, otherwise computed the same
    // way the server will (grouped by platform, staggered by gap_days from the start date).
    const previewSlots: { channelId: string; date: string }[] = isEdit
        ? (editing.slots || []).map(s => ({ channelId: s.channel_id, date: s.date }))
        : editing.start_date
            ? (PLATFORMS as readonly Platform[]).flatMap(p => {
                const ids = selectedIds.filter(id => byPlatform[p].some(c => c.id === id))
                return ids.length ? buildSlotDates(ids, editing.start_date as string, editing.gap_days ?? 3) : []
            })
            : []

    // For content that hasn't been saved yet, keep a draft slot per selected channel (date from
    // the rotation, time from the field above) so "প্রতিটি পেজের তারিখ ও ফলাফল" can show — and let
    // you hand-adjust — each one before it's created. Regenerates only when the channel set,
    // start date or gap actually changes, so a manual per-row edit survives unrelated typing.
    const draftKeyRef = useRef('')
    useEffect(() => {
        if (isEdit) return
        const key = `${[...selectedIds].sort().join(',')}|${editing.start_date || ''}|${editing.gap_days ?? 3}`
        if (key === draftKeyRef.current) return
        draftKeyRef.current = key
        if (!editing.start_date || !selectedIds.length) {
            if ((editing.slots || []).length) setEditing({ ...editing, slots: [] })
            return
        }
        const computed = (PLATFORMS as readonly Platform[]).flatMap(p => {
            const ids = selectedIds.filter(id => byPlatform[p].some(c => c.id === id))
            return ids.length ? buildSlotDates(ids, editing.start_date as string, editing.gap_days ?? 3) : []
        })
        setEditing({ ...editing, slots: computed.map(s => ({ channel_id: s.channelId, date: s.date, time: editing._time || null, posted: false, hook: null, reach: null, msgs: null, orders: null })) })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIds.join(','), editing.start_date, editing.gap_days])

    const stages = selectedType ? KIND_INFO[selectedType.kind].stages : []

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()} style={{ maxWidth: 760, width: '100%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'কন্টেন্ট এডিট' : 'নতুন কন্টেন্ট'}</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={18} /></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}>
                    <div className="form-group">
                        <label className="form-label">কী ধরনের পোস্ট *</label>
                        <input className="form-input" style={{ marginBottom: 6 }} value={typeQuery} onChange={e => setTypeQuery(e.target.value)} placeholder="টাইপ করে খুঁজুন…" />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {filteredTypes.map(t => (
                                <button key={t.id} type="button" onClick={() => setType(t)}
                                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--color-border-light)', background: selectedType?.id === t.id ? 'var(--color-text-primary)' : 'var(--color-surface)', color: selectedType?.id === t.id ? 'var(--color-bg-primary)' : undefined }}>
                                    {t.name}
                                </button>
                            ))}
                            {!filteredTypes.length && <span className="hint" style={{ fontSize: '0.8125rem' }}>কোনো ধরন মিলছে না</span>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">শিরোনাম *</label>
                        <input className="form-input" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="যেমন: মিষ্টি তেঁতুলের ভিডিও" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">ক্যাপশন (ঐচ্ছিক)</label>
                        <textarea className="form-input" rows={3} value={editing.caption || ''} onChange={e => setEditing({ ...editing, caption: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                            <label className="form-label">তারিখ</label>
                            <input className="form-input" type="date" value={editing.start_date || ''} onChange={e => setEditing({ ...editing, start_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">সময় (ঐচ্ছিক)</label>
                            <input className="form-input" type="time" value={editing._time || ''} onChange={e => setEditing({ ...editing, _time: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">কোথায় যাবে *</label>
                        <select className="form-input" value={channelSelectValue} onChange={e => selectChannelGroup(e.target.value)}>
                            <option value="" disabled>— বেছে নিন —</option>
                            <option value="__all__">সব চ্যানেল ({bn(channels.length)})</option>
                            {PLATFORMS.map(p => byPlatform[p].length > 0 && (
                                <option key={p} value={`platform:${p}`}>সব {PLATFORM_LABEL[p]} ({bn(byPlatform[p].length)})</option>
                            ))}
                            <option value="__custom__">নিজে বাছাই...</option>
                        </select>
                        {showChannelPicker && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                                {channels.map(c => (
                                    <button key={c.id} type="button" onClick={() => toggleChannel(c.id)}
                                        style={{ padding: '3px 9px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border-light)', background: selectedIds.includes(c.id) ? PLATFORM_COLOR[c.platform] : 'var(--color-surface)', color: selectedIds.includes(c.id) ? '#fff' : undefined }}>
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        {previewSlots.length > 0 && (
                            <p className="hint" style={{ fontSize: '0.75rem', margin: '6px 0 0' }}>
                                {[...previewSlots].sort((a, b) => a.date.localeCompare(b.date)).map(s => `${channels.find(c => c.id === s.channelId)?.name || '(মুছে ফেলা চ্যানেল)'} ${shortDateBn(s.date)}`).join(' · ')}
                            </p>
                        )}
                    </div>

                    <button type="button" onClick={() => setShowMore(v => !v)} className="hint"
                        style={{ fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', transform: showMore ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                        আরো অপশন
                    </button>

                    {showMore && (
                        <>
                            {stages.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">ধাপ ও দায়িত্ব</label>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                        {stages.map(s => (
                                            <button key={s} type="button" onClick={() => setEditing({ ...editing, stage: s })}
                                                style={{ padding: '3px 9px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border-light)', background: editing.stage === s ? 'var(--color-text-primary)' : 'var(--color-surface)', color: editing.stage === s ? 'var(--color-bg-primary)' : undefined }}>
                                                {STAGE_INFO[s].label}
                                            </button>
                                        ))}
                                    </div>
                                    <select className="form-input" value={editing.assignee?.id || ''} onChange={e => { const m = team.find(x => x.id === e.target.value); setEditing({ ...editing, assignee: m ? { id: m.id, name: m.name } : null }) }}>
                                        <option value="">— বেছে নিন —</option>
                                        {assigneeOptions.map(m => <option key={m.id} value={m.id}>{m.name}{!m.active ? ' (বন্ধ)' : ''}</option>)}
                                    </select>
                                </div>
                            )}

                            {(editing.slots || []).length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">প্রতিটি পেজের তারিখ ও ফলাফল</label>
                                    <div style={{ marginBottom: 8 }}>
                                        <label className="form-label" style={{ fontWeight: 400 }}>পরের পেজে কত দিন পর</label>
                                        <input className="form-input" type="number" min={0} max={30} value={editing.gap_days ?? 3} onChange={e => setEditing({ ...editing, gap_days: Math.max(0, parseInt(e.target.value) || 0) })} />
                                    </div>
                                    {(editing.slots || []).map((s, k) => {
                                        const ch = channels.find(c => c.id === s.channel_id)
                                        return (
                                            <div key={s.id || k} style={{ border: '1px solid var(--color-border-light)', borderRadius: 8, padding: 8, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {ch && <ChannelIcon channel={ch} size={24} />}
                                                    <b style={{ fontSize: '0.8125rem' }}>{ch?.name || '(মুছে ফেলা চ্যানেল)'}</b>
                                                    <input className="form-input" type="date" style={{ width: 150 }} value={s.date} onChange={e => updateSlot(k, { date: e.target.value })} />
                                                    <input className="form-input" type="time" style={{ width: 120 }} value={s.time || ''} onChange={e => updateSlot(k, { time: e.target.value || null })} />
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}>
                                                        <input type="checkbox" checked={s.posted} onChange={e => updateSlot(k, { posted: e.target.checked })} /> পোস্টেড
                                                    </label>
                                                    <button type="button" className="btn btn-ghost btn-icon" title="ক্যাপশন কপি করুন" onClick={() => onCopyCaption(editing as ContentItem, s)}><IconClipboard size={14} /></button>
                                                </div>
                                                {s.posted && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                                                        <input className="form-input" type="number" placeholder="রিচ" value={s.reach ?? ''} onChange={e => updateSlot(k, { reach: e.target.value === '' ? null : Number(e.target.value) })} />
                                                        <input className="form-input" type="number" placeholder="মেসেজ" value={s.msgs ?? ''} onChange={e => updateSlot(k, { msgs: e.target.value === '' ? null : Number(e.target.value) })} />
                                                        <input className="form-input" type="number" placeholder="অর্ডার" value={s.orders ?? ''} onChange={e => updateSlot(k, { orders: e.target.value === '' ? null : Number(e.target.value) })} />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {!(editing.slots || []).length && (
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 400 }}>পরের পেজে কত দিন পর</label>
                                    <input className="form-input" type="number" min={0} max={30} value={editing.gap_days ?? 3} onChange={e => setEditing({ ...editing, gap_days: Math.max(0, parseInt(e.target.value) || 0) })} />
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div className="form-group">
                                    <label className="form-label">উপলক্ষ</label>
                                    <select className="form-input" value={editing.occasion?.id || ''}
                                        onChange={e => { const o = occasions.find(x => x.id === e.target.value); setEditing({ ...editing, occasion: o ? { id: o.id, name: o.name, date: o.date } : null }) }}>
                                        <option value="">— নেই —</option>
                                        {occasions.filter(o => o.date >= getLocalDateString() || o.id === editing.occasion?.id).sort((a, b) => a.date.localeCompare(b.date)).map(o => (
                                            <option key={o.id} value={o.id}>{o.name} — {formatDate(o.date)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">প্রোডাক্ট কোড</label><input className="form-input" placeholder="ঐচ্ছিক" value={editing.product_code || ''} onChange={e => setEditing({ ...editing, product_code: e.target.value })} /></div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">নোট</label>
                                <textarea className="form-input" rows={2} placeholder="টিমের জন্য নির্দেশনা" value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
                            </div>
                        </>
                    )}

                    {isEdit && (
                        <div className="form-group">
                            <label className="form-label">মন্তব্য</label>
                            {(editing.comments || []).map(c => (
                                <div key={c.id} style={{ fontSize: '0.8125rem', padding: '6px 0', borderTop: '1px dashed var(--color-border-light)', opacity: c.done ? 0.55 : 1 }}>
                                    <div className="hint" style={{ fontSize: '0.75rem' }}>{c.by || 'কেউ'} · {formatDate(c.at.slice(0, 10))}{c.done ? ' · ঠিক করা হয়েছে' : ''}</div>
                                    <div>{c.text}</div>
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, fontSize: '0.75rem' }} onClick={() => onToggleComment(c.id)}>{c.done ? 'আবার খুলুন' : '✓ ঠিক করা হয়েছে'}</button>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <select className="form-input" style={{ width: 140 }} value={commentBy} onChange={e => setCommentBy(e.target.value)}>
                                    {activeTeam.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                                <input className="form-input" placeholder="মন্তব্য লিখুন" value={commentText} onChange={e => setCommentText(e.target.value)} />
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onAddComment(commentText, commentBy); setCommentText('') }}>যোগ করুন</button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>বাতিল</button>
                    {isEdit && <button className="btn btn-secondary btn-sm" onClick={onDuplicate}>কপি করুন</button>}
                    {isEdit && <button className="btn btn-secondary btn-sm" style={{ color: '#DC2626' }} onClick={onDelete}>মুছুন</button>}
                    <button className="btn btn-primary btn-sm" onClick={onSave}>{isEdit ? 'সেভ করুন' : 'কন্টেন্ট যোগ করুন'}</button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ================= Bulk add (one day, several posts) =================
function BulkAddModal({ date, types, channels, onClose, onSaveAll }: {
    date: string; types: PostType[]; channels: Channel[]
    onClose: () => void; onSaveAll: (rows: BulkRow[]) => void
}) {
    const byPlatform: Record<Platform, Channel[]> = { facebook: [], instagram: [], tiktok: [], youtube: [] }
    channels.forEach(c => byPlatform[c.platform].push(c))
    const blankRow = (): BulkRow => ({ key: Math.random().toString(36).slice(2), typeId: types[0]?.id || '', date, time: '', channelGroup: '__all__', title: '', caption: '' })
    const [rows, setRows] = useState<BulkRow[]>(() => [blankRow(), blankRow(), blankRow()])
    const [saving, setSaving] = useState(false)

    function updateRow(key: string, patch: Partial<BulkRow>) {
        setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
    }
    function copyRow(idx: number) {
        setRows(prev => { const next = [...prev]; next.splice(idx + 1, 0, { ...prev[idx], key: Math.random().toString(36).slice(2) }); return next })
    }
    function removeRow(key: string) {
        setRows(prev => prev.length > 1 ? prev.filter(r => r.key !== key) : prev)
    }
    async function handleSave() {
        setSaving(true)
        await onSaveAll(rows)
        setSaving(false)
    }

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '100%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">একসাথে অনেকগুলো পোস্ট</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={18} /></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}>
                    <p className="hint" style={{ fontSize: '0.8125rem', margin: 0 }}>প্রতিটি ঘরে একটা পোস্ট — দরকার মতো ধরন বদলান। শুধু শিরোনাম লেখা ঘরগুলো সেভ হবে, ফাঁকা ঘর বাদ যাবে।</p>
                    {rows.map((r, idx) => (
                        <div key={r.key} style={{ border: '1px solid var(--color-border-light)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <b style={{ fontSize: '0.875rem', flex: 1 }}>পোস্ট {bn(idx + 1)}</b>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyRow(idx)}><IconClipboard size={13} /> কপি</button>
                                <button type="button" className="btn btn-ghost btn-icon" disabled={rows.length === 1} onClick={() => removeRow(r.key)}><IconX size={14} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <div className="form-group"><label className="form-label">ধরন</label>
                                    <select className="form-input" value={r.typeId} onChange={e => updateRow(r.key, { typeId: e.target.value })}>
                                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">তারিখ</label>
                                    <input className="form-input" type="date" value={r.date} onChange={e => updateRow(r.key, { date: e.target.value })} />
                                </div>
                                <div className="form-group"><label className="form-label">সময়</label>
                                    <input className="form-input" type="time" value={r.time} onChange={e => updateRow(r.key, { time: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group"><label className="form-label">কোথায়</label>
                                <select className="form-input" value={r.channelGroup} onChange={e => updateRow(r.key, { channelGroup: e.target.value })}>
                                    <option value="__all__">সব চ্যানেল ({bn(channels.length)})</option>
                                    {PLATFORMS.map(p => byPlatform[p].length > 0 && (
                                        <option key={p} value={`platform:${p}`}>সব {PLATFORM_LABEL[p]} ({bn(byPlatform[p].length)})</option>
                                    ))}
                                    {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label className="form-label">শিরোনাম</label>
                                <input className="form-input" value={r.title} onChange={e => updateRow(r.key, { title: e.target.value })} placeholder="যেমন: মিষ্টি তেঁতুলের ভিডিও" />
                            </div>
                            <div className="form-group"><label className="form-label">ক্যাপশন (ঐচ্ছিক)</label>
                                <textarea className="form-input" rows={2} value={r.caption} onChange={e => updateRow(r.key, { caption: e.target.value })} />
                            </div>
                        </div>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRows(prev => [...prev, blankRow()])}><IconPlus size={14} /> আরেকটা পোস্ট</button>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>বাতিল</button>
                    <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>{saving ? 'সেভ হচ্ছে…' : 'সব সেভ করুন'}</button>
                </div>
            </motion.div>
        </motion.div>
    )
}
