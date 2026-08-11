'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { usePermissions } from '@/lib/PermissionsContext'
import StarRating from '@/components/common/StarRating'
import InfluencerProfileModal from '@/components/pr-management/InfluencerProfileModal'
import { CONTACT_SOURCES, PLATFORMS } from '@/components/pr-management/influencerConstants'
import {
    IconUsers, IconPackage, IconCheckCircle, IconClock, IconBanknote, IconStar,
    IconSearch, IconPlus, IconX, IconPin, IconPhone, IconTrash,
    IconYouTube, IconUser, IconCamera
} from '@/components/icons/Icons'

export interface InfluencerListItem {
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
    rating: number
    notes: string | null
    created_at: string
    uploaded_platforms: string[]
    stats: {
        total_prs: number
        total_videos: number
        pending_products: number
        unpaid_count: number
        conversion_rate: number
        uploadedPlatforms: string[]
        lastActivity: string | null
    }
}

interface Summary {
    total: number
    active: number
    totalPrSent: number
    totalVideosUploaded: number
    pendingProducts: number
    paidInfluencers: number
    unpaidInfluencers: number
    averageRating: number
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

const emptyForm = { name: '', phone: '', address: '', follower_count: '', status: 'Active', payment_status: 'Unpaid', uploaded_platforms: [] as string[], photo_url: '', contact_source: '', contact_value: '' }

const platformIconMap: Record<string, React.ReactNode> = Object.fromEntries(PLATFORMS.map(p => [p.key, p.icon]))
const platformLabelMap: Record<string, string> = Object.fromEntries(PLATFORMS.map(p => [p.key, p.label]))

function PaymentBadge({ status }: { status: string }) {
    if (status === 'Paid') return <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: '#059669' }}>Paid</span>
    if (status === 'Free') return <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'rgba(59,130,246,0.1)', color: '#2563EB' }}>Free</span>
    return <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>Unpaid</span>
}

