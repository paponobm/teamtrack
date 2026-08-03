'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import StarRating from '@/components/common/StarRating'
import { CONTACT_SOURCES, PLATFORMS } from '@/components/pr-management/influencerConstants'
import {
    IconX, IconEdit, IconPhone, IconPin, IconFacebook, IconWhatsApp, IconInstagram,
    IconYouTube, IconUser, IconCamera, IconPackage,
    IconStar, IconPlay, IconAward, IconPlus, IconTrash
} from '@/components/icons/Icons'

interface PrEntry {
    id: string
    customer_name: string
    send_date: string | null
    address: string | null
    parcel_details: string | null
    source: string | null
    delivery_status: string | null
    video_status: string | null
    payment_status: string | null
    video_link: string | null
    video_links: string[] | null
    view_note: string | null
    created_at: string
}

interface ActivityEntry {
    type: string
    id: string
    label: string
    actor: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details: any
    at: string
}

interface InfluencerDetail {
    id: string
    name: string
    phone: string | null
    page_url: string | null
    instagram_url: string | null
    tiktok_url: string | null
    youtube_url: string | null
    photo_url: string | null
    contact_source: string | null
    contact_value: string | null
    address: string | null
    status: string
    payment_status: string
    follower_count: number
    uploaded_platforms: string[]
    rating: number
    rating_responsiveness: number | null
    rating_quality: number | null
    rating_professionalism: number | null
    rating_engagement: number | null
    rating_reliability: number | null
    notes: string | null
    created_at: string
    pr_entries: PrEntry[]
    stats: { total_prs: number; total_videos: number; pending_products: number; unpaid_count: number; conversion_rate: number; uploadedPlatforms: string[]; lastActivity: string | null }
    activity: ActivityEntry[]
}

const RATING_CRITERIA: { key: 'rating_responsiveness' | 'rating_quality' | 'rating_professionalism' | 'rating_engagement' | 'rating_reliability'; label: string }[] = [
    { key: 'rating_responsiveness', label: 'Responsiveness' },
    { key: 'rating_quality', label: 'Content Quality' },
    { key: 'rating_professionalism', label: 'Professionalism' },
    { key: 'rating_engagement', label: 'Engagement' },
    { key: 'rating_reliability', label: 'Reliability' },
]

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: '0.875rem', verticalAlign: 'middle' }

const platformIcon: Record<string, React.ReactNode> = {
    'FB': <IconFacebook size={12} color="#1877F2" />,
    'WhatsApp': <IconWhatsApp size={12} color="#25D366" />,
    'Instagram': <IconInstagram size={12} color="#E1306C" />,
    'YouTube': <IconYouTube size={12} color="#FF0000" />,
}

const DELIVERY_OPTIONS = ['Product Sent', 'Product Received', 'Returned']
const VIDEO_OPTIONS = ['Pending', 'Video Received', 'Video Uploaded']
const PAYMENT_OPTIONS = ['Paid', 'Unpaid', 'Free']

function statusColor(value: string) {
    if (value === 'Product Received' || value === 'Video Uploaded' || value === 'Paid') return { bg: 'rgba(16,185,129,0.1)', text: '#059669' }
    if (value === 'Returned' || value === 'Unpaid') return { bg: 'rgba(220,38,38,0.1)', text: '#DC2626' }
    return { bg: 'rgba(118,118,128,0.08)', text: 'var(--color-text-secondary)' }
}

