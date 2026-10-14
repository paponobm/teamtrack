'use client'

import RequireFeature from '@/components/common/RequireFeature'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { usePermissions } from '@/lib/PermissionsContext'
import { getLocalDateString, getMonthRangeFromString } from '@/lib/dateRange'
import {
    STAGE_INFO, STAGE_ORDER, KIND_INFO, CONTENT_ROLES, PLATFORMS,
    phaseOf, isActivePhase, isItemLate, isSlotLate, firstDateOf, nextStageOf,
    type Stage, type Kind, type Platform,
} from '@/lib/contentCalendar'
import {
    IconPlus, IconX, IconChevronLeft, IconChevronRight,
    IconCalendar, IconLayers, IconUsers, IconWrench, IconClipboard, IconFacebook,
    IconInstagram, IconTikTok, IconYouTube, IconGlobe, IconTarget,
} from '@/components/icons/Icons'

// ---------- Types ----------
interface Channel { id: string; name: string; platform: Platform; photo_url: string | null; upload_link: string | null; active: boolean; sort_order: number; slot_count?: string }
interface PostType { id: string; name: string; kind: Kind; caption_template: string | null; sort_order: number; item_count?: string }
interface TeamMember { id: string; name: string; avatar_url: string | null; roles: string[] }
interface Slot { id?: string; channel_id: string; date: string; posted: boolean; hook: string | null; reach: number | null; msgs: number | null; orders: number | null }
interface LogEntry { id: string; stage: string; by: string | null; at: string }
interface CommentEntry { id: string; text: string; done: boolean; by: string | null; by_employee_id: string | null; at: string }
interface Occasion { id: string; name: string; date: string; lead_days: number; target: number | null; notes: string | null; item_count?: string }
interface ContentItem {
    id: string; title: string; product_code: string | null; caption: string | null; notes: string | null
    stage: string; start_date: string; gap_days: number; stage_since: string | null; created_at: string
    type: { id: string; name: string; kind: Kind; caption_template: string | null }
    assignee: { id: string; name: string } | null
    creator: { id: string; name: string } | null
    occasion: { id: string; name: string; date: string } | null
    slots: Slot[]; logs: LogEntry[]; comments: CommentEntry[]
}

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
function shortDateBn(ds: string) { const dt = new Date(ds); return `${bn(dt.getDate())} ${BN_MONTHS[dt.getMonth()]}` }
function addDaysStr(ds: string, days: number) { const [y, m, d] = ds.split('-').map(Number); const dt = new Date(y, m - 1, d + days); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
function daysBetween(a: string, b: string) { const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number); return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000) }
function formatDate(d: string) { const dt = new Date(d); return `${dt.getDate()} ${BN_MONTHS[dt.getMonth()]}, ${dt.getFullYear()}` }
function formatMonthLabel(month: string) { const [y, m] = month.split('-').map(Number); return `${BN_MONTHS[m - 1]} ${y}` }
function currentMonthString() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function stepMonth(month: string, delta: number) { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function avatar(name: string, url: string | null, size = 24) {
    return url
        ? <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : <span style={{ width: size, height: size, borderRadius: '50%', background: getAvatarColor(name || 'U'), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 700, flexShrink: 0 }}>{(name || 'U')[0]?.toUpperCase()}</span>
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

    const [view, setView] = useState<'month' | 'board' | 'work' | 'pages' | 'occ' | 'settings'>('month')
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<ContentItem[]>([])
    const [channels, setChannels] = useState<Channel[]>([])
    const [types, setTypes] = useState<PostType[]>([])
    const [team, setTeam] = useState<TeamMember[]>([])
    const [occasions, setOccasions] = useState<Occasion[]>([])

    const [month, setMonth] = useState(currentMonthString())
    const [selectedDate, setSelectedDate] = useState(getLocalDateString())
    const [workStage, setWorkStage] = useState('')
    const [workPerson, setWorkPerson] = useState('')
    const [pageChannel, setPageChannel] = useState('')
    const [showPastOcc, setShowPastOcc] = useState(false)

    const [editing, setEditing] = useState<Partial<ContentItem> & { _channelIds?: string[] } | null>(null)
    const [showChannelModal, setShowChannelModal] = useState(false)
    const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
    const [showTypeModal, setShowTypeModal] = useState(false)
    const [editingType, setEditingType] = useState<PostType | null>(null)
    const [showOccModal, setShowOccModal] = useState(false)
    const [editingOcc, setEditingOcc] = useState<Occasion | null>(null)

    useEffect(() => {
        let cancelled = false
        Promise.all([
            fetch('/api/content-calendar/items').then(r => r.json()),
            fetch('/api/content-calendar/channels').then(r => r.json()),
            fetch('/api/content-calendar/types').then(r => r.json()),
            fetch('/api/content-calendar/team').then(r => r.json()),
            fetch('/api/content-calendar/occasions').then(r => r.json()),
        ]).then(([i, c, t, m, o]) => {
            if (cancelled) return
            setItems(i.items || []); setChannels(c.channels || []); setTypes(t.types || []); setTeam(m.team || []); setOccasions(o.occasions || [])
        }).catch(() => { if (!cancelled) toast.error('কন্টেন্ট ক্যালেন্ডার লোড করা যায়নি।') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const channelById = (id: string) => channels.find(c => c.id === id) || { id, name: '(মুছে ফেলা চ্যানেল)', platform: 'facebook' as Platform, photo_url: null, upload_link: null, active: false, sort_order: 0 }
    const activeChannels = channels.filter(c => c.active)
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
                }),
            })
            if (res.ok) {
                const created = await res.json()
                setItems(prev => [created, ...prev]); setEditing(null); toast.success('কন্টেন্ট যোগ হয়েছে')
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
            const added = channelIds.filter(id => !currentChannelIds.includes(id)).map(id => ({ channel_id: id, date: e.start_date, posted: false, hook: null, reach: null, msgs: null, orders: null }))
            payload.slots = [...kept, ...added]
        } else {
            payload.slots = e.slots
        }
        const updated = await saveItemPut(e.id, payload)
        if (updated) { setEditing(null); toast.success('সেভ হয়েছে') }
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
    async function saveChannel(data: { id?: string; name: string; platform: Platform; upload_link: string }) {
        const res = await fetch('/api/content-calendar/channels', {
            method: data.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        if (res.ok) {
            const row = await res.json()
            setChannels(prev => data.id ? prev.map(c => c.id === row.id ? { ...c, ...row } : c) : [...prev, row])
            setShowChannelModal(false); setEditingChannel(null); toast.success('চ্যানেল সেভ হয়েছে')
        } else toast.error((await res.json()).error || 'চ্যানেল সেভ করা যায়নি')
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
    async function saveType(data: { id?: string; name: string; kind: Kind; caption_template: string }) {
        const res = await fetch('/api/content-calendar/types', {
            method: data.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        })
        if (res.ok) {
            const row = await res.json()
            setTypes(prev => data.id ? prev.map(t => t.id === row.id ? { ...t, ...row } : t) : [...prev, row])
            setShowTypeModal(false); setEditingType(null); toast.success('ধরন সেভ হয়েছে')
        } else toast.error((await res.json()).error || 'ধরন সেভ করা যায়নি')
    }
    async function deleteType(t: PostType) {
        if (!confirm(`"${t.name}" মুছে ফেলবেন?`)) return
        const res = await fetch(`/api/content-calendar/types?id=${t.id}`, { method: 'DELETE' })
        if (res.ok) { setTypes(prev => prev.filter(x => x.id !== t.id)); toast.success('ধরন মুছে ফেলা হয়েছে') }
        else toast.error((await res.json()).error || 'মুছে ফেলা যায়নি')
    }
    async function toggleTeamRole(m: TeamMember, role: string) {
        const roles = m.roles.includes(role) ? m.roles.filter(r => r !== role) : [...m.roles, role]
        const res = await fetch('/api/content-calendar/team', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: m.id, roles }) })
        if (res.ok) setTeam(prev => prev.map(x => x.id === m.id ? { ...x, roles } : x))
    }

    // ---------- Occasions ----------
    async function saveOccasion(data: { id?: string; name: string; date: string; lead_days: number; target: string; notes: string }) {
        const res = await fetch('/api/content-calendar/occasions', {
            method: data.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        })
        if (res.ok) {
            const row = await res.json()
            setOccasions(prev => data.id ? prev.map(o => o.id === row.id ? { ...o, ...row } : o) : [...prev, row])
            setShowOccModal(false); setEditingOcc(null); toast.success('উপলক্ষ সেভ হয়েছে')
        } else toast.error((await res.json()).error || 'উপলক্ষ সেভ করা যায়নি')
    }
    async function deleteOccasion(o: Occasion) {
        if (!confirm(`"${o.name}" মুছে ফেলবেন?`)) return
        const res = await fetch(`/api/content-calendar/occasions?id=${o.id}`, { method: 'DELETE' })
        if (res.ok) { setOccasions(prev => prev.filter(x => x.id !== o.id)); toast.success('উপলক্ষ মুছে ফেলা হয়েছে') }
        else toast.error((await res.json()).error || 'মুছে ফেলা যায়নি')
    }

    const TABS: { key: typeof view; label: string; icon: React.ReactNode }[] = [
        { key: 'month', label: 'মাস', icon: <IconCalendar size={14} /> },
        { key: 'board', label: 'প্রোডাকশন', icon: <IconLayers size={14} /> },
        { key: 'work', label: 'কার কী কাজ', icon: <IconUsers size={14} /> },
        { key: 'pages', label: 'পেজ অনুযায়ী', icon: <IconGlobe size={14} /> },
        { key: 'occ', label: 'উপলক্ষ', icon: <IconTarget size={14} /> },
        { key: 'settings', label: 'সেটিংস', icon: <IconWrench size={14} /> },
    ]

    return (
        <RequireFeature slugs={['content']}>
            <motion.div variants={container} initial="hidden" animate="show">
                <motion.div className="page-header" variants={item_}>
                    <div>
                        <h1 className="page-title">কন্টেন্ট ক্যালেন্ডার</h1>
                        <p className="page-subtitle">আইডিয়া থেকে পোস্ট হওয়া পর্যন্ত প্রতিটি সোশ্যাল পোস্ট প্ল্যান, দায়িত্ব ও ট্র্যাক করুন।</p>
                    </div>
                    {view !== 'settings' && (
                        <button className="btn btn-sm" style={{ background: '#B0175A', color: '#fff', border: 'none' }} onClick={() => openAdd()}>
                            <IconPlus size={16} /> নতুন কন্টেন্ট
                        </button>
                    )}
                </motion.div>

                <motion.div variants={item_} style={{ display: 'flex', gap: '6px', padding: '6px', width: 'fit-content', borderRadius: '16px', background: 'rgba(118,118,128,0.08)', marginBottom: '20px' }}>
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setView(t.key)}
                            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: view === t.key ? '#fff' : 'var(--color-text-secondary)' }}>
                            {view === t.key && (
                                <motion.div layoutId="contentCalendarTab" style={{ position: 'absolute', inset: 0, borderRadius: '12px', background: 'linear-gradient(135deg, #B0175A, #8B1047)', zIndex: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>{t.icon}{t.label}</span>
                        </button>
                    ))}
                </motion.div>

                {loading ? (
                    <div className="card" style={{ textAlign: 'center', padding: '60px' }}>লোড হচ্ছে…</div>
                ) : (
                    <>
                        {view === 'month' && (
                            <MonthView {...{ month, setMonth, selectedDate, setSelectedDate, monthStart, monthEnd, todayStr, slotsInRange, channelById, occasions, openAdd, openEdit, togglePosted, copyCaption }} />
                        )}
                        {view === 'board' && (
                            <BoardView {...{ items, month, setMonth, openEdit, advanceStage }} />
                        )}
                        {view === 'work' && (
                            <WorkView {...{ items, team, month, setMonth, workStage, setWorkStage, workPerson, setWorkPerson, openEdit, advanceStage }} />
                        )}
                        {view === 'pages' && (
                            <PagesView {...{ channels: activeChannels, month, setMonth, monthStart, monthEnd, todayStr, pageChannel, setPageChannel, slotsInRange, channelById, openEdit, copyCaption }} />
                        )}
                        {view === 'occ' && (
                            <OccasionsView {...{
                                occasions, items, todayStr, showPastOcc, setShowPastOcc,
                                onAdd: () => { setEditingOcc(null); setShowOccModal(true) },
                                onEdit: (o: Occasion) => { setEditingOcc(o); setShowOccModal(true) },
                                onDelete: deleteOccasion, onAddContent: openAddForOccasion,
                            }} />
                        )}
                        {view === 'settings' && (
                            <SettingsView {...{
                                channels, types, team, isSuperAdmin,
                                onAddChannel: () => { setEditingChannel(null); setShowChannelModal(true) },
                                onEditChannel: (c: Channel) => { setEditingChannel(c); setShowChannelModal(true) },
                                toggleChannelActive, deleteChannel,
                                onAddType: () => { setEditingType(null); setShowTypeModal(true) },
                                onEditType: (t: PostType) => { setEditingType(t); setShowTypeModal(true) },
                                deleteType, toggleTeamRole,
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
                    {showChannelModal && (
                        <ChannelModal channel={editingChannel} onClose={() => { setShowChannelModal(false); setEditingChannel(null) }} onSave={saveChannel} />
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {showTypeModal && (
                        <TypeModal type={editingType} onClose={() => { setShowTypeModal(false); setEditingType(null) }} onSave={saveType} />
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {showOccModal && (
                        <OccasionModal occasion={editingOcc} onClose={() => { setShowOccModal(false); setEditingOcc(null) }} onSave={saveOccasion} />
                    )}
                </AnimatePresence>
            </motion.div>
        </RequireFeature>
    )
}

// ================= Month view =================
function MonthView({ month, setMonth, selectedDate, setSelectedDate, monthStart, monthEnd, todayStr, slotsInRange, channelById, occasions, openAdd, openEdit, togglePosted, copyCaption }: {
    month: string; setMonth: (m: string) => void
    selectedDate: string; setSelectedDate: (d: string) => void; monthStart: string; monthEnd: string; todayStr: string
    slotsInRange: (a: string, b: string) => { item: ContentItem; slot: Slot }[]
    channelById: (id: string) => Channel; occasions: Occasion[]; openAdd: (d?: string) => void; openEdit: (i: ContentItem) => void
    togglePosted: (i: ContentItem, s: Slot) => void; copyCaption: (i: ContentItem, s: Slot) => void
}) {
    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Monday-first grid
    const monthSlots = slotsInRange(monthStart, monthEnd)
    const posted = monthSlots.filter(x => x.slot.posted).length
    const late = monthSlots.filter(x => isSlotLate(x.slot)).length
    const occasionsOn = (ds: string) => occasions.filter(o => o.date === ds)
    const isLeadDay = (ds: string) => occasions.some(o => ds < o.date && daysBetween(ds, o.date) <= o.lead_days)
    const nextOccasion = occasions.filter(o => o.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0]

    const cells: React.ReactNode[] = []
    const WD = ['সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি', 'রবি']
    WD.forEach(w => cells.push(<div key={'wd' + w} style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '2px 0', textTransform: 'uppercase' }}>{w}</div>))
    for (let k = 0; k < firstDow; k++) cells.push(<div key={'b' + k} />)
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const list = slotsInRange(ds, ds)
        const dayLate = list.some(x => isSlotLate(x.slot)), dayDone = list.length > 0 && list.every(x => x.slot.posted)
        const dotColor = !list.length ? undefined : dayLate ? '#DC2626' : dayDone ? '#16A34A' : '#A15C00'
        const isToday = ds === todayStr, isSel = ds === selectedDate
        const occs = occasionsOn(ds), lead = !occs.length && isLeadDay(ds)
        cells.push(
            <button key={ds} onClick={() => setSelectedDate(ds)}
                style={{
                    minHeight: 58, padding: '4px 5px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                    background: isToday ? '#B0175A' : 'var(--color-surface-secondary, #F8FAFC)',
                    border: isSel ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-light)',
                    boxShadow: lead ? 'inset 0 3px 0 #6A3FC8' : undefined,
                    color: isToday ? '#fff' : undefined, display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                    {d}{dotColor && <span style={{ width: 7, height: 7, borderRadius: '50%', background: isToday ? '#fff' : dotColor, display: 'inline-block' }} />}
                </span>
                {occs.map(o => <span key={o.id} style={{ fontSize: '0.625rem', fontWeight: 700, borderRadius: 3, padding: '1px 3px', background: isToday ? 'rgba(255,255,255,0.25)' : 'rgba(106,63,200,0.1)', color: isToday ? '#fff' : '#6A3FC8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>)}
                {list.length > 0 && <span style={{ fontSize: '0.6875rem', opacity: 0.85 }}>{list.length}টা পোস্ট</span>}
            </button>
        )
    }

    const dayList = slotsInRange(selectedDate, selectedDate)

    return (
        <>
            {nextOccasion && (
                <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#B0175A', color: '#fff', marginBottom: 12 }}>
                    <b>আজ {BN_DAYS[new Date(todayStr).getDay()]}, {formatDate(todayStr)}</b>
                    <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>· পরের উপলক্ষ: {nextOccasion.name} {daysBetween(todayStr, nextOccasion.date) === 0 ? 'আজ' : `আর ${bn(daysBetween(todayStr, nextOccasion.date))} দিন`}</span>
                </motion.div>
            )}
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>{formatMonthLabel(month)}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, -1))}><IconChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMonth(currentMonthString())}>এই মাস</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setMonth(stepMonth(month, 1))}><IconChevronRight size={16} /></button>
            </motion.div>

            <motion.div variants={item_} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div className="stat-card"><span className="stat-label">প্ল্যান করা পোস্ট</span><span className="stat-value" style={{ fontSize: '1.5rem' }}>{monthSlots.length}</span></div>
                <div className="stat-card"><span className="stat-label">পোস্ট হয়েছে</span><span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>{posted}</span></div>
                <div className="stat-card"><span className="stat-label">সময় পার, পোস্ট হয়নি</span><span className="stat-value" style={{ fontSize: '1.5rem', color: late ? '#DC2626' : undefined }}>{late}</span></div>
            </motion.div>

            <motion.div variants={item_} className="card" style={{ padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 }}>{cells}</div>
            </motion.div>

            <motion.div variants={item_} className="card" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.0625rem', flex: 1, minWidth: 0 }}>{formatDate(selectedDate)}{selectedDate === todayStr ? ' — আজ' : ''}</h3>
                    <button className="btn btn-secondary btn-sm" onClick={() => openAdd(selectedDate)}><IconPlus size={14} /> এই তারিখে নতুন</button>
                </div>
                {dayList.length === 0 ? (
                    <p className="hint" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>এই তারিখে কিছু প্ল্যান করা নেই।</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {dayList.map(({ item, slot }) => {
                            const ch = channelById(slot.channel_id)
                            const Icon = PLATFORM_ICON[ch.platform]
                            const phase = phaseOf(item)
                            return (
                                <div key={(slot.id || slot.channel_id) + item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--color-border-light)', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: PLATFORM_COLOR[ch.platform] }}><Icon size={16} /><b style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>{ch.name}</b></span>
                                    <div style={{ flex: 1, minWidth: 160, cursor: 'pointer' }} onClick={() => openEdit(item)}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.title}</div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                            {isActivePhase(item) && <Pill label={`এখনো ${STAGE_INFO[item.stage as Stage]?.label}`} {...stagePillStyle(phase)} />}
                                            {item.occasion && <Pill label={`🎯 ${item.occasion.name}`} bg="rgba(106,63,200,0.1)" color="#6A3FC8" />}
                                            {item.assignee && <span>{item.assignee.name}</span>}
                                        </div>
                                    </div>
                                    <button className="btn btn-sm" style={{ background: slot.posted ? 'rgba(22,163,74,0.12)' : 'var(--color-surface-secondary, #F1F5F9)', color: slot.posted ? '#16A34A' : undefined, border: 'none' }} onClick={() => togglePosted(item, slot)}>
                                        {slot.posted ? '✓ পোস্টেড' : 'পোস্ট হয়েছে'}
                                    </button>
                                    {!slot.posted && (
                                        <>
                                            <button className="btn btn-ghost btn-icon" title="ক্যাপশন কপি করুন" onClick={() => copyCaption(item, slot)}><IconClipboard size={15} /></button>
                                            <a className="btn btn-ghost btn-icon" title={`${UPLOAD_NAME[ch.platform]} খুলুন`} href={ch.upload_link || UPLOAD_LINK[ch.platform]} target="_blank" rel="noopener noreferrer">↗</a>
                                        </>
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
function BoardView({ items, month, setMonth, openEdit, advanceStage }: {
    items: ContentItem[]; month: string; setMonth: (m: string) => void; openEdit: (i: ContentItem) => void; advanceStage: (i: ContentItem) => void
}) {
    const cols = STAGE_ORDER.filter(s => s !== 'ready').map(s => ({ key: s, label: STAGE_INFO[s].label, items: items.filter(i => isActivePhase(i) && i.stage === s) }))
        .filter(c => c.items.length > 0)
    const ready = items.filter(i => phaseOf(i) === 'ready')
    const done = items.filter(i => phaseOf(i) === 'done')

    function Card({ it }: { it: ContentItem }) {
        const phase = phaseOf(it)
        const next = nextStageOf(it.type.kind, it.stage)
        return (
            <div className="card" style={{ padding: 10, borderLeft: `4px solid ${stagePillStyle(phase).color}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }} onClick={() => openEdit(it)}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{it.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Pill label={phase === 'done' ? 'সব পোস্টেড' : phase === 'ready' ? 'পোস্টের জন্য প্রস্তুত' : STAGE_INFO[it.stage as Stage]?.label} {...stagePillStyle(phase)} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{it.type.name}</span>
                    {isItemLate(it) && <Pill label="দেরি" bg="rgba(220,38,38,0.1)" color="#DC2626" />}
                    {it.occasion && <Pill label={`🎯 ${it.occasion.name}`} bg="rgba(106,63,200,0.1)" color="#6A3FC8" />}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{it.assignee ? <>{avatar(it.assignee.name, null, 18)}{it.assignee.name}</> : <span className="hint">দায়িত্ব দেওয়া হয়নি</span>}</span>
                    {isActivePhase(it) && next && (
                        <button className="btn btn-sm" style={{ background: 'rgba(176,23,90,0.1)', color: '#B0175A', border: 'none', fontSize: '0.75rem' }}
                            onClick={e => { e.stopPropagation(); advanceStage(it) }}>{STAGE_INFO[it.stage as Stage].label} শেষ →</button>
                    )}
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
            <p className="hint" style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>প্রতিটি ধাপের জন্য আলাদা কলাম। প্রতিটি পোস্ট ফরম্যাটের নিজস্ব ধাপ আছে, আর প্রতি ধাপে সঠিক ব্যক্তি অটো দায়িত্ব পান।</p>
            <motion.div variants={item_} style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                {cols.map(c => (
                    <div key={c.key} style={{ flex: '0 0 260px', background: 'var(--color-surface-secondary, #F1F5F9)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <h3 style={{ fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>{c.label}<span className="hint">{c.items.length}</span></h3>
                        {c.items.map(it => <Card key={it.id} it={it} />)}
                    </div>
                ))}
                {[{ key: 'ready', label: 'পোস্টের জন্য প্রস্তুত', items: ready }, { key: 'done', label: 'সব পোস্টেড', items: done }].map(c => (
                    <div key={c.key} style={{ flex: '0 0 260px', background: 'var(--color-surface-secondary, #F1F5F9)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <h3 style={{ fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>{c.label}<span className="hint">{c.items.length}</span></h3>
                        {c.items.map(it => <Card key={it.id} it={it} />)}
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
                    <b style={{ display: 'block', fontSize: '1.25rem' }}>{active.length}</b><small className="hint">সব ধাপ</small>
                </button>
                {stageCounts.map(s => (
                    <button key={s.key} onClick={() => setWorkStage(s.key)} style={{ flex: '0 0 auto', padding: '8px 12px', borderRadius: 10, border: workStage === s.key ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-light)', background: 'var(--color-surface)', minWidth: 90, textAlign: 'left' }}>
                        <b style={{ display: 'block', fontSize: '1.25rem' }}>{s.count}</b><small className="hint">{s.label}</small>
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
                                    <td style={{ textAlign: 'right' }}>{r.pending}</td>
                                    <td style={{ textAlign: 'right', color: r.late ? '#DC2626' : undefined }}>{r.late}</td>
                                    <td style={{ textAlign: 'right' }}>{r.done}</td>
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
                {queue.map(it => (
                    <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--color-border-light)' }}>
                        <div style={{ textAlign: 'center', background: isItemLate(it) ? 'rgba(220,38,38,0.08)' : 'var(--color-surface-secondary, #F1F5F9)', borderRadius: 8, padding: '3px 0' }}>
                            <b style={{ display: 'block', fontSize: '1rem' }}>{firstDateOf(it).slice(8, 10)}</b><small className="hint">{firstDateOf(it).slice(5, 7)}/{firstDateOf(it).slice(0, 4)}</small>
                        </div>
                        <div style={{ cursor: 'pointer', minWidth: 0 }} onClick={() => openEdit(it)}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{it.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{STAGE_INFO[it.stage as Stage]?.label} · {it.type.name}{!workPerson && it.assignee ? ` · ${it.assignee.name}` : ''}</div>
                        </div>
                        {nextStageOf(it.type.kind, it.stage) && (
                            <button className="btn btn-sm" style={{ background: 'rgba(176,23,90,0.1)', color: '#B0175A', border: 'none' }} onClick={() => advanceStage(it)}>{STAGE_INFO[it.stage as Stage].label} শেষ →</button>
                        )}
                    </div>
                ))}
            </motion.div>

            <motion.div variants={item_} className="card">
                <h3 style={{ fontSize: '1.0625rem', marginBottom: 8 }}>এ মাসে শেষ করা কাজ — {workPerson ? team.find(m => m.id === workPerson)?.name : 'সবাই'}</h3>
                {!finished.length && <p className="hint">এখনো কিছু রেকর্ড হয়নি।</p>}
                {finished.map((x, k) => (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 10, padding: '6px 0', borderTop: '1px solid var(--color-border-light)', alignItems: 'center', fontSize: '0.875rem' }}>
                        <span className="hint">{formatDate(x.log.at.slice(0, 10))}</span>
                        <span style={{ cursor: 'pointer' }} onClick={() => openEdit(x.item)}>{x.item.title}</span>
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
    const Icon = PLATFORM_ICON[ch.platform]
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

            <motion.div variants={item_} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {channels.map(c => {
                    const CIcon = PLATFORM_ICON[c.platform]
                    return (
                        <button key={c.id} onClick={() => setPageChannel(c.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, border: c.id === current ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}>
                            <span style={{ color: PLATFORM_COLOR[c.platform] }}><CIcon size={16} /></span>{c.name}<span className="hint">{bn(countFor(c.id))}</span>
                        </button>
                    )
                })}
            </motion.div>

            <motion.div variants={item_} className="card">
                <h3 style={{ fontSize: '1.0625rem', display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={18} />{ch.name} — {formatMonthLabel(month)}</h3>
                <p className="hint" style={{ margin: '0 0 4px', fontSize: '0.8125rem' }}>আজ থেকে মাসের শেষ পর্যন্ত প্রতিটি দিন, আর আগের যেসব দিনে পোস্ট ছিল। একই কন্টেন্ট অন্য কোন পেজে কবে যাচ্ছে তাও দেখা যাবে।</p>
                {rows.length ? rows : <p className="hint">এই মাসে এই অ্যাকাউন্টে কিছু নেই।</p>}
            </motion.div>
        </>
    )
}

// ================= Occasions =================
function OccasionsView({ occasions, items, todayStr, showPastOcc, setShowPastOcc, onAdd, onEdit, onDelete, onAddContent }: {
    occasions: Occasion[]; items: ContentItem[]; todayStr: string; showPastOcc: boolean; setShowPastOcc: (v: boolean) => void
    onAdd: () => void; onEdit: (o: Occasion) => void; onDelete: (o: Occasion) => void; onAddContent: (o: Occasion) => void
}) {
    const upcoming = occasions.filter(o => o.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))
    const gone = occasions.filter(o => o.date < todayStr).sort((a, b) => b.date.localeCompare(a.date))

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
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, padding: '12px 0', borderTop: '1px solid var(--color-border-light)', opacity: n < 0 ? 0.6 : 1 }}>
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
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                        {n >= 0 && <button className="btn btn-ghost btn-sm" onClick={() => onAddContent(o)}>+ এই উপলক্ষে কন্টেন্ট</button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(o)}>এডিট</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: '#DC2626' }} onClick={() => onDelete(o)}>মুছুন</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <motion.div variants={item_} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h2 style={{ fontSize: '1.25rem', flex: 1 }}>উপলক্ষ ও সিজন</h2>
                <button className="btn btn-sm" style={{ background: '#B0175A', color: '#fff', border: 'none' }} onClick={onAdd}><IconPlus size={14} /> নতুন উপলক্ষ</button>
            </motion.div>
            <p className="hint" style={{ margin: '0 0 16px', fontSize: '0.8125rem' }}>প্রতিটি উপলক্ষের তারিখ আর কত দিন আগে থেকে কাজ শুরু হবে তা দিন। ক্যালেন্ডারে উপলক্ষের দিনে নাম দেখাবে, আর প্রস্তুতির দিনগুলোর উপরে বেগুনি দাগ থাকবে। কন্টেন্ট যোগ করার সময় উপলক্ষ বেছে নিলে এখানে হিসাব দেখা যাবে।</p>

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

function OccasionModal({ occasion, onClose, onSave }: { occasion: Occasion | null; onClose: () => void; onSave: (d: { id?: string; name: string; date: string; lead_days: number; target: string; notes: string }) => void }) {
    const [name, setName] = useState(occasion?.name || '')
    const [date, setDate] = useState(occasion?.date || '')
    const [leadDays, setLeadDays] = useState(occasion?.lead_days ?? 14)
    const [target, setTarget] = useState(occasion?.target != null ? String(occasion.target) : '')
    const [notes, setNotes] = useState(occasion?.notes || '')
    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 440, width: '100%' }}>
                <div className="modal-header"><h2 className="modal-title">{occasion ? 'উপলক্ষ এডিট' : 'নতুন উপলক্ষ'}</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={18} /></button></div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group"><label className="form-label">নাম *</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="যেমন: ঈদুল ফিতর, ১১.১১ সেল" /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group"><label className="form-label">তারিখ *</label><input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">কত দিন আগে প্রস্তুতি</label><input className="form-input" type="number" min={0} max={120} value={leadDays} onChange={e => setLeadDays(Math.max(0, parseInt(e.target.value) || 0))} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">পোস্টের টার্গেট (ঐচ্ছিক)</label><input className="form-input" type="number" min={0} value={target} onChange={e => setTarget(e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">নোট</label><input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="যেমন: চাঁদ দেখার উপর নির্ভর করে" /></div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>বাতিল</button>
                    <button className="btn btn-primary btn-sm" disabled={!name.trim() || !date} onClick={() => onSave({ id: occasion?.id, name: name.trim(), date, lead_days: leadDays, target, notes: notes.trim() })}>সেভ করুন</button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ================= Settings =================
function SettingsView({ channels, types, team, isSuperAdmin, onAddChannel, onEditChannel, toggleChannelActive, deleteChannel, onAddType, onEditType, deleteType, toggleTeamRole }: {
    channels: Channel[]; types: PostType[]; team: TeamMember[]; isSuperAdmin: boolean
    onAddChannel: () => void; onEditChannel: (c: Channel) => void; toggleChannelActive: (c: Channel) => void; deleteChannel: (c: Channel) => void
    onAddType: () => void; onEditType: (t: PostType) => void; deleteType: (t: PostType) => void
    toggleTeamRole: (m: TeamMember, role: string) => void
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <motion.div variants={item_} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h3 style={{ fontSize: '1.0625rem' }}>চ্যানেল</h3>
                    <button className="btn btn-sm" style={{ background: '#B0175A', color: '#fff', border: 'none' }} onClick={onAddChannel}><IconPlus size={14} /> চ্যানেল যোগ করুন</button>
                </div>
                <p className="hint" style={{ margin: '0 0 10px', fontSize: '0.8125rem' }}>চ্যানেল শুধু সংগঠনের জন্য নাম — নাম, প্ল্যাটফর্ম আর ঐচ্ছিক একটা লিংক (যেমন Meta Business Suite)। পোস্ট করা অটো হয় না।</p>
                {channels.map(c => {
                    const Icon = PLATFORM_ICON[c.platform]
                    return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--color-border-light)', opacity: c.active ? 1 : 0.55 }}>
                            <span style={{ color: PLATFORM_COLOR[c.platform] }}><Icon size={18} /></span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <b style={{ fontSize: '0.875rem' }}>{c.name}</b>
                                <div className="hint" style={{ fontSize: '0.75rem' }}>{PLATFORM_LABEL[c.platform]}{Number(c.slot_count) > 0 ? ` · ${c.slot_count} পোস্ট` : ''}{!c.active ? ' · বন্ধ আছে' : ''}</div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => onEditChannel(c)}>এডিট</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleChannelActive(c)}>{c.active ? 'বন্ধ করুন' : 'চালু করুন'}</button>
                            {!Number(c.slot_count) && <button className="btn btn-ghost btn-sm" style={{ color: '#DC2626' }} onClick={() => deleteChannel(c)}>মুছুন</button>}
                        </div>
                    )
                })}
            </motion.div>

            <motion.div variants={item_} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h3 style={{ fontSize: '1.0625rem' }}>পোস্টের ধরন</h3>
                    <button className="btn btn-sm" style={{ background: '#B0175A', color: '#fff', border: 'none' }} onClick={onAddType}><IconPlus size={14} /> ধরন যোগ করুন</button>
                </div>
                <p className="hint" style={{ margin: '0 0 10px', fontSize: '0.8125rem' }}>প্রতিটি ধরনের “কীভাবে তৈরি হয়” ঠিক করে এটা কোন ধাপে যাবে আর ভিডিও হিসেবে গোনা হবে কিনা।</p>
                {types.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--color-border-light)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <b style={{ fontSize: '0.875rem' }}>{t.name}</b>
                            <div className="hint" style={{ fontSize: '0.75rem' }}>{KIND_INFO[t.kind].label}{Number(t.item_count) > 0 ? ` · ${t.item_count} পোস্ট` : ''}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => onEditType(t)}>এডিট</button>
                        {!Number(t.item_count) && <button className="btn btn-ghost btn-sm" style={{ color: '#DC2626' }} onClick={() => deleteType(t)}>মুছুন</button>}
                    </div>
                ))}
            </motion.div>

            <motion.div variants={item_} className="card">
                <h3 style={{ fontSize: '1.0625rem', marginBottom: 6 }}>টিমের দায়িত্ব</h3>
                <p className="hint" style={{ margin: '0 0 10px', fontSize: '0.8125rem' }}>প্রত্যেকে কী কাজ করেন বেছে নিন। যার হাতে কাজ সবচেয়ে কম, অটো তাঁর কাছে যাবে।</p>
                {team.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--color-border-light)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>{avatar(m.name, m.avatar_url, 24)}<b style={{ fontSize: '0.875rem' }}>{m.name}</b></span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {CONTENT_ROLES.map(r => (
                                <button key={r.key} onClick={() => toggleTeamRole(m, r.key)}
                                    style={{ padding: '3px 9px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border-light)', background: m.roles.includes(r.key) ? 'var(--color-text-primary)' : 'var(--color-surface)', color: m.roles.includes(r.key) ? 'var(--color-bg-primary)' : undefined }}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                {!isSuperAdmin && <p className="hint" style={{ marginTop: 8 }}>যেকোনো কর্মী এটা পরিবর্তন করতে পারেন — এটা শুধু ঠিক করে কাকে অটো দায়িত্ব দেওয়া হবে।</p>}
            </motion.div>
        </div>
    )
}

// ================= Item Add/Edit modal =================
function ItemModal({ editing, setEditing, types, channels, team, occasions, onClose, onSave, onDelete, onDuplicate, onAddComment, onToggleComment, onCopyCaption }: {
    editing: Partial<ContentItem> & { _channelIds?: string[] }
    setEditing: (e: (Partial<ContentItem> & { _channelIds?: string[] }) | null) => void
    types: PostType[]; channels: Channel[]; team: TeamMember[]; occasions: Occasion[]
    onClose: () => void; onSave: () => void; onDelete: () => void; onDuplicate: () => void
    onAddComment: (text: string, byId: string) => void; onToggleComment: (id: string) => void
    onCopyCaption: (i: ContentItem, s: Slot) => void
}) {
    const [commentText, setCommentText] = useState('')
    const [commentBy, setCommentBy] = useState(team[0]?.id || '')
    const isEdit = !!editing.id
    const selectedType = editing.type
    const byPlatform: Record<Platform, Channel[]> = { facebook: [], instagram: [], tiktok: [], youtube: [] }
    channels.forEach(c => byPlatform[c.platform].push(c))

    function setType(t: PostType) {
        setEditing({ ...editing, type: { id: t.id, name: t.name, kind: t.kind, caption_template: t.caption_template }, stage: KIND_INFO[t.kind].stages[0], caption: editing.caption?.trim() ? editing.caption : (t.caption_template || '') })
    }
    function toggleChannel(id: string) {
        const ids = editing._channelIds || []
        setEditing({ ...editing, _channelIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] })
    }
    function updateSlot(idx: number, patch: Partial<Slot>) {
        const slots = [...(editing.slots || [])]
        slots[idx] = { ...slots[idx], ...patch }
        setEditing({ ...editing, slots })
    }

    const stages = selectedType ? KIND_INFO[selectedType.kind].stages : []

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '100%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'কন্টেন্ট এডিট' : 'নতুন কন্টেন্ট'}</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={18} /></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}>
                    <div className="form-group">
                        <label className="form-label">পোস্টের ধরন *</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {types.map(t => (
                                <button key={t.id} type="button" onClick={() => setType(t)}
                                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--color-border-light)', background: selectedType?.id === t.id ? 'var(--color-text-primary)' : 'var(--color-surface)', color: selectedType?.id === t.id ? 'var(--color-bg-primary)' : undefined }}>
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">শিরোনাম *</label>
                        <input className="form-input" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="যেমন: মিষ্টি তেঁতুলের ভিডিও" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">ক্যাপশন</label>
                        <textarea className="form-input" rows={3} value={editing.caption || ''} onChange={e => setEditing({ ...editing, caption: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                            <label className="form-label">শুরুর তারিখ</label>
                            <input className="form-input" type="date" value={editing.start_date || ''} onChange={e => setEditing({ ...editing, start_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">পরের চ্যানেলে কত দিন পর</label>
                            <input className="form-input" type="number" min={0} max={30} value={editing.gap_days ?? 3} onChange={e => setEditing({ ...editing, gap_days: Math.max(0, parseInt(e.target.value) || 0) })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">চ্যানেল *</label>
                        {PLATFORMS.map(p => byPlatform[p].length > 0 && (
                            <div key={p} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                                <span className="hint" style={{ fontSize: '0.75rem', width: 70 }}>{PLATFORM_LABEL[p]}</span>
                                {byPlatform[p].map(c => (
                                    <button key={c.id} type="button" onClick={() => toggleChannel(c.id)}
                                        style={{ padding: '3px 9px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--color-border-light)', background: (editing._channelIds || []).includes(c.id) ? PLATFORM_COLOR[p] : 'var(--color-surface)', color: (editing._channelIds || []).includes(c.id) ? '#fff' : undefined }}>
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>

                    {isEdit && (editing.slots || []).length > 0 && (
                        <div className="form-group">
                            <label className="form-label">প্রতিটি চ্যানেলের তারিখ ও ফলাফল</label>
                            {(editing.slots || []).map((s, k) => {
                                const ch = channels.find(c => c.id === s.channel_id)
                                return (
                                    <div key={s.id || k} style={{ border: '1px solid var(--color-border-light)', borderRadius: 8, padding: 8, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <b style={{ fontSize: '0.8125rem' }}>{ch?.name || '(মুছে ফেলা চ্যানেল)'}</b>
                                            <input className="form-input" type="date" style={{ width: 150 }} value={s.date} onChange={e => updateSlot(k, { date: e.target.value })} />
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

                    {isEdit && stages.length > 0 && (
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
                                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    )}

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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group"><label className="form-label">প্রোডাক্ট কোড</label><input className="form-input" value={editing.product_code || ''} onChange={e => setEditing({ ...editing, product_code: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">নোট</label><input className="form-input" value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
                    </div>

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
                                    {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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

// ================= Channel / Type modals =================
function ChannelModal({ channel, onClose, onSave }: { channel: Channel | null; onClose: () => void; onSave: (d: { id?: string; name: string; platform: Platform; upload_link: string }) => void }) {
    const [name, setName] = useState(channel?.name || '')
    const [platform, setPlatform] = useState<Platform>(channel?.platform || 'facebook')
    const [uploadLink, setUploadLink] = useState(channel?.upload_link || '')
    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
                <div className="modal-header"><h2 className="modal-title">{channel ? 'চ্যানেল এডিট' : 'চ্যানেল যোগ করুন'}</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={18} /></button></div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group"><label className="form-label">নাম *</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="যেমন: Facebook পেজ ২" /></div>
                    <div className="form-group">
                        <label className="form-label">প্ল্যাটফর্ম *</label>
                        <select className="form-input" value={platform} onChange={e => setPlatform(e.target.value as Platform)}>{PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}</select>
                    </div>
                    <div className="form-group"><label className="form-label">আপলোড লিংক (ঐচ্ছিক)</label><input className="form-input" value={uploadLink} onChange={e => setUploadLink(e.target.value)} placeholder="https://…" /></div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>বাতিল</button>
                    <button className="btn btn-primary btn-sm" disabled={!name.trim()} onClick={() => onSave({ id: channel?.id, name: name.trim(), platform, upload_link: uploadLink.trim() })}>সেভ করুন</button>
                </div>
            </motion.div>
        </motion.div>
    )
}

function TypeModal({ type, onClose, onSave }: { type: PostType | null; onClose: () => void; onSave: (d: { id?: string; name: string; kind: Kind; caption_template: string }) => void }) {
    const [name, setName] = useState(type?.name || '')
    const [kind, setKind] = useState<Kind>(type?.kind || 'video')
    const [tpl, setTpl] = useState(type?.caption_template || '')
    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
                <div className="modal-header"><h2 className="modal-title">{type ? 'ধরন এডিট' : 'ধরন যোগ করুন'}</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={18} /></button></div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group"><label className="form-label">নাম *</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="যেমন: অফার পোস্ট" /></div>
                    <div className="form-group">
                        <label className="form-label">কীভাবে তৈরি হয় *</label>
                        <select className="form-input" value={kind} onChange={e => setKind(e.target.value as Kind)}>{(Object.keys(KIND_INFO) as Kind[]).map(k => <option key={k} value={k}>{KIND_INFO[k].label}</option>)}</select>
                    </div>
                    <div className="form-group"><label className="form-label">ডিফল্ট ক্যাপশন (ঐচ্ছিক)</label><textarea className="form-input" rows={3} value={tpl} onChange={e => setTpl(e.target.value)} /></div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>বাতিল</button>
                    <button className="btn btn-primary btn-sm" disabled={!name.trim()} onClick={() => onSave({ id: type?.id, name: name.trim(), kind, caption_template: tpl })}>সেভ করুন</button>
                </div>
            </motion.div>
        </motion.div>
    )
}