export default function InfluencersTab() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const isAdmin = perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin'

    const [influencers, setInfluencers] = useState<InfluencerListItem[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [platformFilter, setPlatformFilter] = useState('all')
    const [paymentFilter, setPaymentFilter] = useState('all')
    const [ratingFilter, setRatingFilter] = useState('all')
    const [sortBy, setSortBy] = useState('recent')

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const addPhotoInputRef = useRef<HTMLInputElement>(null)

    const handleAddPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingPhoto(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('bucket', 'memories')
            formData.append('folder', 'influencers')
            const res = await fetch('/api/upload', { method: 'POST', body: formData })
            if (!res.ok) throw new Error('Upload failed')
            const { url } = await res.json()
            setForm(f => ({ ...f, photo_url: url }))
        } catch {
            toast.error('Failed to upload photo')
        } finally {
            setUploadingPhoto(false)
            if (addPhotoInputRef.current) addPhotoInputRef.current.value = ''
        }
    }

    const fetchInfluencers = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/influencers')
            if (res.ok) {
                const json = await res.json()
                setInfluencers(json.data || [])
                setSummary(json.summary || null)
            }
        } catch {
            console.error('Failed to fetch influencers')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchInfluencers() }, [fetchInfluencers])

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete influencer "${name}"? Their linked PR history will be kept but unlinked.`)) return
        try {
            const res = await fetch(`/api/influencers?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Influencer deleted')
                setInfluencers(prev => prev.filter(i => i.id !== id))
            } else {
                toast.error('Failed to delete influencer')
            }
        } catch {
            toast.error('Failed to delete influencer')
        }
    }

    // Toggles a single platform in an influencer's `uploaded_platforms` set directly
    // from the card — this is the "which platform does he use to upload video" marker.
    const handleTogglePlatform = async (inf: InfluencerListItem, platformKey: string) => {
        const current = inf.uploaded_platforms || []
        const next = current.includes(platformKey) ? current.filter(p => p !== platformKey) : [...current, platformKey]
        setInfluencers(prev => prev.map(i => i.id === inf.id ? { ...i, uploaded_platforms: next } : i))
        try {
            const res = await fetch('/api/influencers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: inf.id, uploaded_platforms: next })
            })
            if (!res.ok) throw new Error('Failed')
        } catch {
            toast.error('Failed to update platforms')
            setInfluencers(prev => prev.map(i => i.id === inf.id ? { ...i, uploaded_platforms: current } : i))
        }
    }

    const handleCreate = async () => {
        if (!form.name.trim()) return
        setSaving(true)
        try {
            const res = await fetch('/api/influencers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            if (res.ok) {
                toast.success('Influencer added')
                setShowAddModal(false)
                setForm(emptyForm)
                await fetchInfluencers()
            } else {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || 'Failed to add influencer')
            }
        } catch {
            toast.error('Failed to add influencer')
        } finally {
            setSaving(false)
        }
    }

    const filtered = influencers.filter(i => {
        if (search) {
            const q = search.toLowerCase()
            if (!(i.name || '').toLowerCase().includes(q) && !(i.phone || '').toLowerCase().includes(q)) return false
        }
        if (statusFilter !== 'all' && (i.status || 'Active') !== statusFilter) return false
        if (platformFilter !== 'all' && !(i.uploaded_platforms || []).includes(platformFilter)) return false
        if (paymentFilter !== 'all' && (i.payment_status || 'Unpaid') !== paymentFilter) return false
        if (ratingFilter !== 'all' && (i.rating || 0) < parseInt(ratingFilter, 10)) return false
        return true
    }).sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
        if (sortBy === 'total_prs') return b.stats.total_prs - a.stats.total_prs
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    const summaryCards = summary ? [
        { label: 'Total Influencers', value: summary.total, color: '#3B82F6', icon: <IconUsers size={20} color="#3B82F6" /> },
        { label: 'Active Influencers', value: summary.active, color: '#10B981', icon: <IconCheckCircle size={20} color="#10B981" /> },
         { label: 'Paid Influencers', value: summary.paidInfluencers, color: '#059669', icon: <IconBanknote size={20} color="#059669" /> },
        { label: 'Unpaid Influencers', value: summary.unpaidInfluencers, color: '#DC2626', icon: <IconBanknote size={20} color="#DC2626" /> },
        { label: 'Total PR Sent', value: summary.totalPrSent, color: '#8B5CF6', icon: <IconPackage size={20} color="#8B5CF6" /> },
        { label: 'Videos Uploaded', value: summary.totalVideosUploaded, color: '#06B6D4', icon: <IconYouTube size={20} color="#06B6D4" /> },
        { label: 'Pending Products', value: summary.pendingProducts, color: '#F59E0B', icon: <IconClock size={20} color="#F59E0B" /> },
        // { label: 'Paid Influencers', value: summary.paidInfluencers, color: '#059669', icon: <IconBanknote size={20} color="#059669" /> },
        // { label: 'Unpaid Influencers', value: summary.unpaidInfluencers, color: '#DC2626', icon: <IconBanknote size={20} color="#DC2626" /> },
        // { label: 'Average Rating', value: `${summary.averageRating}/5`, color: '#F59E0B', icon: <IconStar size={20} color="#F59E0B" /> },
    ] : []

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <motion.div variants={container} animate="show" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Summary cards */}
                <motion.div variants={item} className="grid grid-4" style={{ gap: '14px', marginBottom: '20px' }}>
                    {loading && !summary ? (
                        [1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="card skeleton" style={{ height: '96px', borderRadius: '16px' }} />)
                    ) : summaryCards.map(s => (
                        <div key={s.label} style={{
                            position: 'relative', overflow: 'hidden', padding: '14px 18px', borderRadius: '16px',
                            background: `linear-gradient(135deg, var(--color-surface) 0%, ${s.color}10 100%)`,
                            border: `1px solid ${s.color}20`, boxShadow: `0 4px 20px ${s.color}10`,
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '90px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '8px', background: `${s.color}15` }}>{s.icon}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>{s.value}</div>
                        </div>
                    ))}
                </motion.div>

                {/* Filters */}
                <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: '220px' }}>
                        <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                        <input className="form-input" type="text" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: '34px', height: '34px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px', width: '100%' }} />
                    </div>
                    <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: '34px', fontSize: '0.8125rem', width: 'auto' }}>
                        <option value="all">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                    <select className="form-input" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} style={{ height: '34px', fontSize: '0.8125rem', width: 'auto' }}>
                        <option value="all">All Platforms</option>
                        <option value="facebook">Facebook</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="youtube">YouTube</option>
                    </select>
                    <select className="form-input" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ height: '34px', fontSize: '0.8125rem', width: 'auto' }}>
                        <option value="all">All Payments</option>
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Free">Free</option>
                    </select>
                    <select className="form-input" value={ratingFilter} onChange={e => setRatingFilter(e.target.value)} style={{ height: '34px', fontSize: '0.8125rem', width: 'auto' }}>
                        <option value="all">All Ratings</option>
                        <option value="4">4+ Stars</option>
                        <option value="3">3+ Stars</option>
                        <option value="2">2+ Stars</option>
                        <option value="1">1+ Stars</option>
                    </select>
                    <select className="form-input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ height: '34px', fontSize: '0.8125rem', width: 'auto' }}>
                        <option value="recent">Sort: Recent</option>
                        <option value="name">Sort: Name</option>
                        <option value="rating">Sort: Rating</option>
                        <option value="total_prs">Sort: Total PRs</option>
                    </select>
                    {isAdmin && (
                        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setForm(emptyForm); setShowAddModal(true) }}>
                            <IconPlus size={16} /> Add Influencer
                        </button>
                    )}
                </motion.div>

                {/* Card grid */}
                <motion.div variants={item} style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: '24px' }}>
                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '18px' }}>
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="card skeleton" style={{ height: '230px', borderRadius: '16px' }} />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                            <IconUsers size={48} color="var(--color-text-tertiary)" />
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '16px' }}>No influencers found</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Influencer profiles are created automatically when you send a PR, or add one manually.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '18px' }}>
                            {filtered.map(inf => {
                                const activePlatforms = (inf.uploaded_platforms || []).filter(p => platformIconMap[p])
                                return (
                                    <div key={inf.id} className="card" onClick={() => setSelectedId(inf.id)}
                                        style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', transition: 'transform 0.15s, box-shadow 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '' }}
                                    >
                                        {isAdmin && (
                                            <button onClick={e => { e.stopPropagation(); handleDelete(inf.id, inf.name) }}
                                                style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '2px' }} title="Delete">
                                                <IconTrash size={16} />
                                            </button>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                {inf.photo_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={inf.photo_url} alt={inf.name} style={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <IconUser size={26} color="var(--color-text-tertiary)" />
                                                    </div>
                                                )}
                                                <span style={{ position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: '50%', border: '2px solid var(--color-surface)', background: (inf.status || 'Active') === 'Active' ? '#10B981' : '#9CA3AF' }} />
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inf.name}</div>
                                                {inf.phone && <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}><IconPhone size={13} />{inf.phone}</div>}
                                            </div>
                                        </div>

                                        {inf.address && (
                                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <IconPin size={13} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{inf.address}</span>
                                            </div>
                                        )}

                                        {activePlatforms.length > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
                                                Uploads on:
                                                {activePlatforms.map(p => (
                                                    isAdmin ? (
                                                        <button key={p} title={`${platformLabelMap[p] || p} (click to remove)`} onClick={e => { e.stopPropagation(); handleTogglePlatform(inf, p) }}
                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'rgba(118,118,128,0.1)' }}>
                                                            {platformIconMap[p]}
                                                        </button>
                                                    ) : (
                                                        <span key={p} title={platformLabelMap[p] || p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '6px', background: 'rgba(118,118,128,0.08)' }}>
                                                            {platformIconMap[p]}
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--color-border-light)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <StarRating value={inf.rating || 0} readOnly size={16} />
                                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{inf.rating ? inf.rating.toFixed(1) : 'Not rated'}</span>
                                            </div>
                                            {/* <PaymentBadge status={inf.payment_status || 'Unpaid'} /> */}
                                        </div>

                                        <div style={{ display: 'flex', gap: '14px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                            <span><strong style={{ color: 'var(--color-text-primary)' }}>{inf.stats.total_prs}</strong> Sent</span>
                                            <span><strong style={{ color: 'var(--color-text-primary)' }}>{inf.stats.total_videos}</strong> Videos</span>
                                            <span><strong style={{ color: 'var(--color-text-primary)' }}>{inf.stats.pending_products}</strong> Pending</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* Profile modal */}
            <AnimatePresence>
                {selectedId && (
                    <InfluencerProfileModal
                        influencerId={selectedId}
                        isAdmin={isAdmin}
                        onClose={() => setSelectedId(null)}
                        onUpdated={fetchInfluencers}
                    />
                )}
            </AnimatePresence>

            {/* Add Influencer modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Add Influencer</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}><IconX size={20} /></button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group">
                                    <label className="form-label">Photo</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            {form.photo_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={form.photo_url} alt="Preview" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <IconUser size={24} color="var(--color-text-tertiary)" />
                                                </div>
                                            )}
                                        </div>
                                        <input ref={addPhotoInputRef} type="file" accept="image/*" onChange={handleAddPhotoSelect} style={{ display: 'none' }} />
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addPhotoInputRef.current?.click()} disabled={uploadingPhoto}>
                                            <IconCamera size={14} /> {uploadingPhoto ? 'Uploading...' : form.photo_url ? 'Change Photo' : 'Upload Photo'}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Influencer name" /></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group"><label className="form-label">Phone (WhatsApp)</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" /></div>
                                    <div className="form-group"><label className="form-label">Followers</label><input type="number" className="form-input" value={form.follower_count} onChange={e => setForm({ ...form, follower_count: e.target.value })} placeholder="0" /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="City / Area" /></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                                    <div className="form-group"><label className="form-label">Contact Source</label>
                                        <select className="form-input" value={form.contact_source} onChange={e => setForm({ ...form, contact_source: e.target.value })}>
                                            <option value="">— None —</option>
                                            {CONTACT_SOURCES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label className="form-label">Contact Link / Number</label>
                                        <input className="form-input" value={form.contact_value} onChange={e => setForm({ ...form, contact_value: e.target.value })} placeholder={CONTACT_SOURCES.find(c => c.key === form.contact_source)?.placeholder} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Uploads Video On</label>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {PLATFORMS.map(p => {
                                            const checked = form.uploaded_platforms.includes(p.key)
                                            return (
                                                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border-light)'}`, background: checked ? 'rgba(59,130,246,0.08)' : 'transparent', cursor: 'pointer', fontSize: '0.8125rem' }}>
                                                    <input type="checkbox" checked={checked} onChange={e => {
                                                        const next = e.target.checked
                                                            ? [...form.uploaded_platforms, p.key]
                                                            : form.uploaded_platforms.filter(k => k !== p.key)
                                                        setForm({ ...form, uploaded_platforms: next })
                                                    }} />
                                                    {p.icon} {p.label}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group"><label className="form-label">Status</label>
                                        <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                    {/* <div className="form-group"><label className="form-label">Payment Status</label>
                                        <select className="form-input" value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })}>
                                            <option value="Paid">Paid</option>
                                            <option value="Unpaid">Unpaid</option>
                                            <option value="Free">Free</option>
                                        </select>
                                    </div> */}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : 'Save'}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