// Small inline status dropdown for the PR History table — a trimmed-down copy of the
// pattern used by PR Management's own ModernSelect (kept local since that one isn't exported).
function MiniSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false)
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const color = statusColor(value)

    // The table this lives in scrolls with overflow:auto, which clips any absolutely
    // positioned dropdown to the table's box. Render the menu into a portal instead, so
    // it escapes that clipping and floats above everything, positioned off the button's
    // real screen coordinates.
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (btnRef.current?.contains(e.target as Node)) return
            if (menuRef.current?.contains(e.target as Node)) return
            setOpen(false)
        }
        const handleScroll = () => setOpen(false)
        document.addEventListener('mousedown', handleOutside)
        window.addEventListener('scroll', handleScroll, true)
        return () => {
            document.removeEventListener('mousedown', handleOutside)
            window.removeEventListener('scroll', handleScroll, true)
        }
    }, [])

    const toggleOpen = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setMenuPos({ top: rect.bottom + 4, left: rect.left })
        }
        setOpen(!open)
    }

    return (
        <div style={{ position: 'relative', width: 'fit-content' }}>
            <button ref={btnRef} onClick={toggleOpen} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500, border: 'none', cursor: 'pointer', background: color.bg, color: color.text, whiteSpace: 'nowrap' }}>
                {value}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {open && menuPos && createPortal(
                <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '4px', zIndex: 300, minWidth: '140px' }}>
                    {options.map(opt => (
                        <button key={opt} onClick={() => { onChange(opt); setOpen(false) }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', fontSize: '0.75rem', cursor: 'pointer', fontWeight: value === opt ? 600 : 400, color: value === opt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(118,118,128,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            {opt}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    )
}

// Click-to-edit note cell, mirroring PR Management's EditableCell pattern for this table.
function EditableNote({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
    const [editing, setEditing] = useState(false)
    const [val, setVal] = useState(value || '')
    useEffect(() => { setVal(value || '') }, [value])

    if (editing) {
        return (
            <input autoFocus className="form-input" value={val} onChange={e => setVal(e.target.value)}
                onBlur={() => { setEditing(false); if (val !== (value || '')) onSave(val) }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                style={{ fontSize: '0.75rem', padding: '4px 6px', height: 'auto' }} />
        )
    }
    return (
        <div onClick={() => setEditing(true)} style={{ cursor: 'pointer', fontSize: '0.75rem', color: value ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)', fontStyle: value ? 'normal' : 'italic', minWidth: '90px' }} title="Click to edit">
            {value || 'Add note...'}
        </div>
    )
}

const emptyPrForm = {
    send_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    customer_phone: '',
    address: '',
    parcel_details: '',
    source: 'FB',
    delivery_status: 'Product Sent',
    video_status: 'Pending',
    payment_status: 'Unpaid',
    video_links: [''] as string[],
    view_note: '',
}

const emptyEditForm = { name: '', phone: '', address: '', follower_count: '', status: 'Active', payment_status: 'Unpaid', uploaded_platforms: [] as string[], photo_url: '', contact_source: '', contact_value: '' }

export default function InfluencerProfileModal({ influencerId, isAdmin, onClose, onUpdated }: { influencerId: string; isAdmin: boolean; onClose: () => void; onUpdated: () => void }) {
    const toast = useToast()
    const editPhotoInputRef = useRef<HTMLInputElement>(null)

    const [data, setData] = useState<InfluencerDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'history' | 'rating' | 'activity'>('history')

    // This is a full-screen overlay, not a real route, but it should still feel like a
    // "page" you can leave with the browser's own Back button rather than a bespoke UI
    // button. Push a history entry on open and close on popstate; nothing else calls
    // history.back(), so the only way out is the real back button (or another explicit
    // close call from within this component, e.g. after a delete).
    useEffect(() => {
        window.history.pushState({ influencerProfile: influencerId }, '', window.location.href)
        const handlePopState = () => onClose()
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const [showEditModal, setShowEditModal] = useState(false)
    const [editForm, setEditForm] = useState(emptyEditForm)
    const [savingProfile, setSavingProfile] = useState(false)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)

    const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({})
    const [savingRating, setSavingRating] = useState(false)

    const [notesDraft, setNotesDraft] = useState('')
    const [savingNotes, setSavingNotes] = useState(false)

    const [showAddPr, setShowAddPr] = useState(false)
    const [prForm, setPrForm] = useState(emptyPrForm)
    const [savingPr, setSavingPr] = useState(false)

    const [videoPromptId, setVideoPromptId] = useState<string | null>(null)
    const [videoLinksDraft, setVideoLinksDraft] = useState<string[]>([''])
    const [savingVideoLinks, setSavingVideoLinks] = useState(false)

    const fetchDetail = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/influencers?id=${influencerId}`)
            if (res.ok) {
                const json = await res.json()
                setData(json.data)
                setNotesDraft(json.data.notes || '')
                setRatingDraft({
                    rating_responsiveness: json.data.rating_responsiveness || 0,
                    rating_quality: json.data.rating_quality || 0,
                    rating_professionalism: json.data.rating_professionalism || 0,
                    rating_engagement: json.data.rating_engagement || 0,
                    rating_reliability: json.data.rating_reliability || 0,
                })
            }
        } catch {
            toast.error('Failed to load influencer profile')
        } finally {
            setLoading(false)
        }
    }, [influencerId, toast])

    useEffect(() => { fetchDetail() }, [fetchDetail])

    const saveField = async (updates: Record<string, unknown>) => {
        const res = await fetch('/api/influencers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: influencerId, ...updates })
        })
        if (!res.ok) throw new Error('Save failed')
        return res.json()
    }

    const openEdit = () => {
        if (!data) return
        setEditForm({
            name: data.name || '', phone: data.phone || '', address: data.address || '',
            follower_count: String(data.follower_count || 0), status: data.status || 'Active',
            payment_status: data.payment_status || 'Unpaid', uploaded_platforms: data.uploaded_platforms || [],
            photo_url: data.photo_url || '', contact_source: data.contact_source || '', contact_value: data.contact_value || '',
        })
        setShowEditModal(true)
    }

    const handleSaveProfile = async () => {
        setSavingProfile(true)
        try {
            await saveField({ ...editForm, follower_count: Number(editForm.follower_count) || 0 })
            toast.success('Profile updated')
            setShowEditModal(false)
            await fetchDetail()
            onUpdated()
        } catch {
            toast.error('Failed to update profile')
        } finally {
            setSavingProfile(false)
        }
    }

    const handleEditPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingPhoto(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('bucket', 'memories')
            formData.append('folder', 'influencers')
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
            if (!uploadRes.ok) throw new Error('Upload failed')
            const { url } = await uploadRes.json()
            setEditForm(f => ({ ...f, photo_url: url }))
        } catch {
            toast.error('Failed to upload photo')
        } finally {
            setUploadingPhoto(false)
            if (editPhotoInputRef.current) editPhotoInputRef.current.value = ''
        }
    }

    const handleSaveRating = async () => {
        setSavingRating(true)
        try {
            await saveField(ratingDraft)
            toast.success('Rating saved')
            await fetchDetail()
            onUpdated()
        } catch {
            toast.error('Failed to save rating')
        } finally {
            setSavingRating(false)
        }
    }

    const handleSaveNotes = async () => {
        setSavingNotes(true)
        try {
            await saveField({ notes: notesDraft })
            toast.success('Notes saved')
            await fetchDetail()
        } catch {
            toast.error('Failed to save notes')
        } finally {
            setSavingNotes(false)
        }
    }

    const openAddPr = () => {
        if (!data) return
        setPrForm({ ...emptyPrForm, customer_name: data.name || '', customer_phone: data.phone || '', address: data.address || '' })
        setShowAddPr(true)
    }

    const isPrFormValid = prForm.customer_name.trim() && prForm.customer_phone.trim() && prForm.parcel_details.trim()

    const handleAddPr = async () => {
        if (!isPrFormValid) return
        setSavingPr(true)
        try {
            const { video_links, ...rest } = prForm
            const cleanLinks = video_links.map(v => v.trim()).filter(Boolean)
            const res = await fetch('/api/pr-management', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // video_link stays a single URL (the first one) so PR Management's own table —
                // which only ever renders one video-link icon per row — keeps working unchanged
                // for these entries too; video_links carries the full list for this page's own display.
                body: JSON.stringify({ ...rest, video_link: cleanLinks[0] || null, video_links: cleanLinks, influencer_id: influencerId })
            })
            if (res.ok) {
                toast.success('PR entry added')
                setShowAddPr(false)
                await fetchDetail()
                onUpdated()
            } else {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || 'Failed to add PR entry')
            }
        } catch {
            toast.error('Failed to add PR entry')
        } finally {
            setSavingPr(false)
        }
    }

    // Inline edits from the PR History table — same endpoint/contract PR Management's
    // own EditableCell/ModernSelect already PATCH through, just triggered from here too.
    const handleUpdatePrField = async (prId: string, field: string, value: string) => {
        const prev = data?.pr_entries.find(p => p.id === prId)
        setData(d => d ? { ...d, pr_entries: d.pr_entries.map(p => p.id === prId ? { ...p, [field]: value } : p) } : d)
        try {
            const res = await fetch('/api/pr-management', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: prId, [field]: value })
            })
            if (!res.ok) throw new Error('Update failed')
            onUpdated()
        } catch {
            toast.error('Failed to save changes')
            if (prev) setData(d => d ? { ...d, pr_entries: d.pr_entries.map(p => p.id === prId ? prev : p) } : d)
        }
    }

    const openVideoLinksModal = (entry: PrEntry) => {
        const existing = (entry.video_links && entry.video_links.length > 0) ? entry.video_links : (entry.video_link ? [entry.video_link] : [''])
        setVideoLinksDraft(existing)
        setVideoPromptId(entry.id)
    }

    const handleSaveVideoLinks = async () => {
        if (!videoPromptId) return
        const cleanLinks = videoLinksDraft.map(v => v.trim()).filter(Boolean)
        setSavingVideoLinks(true)
        try {
            const res = await fetch('/api/pr-management', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: videoPromptId, video_link: cleanLinks[0] || null, video_links: cleanLinks })
            })
            if (!res.ok) throw new Error('Update failed')
            setData(d => d ? { ...d, pr_entries: d.pr_entries.map(p => p.id === videoPromptId ? { ...p, video_link: cleanLinks[0] || null, video_links: cleanLinks } : p) } : d)
            toast.success('Video links saved')
            onUpdated()
            setVideoPromptId(null)
        } catch {
            toast.error('Failed to save video links')
        } finally {
            setSavingVideoLinks(false)
        }
    }

    const handleDeletePr = async (prId: string) => {
        if (!confirm('Delete this PR entry?')) return
        try {
            const res = await fetch(`/api/pr-management?id=${prId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Delete failed')
            toast.success('PR entry deleted')
            setData(d => d ? { ...d, pr_entries: d.pr_entries.filter(p => p.id !== prId) } : d)
            onUpdated()
        } catch {
            toast.error('Failed to delete PR entry')
        }
    }

    const overallPreview = (() => {
        const vals = Object.values(ratingDraft).filter(v => v > 0)
        return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0
    })()

    const history = data ? [...data.pr_entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : []

    const timelineActivity = data ? [
        ...data.activity.map(a => ({ key: `audit-${a.id}`, at: a.at, label: a.label, actor: a.actor, icon: <IconAward size={14} color="#8B5CF6" /> })),
        ...data.pr_entries.map(p => ({ key: `pr-${p.id}`, at: p.created_at, label: `PR sent: ${p.parcel_details || p.customer_name}`, actor: null, icon: <IconPackage size={14} color="#3B82F6" /> })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()) : []

    return (
        <motion.div className="content-area-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'var(--color-bg-primary)', display: 'flex' }}>
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: '100%', height: '100%', display: 'flex' }}>

                {loading || !data ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>
                ) : (
                    <>
                        {/* Left sidebar */}
                        <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid var(--color-border-light)', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
                                {data.photo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={data.photo_url} alt={data.name} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <IconUser size={32} color="var(--color-text-tertiary)" />
                                    </div>
                                )}

                                <div style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>{data.name}</div>

                                <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', padding: '2px 10px', borderRadius: '20px', background: (data.status || 'Active') === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(118,118,128,0.1)', color: (data.status || 'Active') === 'Active' ? '#059669' : 'var(--color-text-tertiary)' }}>
                                    {data.status || 'Active'}
                                </span>

                                <StarRating value={data.rating || 0} readOnly size={16} />
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{data.rating ? `${data.rating}/5 overall` : 'Not rated yet'}</div>

                                {isAdmin && (
                                    <button className="btn btn-secondary btn-sm" onClick={openEdit} style={{ marginTop: '4px' }}><IconEdit size={13} /> Edit Profile</button>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                                {data.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}><IconPhone size={13} /> {data.phone}</div>}
                                {data.address && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}><IconPin size={13} /> {data.address}</div>}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}><IconUser size={13} /> {data.follower_count?.toLocaleString() || 0} followers</div>
                                {data.contact_value && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
                                        {data.contact_source === 'facebook' && <IconFacebook size={13} color="#1877F2" />}
                                        {data.contact_source === 'whatsapp' && <IconWhatsApp size={13} color="#25D366" />}
                                        {data.contact_source === 'email' && <IconPhone size={13} />}
                                        {data.contact_source === 'phone' && <IconPhone size={13} />}
                                        {data.contact_value}
                                    </div>
                                )}
                                {(data.uploaded_platforms || []).length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        {data.uploaded_platforms.map(key => {
                                            const p = PLATFORMS.find(pl => pl.key === key)
                                            return p ? <span key={key} title={p.label} style={{ display: 'flex', width: 28, height: 28, borderRadius: '6px', background: 'rgba(118,118,128,0.08)', alignItems: 'center', justifyContent: 'center' }}>{p.icon}</span> : null
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total PR Sent</span><strong style={{ fontSize: '0.875rem' }}>{data.stats.total_prs}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Videos Uploaded</span><strong style={{ fontSize: '0.875rem' }}>{data.stats.total_videos}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Products</span><strong style={{ fontSize: '0.875rem' }}>{data.stats.pending_products}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conversion Rate</span><strong style={{ fontSize: '0.875rem' }}>{data.stats.conversion_rate}%</strong></div>
                            </div>

                            {isAdmin && (
                                <div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Admin Notes (private)</div>
                                    <textarea className="form-input" rows={4} value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder="Internal notes about this influencer..." />
                                    <button className="btn btn-secondary btn-sm" style={{ marginTop: '6px', width: '100%' }} onClick={handleSaveNotes} disabled={savingNotes || notesDraft === (data.notes || '')}>{savingNotes ? 'Saving...' : 'Save Notes'}</button>
                                </div>
                            )}
                        </div>

                        {/* Right content */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--color-border-light)' }}>
                                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                                    {[
                                        { key: 'history', label: 'PR History' },
                                        { key: 'rating', label: 'Rating' },
                                        { key: 'activity', label: 'Activity' },
                                    ].map(tab => (
                                        <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
                                            style={{ position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '0.8125rem', fontWeight: 500, background: 'transparent', color: activeTab === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', zIndex: 1 }}>
                                            {activeTab === tab.key && (
                                                <motion.div layoutId="influencerProfileTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                            )}
                                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={openAddPr}><IconPlus size={16} /> Add PR Entry</button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                                {activeTab === 'history' && (
                                    <div className="card" style={{ padding: 0, overflow: 'auto', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                                        {history.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No PR history yet. Click &quot;Add PR Entry&quot; to log one.</div>
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                        <th style={thStyle}>Date</th>
                                                        <th style={thStyle}>Address &amp; Parcel</th>
                                                        <th style={thStyle}>Delivery Status</th>
                                                        <th style={thStyle}>Video Status</th>
                                                        <th style={thStyle}>Payment</th>
                                                        <th style={thStyle}>Notes</th>
                                                        <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {history.map(p => (
                                                        <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                            <td style={tdStyle}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                                                    {p.source && platformIcon[p.source] && <span title={p.source} style={{ display: 'flex' }}>{platformIcon[p.source]}</span>}
                                                                    {p.send_date ? new Date(p.send_date).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}
                                                                </div>
                                                            </td>
                                                            <td style={tdStyle}>
                                                                <div style={{ fontWeight: 500 }}>{p.parcel_details || '—'}</div>
                                                                {p.address && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{p.address}</div>}
                                                            </td>
                                                            <td style={tdStyle}><MiniSelect value={p.delivery_status || 'Product Sent'} options={DELIVERY_OPTIONS} onChange={v => handleUpdatePrField(p.id, 'delivery_status', v)} /></td>
                                                            <td style={tdStyle}><MiniSelect value={p.video_status || 'Pending'} options={VIDEO_OPTIONS} onChange={v => handleUpdatePrField(p.id, 'video_status', v)} /></td>
                                                            <td style={tdStyle}><MiniSelect value={p.payment_status || 'Unpaid'} options={PAYMENT_OPTIONS} onChange={v => handleUpdatePrField(p.id, 'payment_status', v)} /></td>
                                                            <td style={tdStyle}><EditableNote value={p.view_note} onSave={v => handleUpdatePrField(p.id, 'view_note', v)} /></td>
                                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                    <button onClick={() => openVideoLinksModal(p)} title="Manage Video Links" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: (p.video_links?.length || p.video_link) ? '#3B82F6' : 'var(--color-text-tertiary)', display: 'flex' }}>
                                                                        <IconCamera size={15} />
                                                                    </button>
                                                                    {isAdmin && (
                                                                        <button onClick={() => handleDeletePr(p.id)} title="Delete" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex' }}>
                                                                            <IconTrash size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'rating' && (
                                    <div style={{ maxWidth: '480px' }}>
                                        {isAdmin ? (
                                            <>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                                    {RATING_CRITERIA.map(c => (
                                                        <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{c.label}</span>
                                                            <StarRating value={ratingDraft[c.key] || 0} onChange={v => setRatingDraft({ ...ratingDraft, [c.key]: v })} size={22} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(245,158,11,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Overall (auto-averaged)</span>
                                                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F59E0B' }}>{overallPreview}/5</span>
                                                </div>
                                                <button className="btn btn-primary btn-sm" style={{ marginTop: '16px' }} onClick={handleSaveRating} disabled={savingRating}>
                                                    <IconStar size={14} /> {savingRating ? 'Saving...' : 'Save Rating'}
                                                </button>
                                            </>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                                {RATING_CRITERIA.map(c => (
                                                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{c.label}</span>
                                                        <StarRating value={data[c.key] || 0} readOnly size={16} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'activity' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                        {timelineActivity.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No activity recorded yet.</div>
                                        ) : timelineActivity.map((a, idx) => (
                                            <div key={a.key} style={{ display: 'flex', gap: '12px', paddingBottom: '18px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.icon}</div>
                                                    {idx < timelineActivity.length - 1 && <div style={{ width: '1px', flex: 1, background: 'var(--color-border-light)', marginTop: '4px' }} />}
                                                </div>
                                                <div style={{ paddingTop: '4px' }}>
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>{a.label}{a.actor ? <span style={{ color: 'var(--color-text-tertiary)' }}> — by {a.actor}</span> : null}</div>
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{new Date(a.at).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Add PR Entry modal */}
                        {showAddPr && (
                            <div className="modal-overlay" onClick={() => setShowAddPr(false)} style={{ zIndex: 210 }}>
                                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                                    <div className="modal-header">
                                        <h2 className="modal-title">Add PR Entry for {data.name}</h2>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddPr(false)}><IconX size={20} /></button>
                                    </div>
                                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="form-group"><label className="form-label">Customer Name *</label><input className="form-input" value={prForm.customer_name} readOnly disabled style={{ background: 'var(--color-bg-secondary)', cursor: 'not-allowed' }} /></div>
                                            <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" value={prForm.customer_phone} onChange={e => setPrForm({ ...prForm, customer_phone: e.target.value })} /></div>
                                        </div>
                                        <div className="form-group"><label className="form-label">Parcel Details *</label><input className="form-input" value={prForm.parcel_details} onChange={e => setPrForm({ ...prForm, parcel_details: e.target.value })} placeholder="e.g. 1450/- or product name" /></div>
                                        <div className="form-group"><label className="form-label">Address</label><textarea className="form-input" rows={2} value={prForm.address} onChange={e => setPrForm({ ...prForm, address: e.target.value })} /></div>
                                        <div className="form-group">
                                            <label className="form-label">Send Date</label><input type="date" className="form-input" value={prForm.send_date} onChange={e => setPrForm({ ...prForm, send_date: e.target.value })} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                            <div className="form-group"><label className="form-label">Delivery Status</label>
                                                <select className="form-input" value={prForm.delivery_status} onChange={e => setPrForm({ ...prForm, delivery_status: e.target.value })}>
                                                    <option value="Product Sent">Product Sent</option>
                                                    <option value="Product Received">Product Received</option>
                                                    <option value="Returned">Returned</option>
                                                </select>
                                            </div>
                                            <div className="form-group"><label className="form-label">Video Status</label>
                                                <select className="form-input" value={prForm.video_status} onChange={e => setPrForm({ ...prForm, video_status: e.target.value })}>
                                                    <option value="Pending">Pending</option>
                                                    <option value="Video Received">Video Received</option>
                                                    <option value="Video Uploaded">Video Uploaded</option>
                                                </select>
                                            </div>
                                            <div className="form-group"><label className="form-label">Payment Status</label>
                                                <select className="form-input" value={prForm.payment_status} onChange={e => setPrForm({ ...prForm, payment_status: e.target.value })}>
                                                    <option value="Paid">Paid</option>
                                                    <option value="Unpaid">Unpaid</option>
                                                    <option value="Free">Free</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <label className="form-label">Video Link{prForm.video_links.length > 1 ? 's' : ''}</label>
                                                <button type="button" onClick={() => setPrForm({ ...prForm, video_links: [...prForm.video_links, ''] })}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}>
                                                    <IconPlus size={13} /> Add
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {prForm.video_links.map((link, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(118,118,128,0.1)', color: 'var(--color-text-secondary)', fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0 }}>
                                                            {idx + 1}
                                                        </span>
                                                        <input className="form-input" value={link} placeholder="https://..."
                                                            onChange={e => setPrForm({ ...prForm, video_links: prForm.video_links.map((v, i) => i === idx ? e.target.value : v) })}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault()
                                                                    if (idx === prForm.video_links.length - 1) setPrForm({ ...prForm, video_links: [...prForm.video_links, ''] })
                                                                }
                                                            }}
                                                            style={{ flex: 1 }} />
                                                        {prForm.video_links.length > 1 && (
                                                            <button type="button" onClick={() => setPrForm({ ...prForm, video_links: prForm.video_links.filter((_, i) => i !== idx) })}
                                                                style={{ display: 'flex', background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '2px', flexShrink: 0 }} title="Remove">
                                                                <IconX size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="form-group"><label className="form-label">Note</label><textarea className="form-input" rows={2} value={prForm.view_note} onChange={e => setPrForm({ ...prForm, view_note: e.target.value })} /></div>
                                    </div>
                                    <div className="modal-footer">
                                        <button className="btn btn-secondary btn-sm" onClick={() => setShowAddPr(false)}>Cancel</button>
                                        <button className="btn btn-primary btn-sm" onClick={handleAddPr} disabled={savingPr || !isPrFormValid}>{savingPr ? 'Saving...' : 'Save'}</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Edit Profile modal — mirrors the Add Influencer form's fields/layout, pre-filled */}
                        {showEditModal && (
                            <div className="modal-overlay" onClick={() => setShowEditModal(false)} style={{ zIndex: 210 }}>
                                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                                    <div className="modal-header">
                                        <h2 className="modal-title">Edit Influencer</h2>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(false)}><IconX size={20} /></button>
                                    </div>
                                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Photo</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                {editForm.photo_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={editForm.photo_url} alt="Preview" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <IconUser size={24} color="var(--color-text-tertiary)" />
                                                    </div>
                                                )}
                                                <input ref={editPhotoInputRef} type="file" accept="image/*" onChange={handleEditPhotoSelect} style={{ display: 'none' }} />
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => editPhotoInputRef.current?.click()} disabled={uploadingPhoto}>
                                                    <IconCamera size={14} /> {uploadingPhoto ? 'Uploading...' : editForm.photo_url ? 'Change Photo' : 'Upload Photo'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="form-group"><label className="form-label">Phone (WhatsApp)</label><input className="form-input" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                                            <div className="form-group"><label className="form-label">Followers</label><input type="number" className="form-input" value={editForm.follower_count} onChange={e => setEditForm({ ...editForm, follower_count: e.target.value })} /></div>
                                        </div>
                                        <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                                            <div className="form-group"><label className="form-label">Contact Source</label>
                                                <select className="form-input" value={editForm.contact_source} onChange={e => setEditForm({ ...editForm, contact_source: e.target.value })}>
                                                    <option value="">— None —</option>
                                                    {CONTACT_SOURCES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group"><label className="form-label">Contact Link / Number</label>
                                                <input className="form-input" value={editForm.contact_value} onChange={e => setEditForm({ ...editForm, contact_value: e.target.value })} placeholder={CONTACT_SOURCES.find(c => c.key === editForm.contact_source)?.placeholder} />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Uploads Video On</label>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {PLATFORMS.map(p => {
                                                    const checked = editForm.uploaded_platforms.includes(p.key)
                                                    return (
                                                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border-light)'}`, background: checked ? 'rgba(59,130,246,0.08)' : 'transparent', cursor: 'pointer', fontSize: '0.8125rem' }}>
                                                            <input type="checkbox" checked={checked} onChange={e => {
                                                                const next = e.target.checked
                                                                    ? [...editForm.uploaded_platforms, p.key]
                                                                    : editForm.uploaded_platforms.filter(k => k !== p.key)
                                                                setEditForm({ ...editForm, uploaded_platforms: next })
                                                            }} />
                                                            {p.icon} {p.label}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="form-group"><label className="form-label">Status</label>
                                                <select className="form-input" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                </select>
                                            </div>
                                            <div className="form-group"><label className="form-label">Payment Status</label>
                                                <select className="form-input" value={editForm.payment_status} onChange={e => setEditForm({ ...editForm, payment_status: e.target.value })}>
                                                    <option value="Paid">Paid</option>
                                                    <option value="Unpaid">Unpaid</option>
                                                    <option value="Free">Free</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                                        <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={savingProfile || !editForm.name.trim()}>{savingProfile ? 'Saving...' : 'Save'}</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Manage Video Links modal — view/open existing links and add more */}
                        {videoPromptId && (
                            <div className="modal-overlay" onClick={() => setVideoPromptId(null)} style={{ zIndex: 210 }}>
                                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Video Links</h3>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setVideoPromptId(null)}><IconX size={18} /></button>
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Open an existing link, or add more below.</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                        {videoLinksDraft.map((link, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(118,118,128,0.1)', color: 'var(--color-text-secondary)', fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0 }}>
                                                    {idx + 1}
                                                </span>
                                                <input autoFocus={idx === 0} className="form-input" value={link} placeholder="https://youtube.com/..."
                                                    onChange={e => setVideoLinksDraft(videoLinksDraft.map((v, i) => i === idx ? e.target.value : v))}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            if (idx === videoLinksDraft.length - 1) setVideoLinksDraft([...videoLinksDraft, ''])
                                                        }
                                                    }}
                                                    style={{ flex: 1 }} />
                                                {link.trim() && (
                                                    <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" title="Open video" style={{ display: 'flex', color: '#3B82F6', flexShrink: 0 }}>
                                                        <IconPlay size={16} />
                                                    </a>
                                                )}
                                                {videoLinksDraft.length > 1 && (
                                                    <button type="button" onClick={() => setVideoLinksDraft(videoLinksDraft.filter((_, i) => i !== idx))}
                                                        style={{ display: 'flex', background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '2px', flexShrink: 0 }} title="Remove">
                                                        <IconX size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => setVideoLinksDraft([...videoLinksDraft, ''])}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: '4px', marginBottom: '16px' }}>
                                        <IconPlus size={14} /> Add another link
                                    </button>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setVideoPromptId(null)} style={{ flex: 1 }}>Cancel</button>
                                        <button className="btn btn-primary btn-sm" disabled={savingVideoLinks} style={{ flex: 1 }} onClick={handleSaveVideoLinks}>
                                            {savingVideoLinks ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </motion.div>
    )
}
