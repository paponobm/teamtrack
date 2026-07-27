'use client'

import RequireFeature from '@/components/common/RequireFeature'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconLightbulb, IconCheckCircle, IconXCircle, IconRocket, IconEdit, IconInbox, IconMessageCircle } from '@/components/icons/Icons'
import React from 'react'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import DatePicker from '@/components/ui/DatePicker'

interface Idea {
    id: string
    title: string | null
    description: string | null
    category: string | null
    priority: string
    status: 'submitted' | 'accepted' | 'rejected' | 'implemented'
    approval_status: 'pending' | 'approved' | 'rejected'
    feedback: string | null
    reference_links: string | null
    author: { id: string; name: string; avatar_url?: string | null } | null
    created_at: string
    idea_no?: number
}

// Local (not UTC) YYYY-MM-DD so date-range filters don't shift a day in UTC+ timezones.
const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    submitted: { label: 'Submitted', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', icon: <IconLightbulb size={16} color="#3B82F6" /> },
    accepted: { label: 'Accepted', color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: <IconCheckCircle size={16} color="#10B981" /> },
    rejected: { label: 'Rejected', color: '#DC2626', bg: 'rgba(220,38,38,0.08)', icon: <IconXCircle size={16} color="#DC2626" /> },
    implemented: { label: 'Implemented', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', icon: <IconRocket size={16} color="#7C3AED" /> },
}

const ideaCategories = ['General', 'Product', 'Marketing', 'Sales', 'Operations', 'HR', 'Tech']

const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'implemented', label: 'Implemented' },
]

const emptyForm = { title: '', description: '', category: 'General', priority: 'medium', reference_links: '' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getName = (obj: any) => { if (!obj) return null; return Array.isArray(obj) ? obj[0]?.name : obj.name }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#7C3AED', '#DC2626', '#10B981', '#F59E0B', '#EC4899', '#1E3A5F', '#6366F1']
    return colors[name.charCodeAt(0) % colors.length]
}

export default function IdeasPage() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const [ideas, setIdeas] = useState<Idea[]>([])
    const [stats, setStats] = useState({ total: 0, submitted: 0, accepted: 0, implemented: 0 })
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)

    // Date range state
    const [dateRangeMode, setDateRangeMode] = useState<'today' | 'week' | 'month' | 'custom'>('month')
    const [refDate, setRefDate] = useState(() => fmtLocalDate(new Date()))
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    const getWeekRange = (d: Date) => {
        const day = d.getDay()
        const start = new Date(d); start.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
        const end = new Date(start); end.setDate(start.getDate() + 6)
        return { start: fmtLocalDate(start), end: fmtLocalDate(end) }
    }
    const getMonthRange = (d: Date) => {
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        return { start: fmtLocalDate(start), end: fmtLocalDate(end) }
    }

    const fetchData = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (dateRangeMode === 'today') {
                params.set('start_date', refDate)
                params.set('end_date', refDate)
            } else if (dateRangeMode === 'week') {
                const r = getWeekRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRangeMode === 'month') {
                const r = getMonthRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRangeMode === 'custom' && customStart && customEnd) {
                params.set('start_date', customStart)
                params.set('end_date', customEnd)
            }
            const res = await fetch(`/api/ideas?${params}`)
            if (res.ok) { const d = await res.json(); setIdeas(d.ideas || []); setStats(d.stats || { total: 0, submitted: 0, accepted: 0, implemented: 0 }) }
        } catch { console.error('Failed') }
        finally { setLoading(false) }
    }, [dateRangeMode, refDate, customStart, customEnd])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin') setIsAdmin(true)
        if (perms.is_super || perms.role === 'Owner' || perms.role === 'Super Admin') setIsSuperAdmin(true)
    }, [perms])

    const handleSave = async () => {
        if (!form.title.trim()) return
        setSaving(true)
        try {
            const res = await fetch('/api/ideas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    reference_links: form.reference_links || null,
                }),
            })
            if (res.ok) { await fetchData(); setShowModal(false); setForm(emptyForm) }
        } catch { console.error('Save failed') }
        finally { setSaving(false) }
    }

    const handleStatusChange = async (id: string, status: string) => {
        const res = await fetch('/api/ideas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, approval_status: status === 'accepted' || status === 'implemented' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending' }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to update idea'); return }
        await fetchData()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this idea?')) return
        const res = await fetch(`/api/ideas?id=${id}`, { method: 'DELETE' })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to delete idea'); return }
        toast.success('Idea deleted')
        await fetchData()
    }

    const filtered = ideas.filter(i => {
        if (activeFilter !== 'all' && i.status !== activeFilter) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (!(i.title || '').toLowerCase().includes(q) &&
                !(i.description || '').toLowerCase().includes(q) &&
                !(i.idea_no?.toString().includes(q))) return false
        }
        return true
    })

    const statCards: { label: string; value: number; color: string; icon: React.ReactNode }[] = [
        { label: 'Total Ideas', value: stats.total, color: '#1E3A5F', icon: <IconLightbulb size={20} color="#1E3A5F" /> },
        { label: 'Submitted', value: stats.submitted, color: '#3B82F6', icon: <IconEdit size={20} color="#3B82F6" /> },
        { label: 'Accepted', value: stats.accepted, color: '#10B981', icon: <IconCheckCircle size={20} color="#10B981" /> },
        { label: 'Implemented', value: stats.implemented, color: '#7C3AED', icon: <IconRocket size={20} color="#7C3AED" /> },
    ]

    return (
        <RequireFeature slugs={['idea-sharing']}>
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Idea Board</h1>
                    <p className="page-subtitle">Share creative ideas and vote on improvements.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyForm); setShowModal(true) }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Share Idea
                </button>
            </motion.div>

            {/* Date Range Selector */}
            <motion.div variants={item} style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {([{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }] as const).map(tab => (
                        <button key={tab.key} onClick={() => setDateRangeMode(tab.key)}
                            style={{
                                position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                color: dateRangeMode === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                            }}>
                            {dateRangeMode === tab.key && (
                                <motion.div layoutId="ideaDateTab" style={{
                                    position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                    borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>
                {(dateRangeMode === 'today' || dateRangeMode === 'week' || dateRangeMode === 'month') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => {
                            const d = new Date(refDate + 'T00:00:00'); if (dateRangeMode === 'month') d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - (dateRangeMode === 'week' ? 7 : 1)); setRefDate(fmtLocalDate(d))
                        }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                        <button className="btn btn-ghost btn-icon" onClick={() => {
                            const d = new Date(refDate + 'T00:00:00'); if (dateRangeMode === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + (dateRangeMode === 'week' ? 7 : 1)); setRefDate(fmtLocalDate(d))
                        }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                )}
                {dateRangeMode === 'custom' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95, x: -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DatePicker value={customStart} onChange={val => setCustomStart(val)} align="right" />
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>to</span>
                        <DatePicker value={customEnd} onChange={val => setCustomEnd(val)} align="right" />
                    </motion.div>
                )}
            </motion.div>

            {/* Stats */}
            <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {statCards.map(s => (
                    <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: `${s.color}10` }}>{s.icon}</span>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* Filters + Search */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {filterTabs.map(tab => (
                        <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                            style={{
                                position: 'relative', padding: '7px 16px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                color: activeFilter === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                            }}>
                            {activeFilter === tab.key && (
                                <motion.div layoutId="ideaTab" style={{
                                    position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                    borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                    <div style={{ position: 'relative' }}>
                        <svg width="15" height="15" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                        <input className="form-input" type="text" placeholder="Search by title, desc, ID..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '34px', height: '36px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px' }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Ideas Grid */}
            {loading ? (
                <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div className="skeleton" style={{ width: 60, height: 22, borderRadius: '12px' }} />
                                <div className="skeleton" style={{ width: 40, height: 14 }} />
                            </div>
                            <div className="skeleton" style={{ width: '80%', height: 14 }} />
                            <div className="skeleton" style={{ width: '100%', height: 10 }} />
                            <div className="skeleton" style={{ width: '45%', height: 10 }} />
                        </div>
                    ))}
                </motion.div>
            ) : filtered.length === 0 ? (
                <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><IconLightbulb size={48} color="var(--color-text-tertiary)" /></div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>No ideas yet</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Be the first to share an idea!</p>
                </motion.div>
            ) : (
                <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {filtered.map(idea => {
                        const sc = statusConfig[idea.status] || statusConfig.submitted
                        const authorName = getName(idea.author)
                        return (
                            <motion.div key={idea.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}
                                whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }} transition={{ duration: 0.2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '1.25rem' }}>{sc.icon}</span>
                                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: sc.bg }}>{sc.label}</span>
                                    {idea.category && (
                                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 500, background: 'rgba(118,118,128,0.08)', color: 'var(--color-text-tertiary)' }}>
                                            {idea.category}
                                        </span>
                                    )}
                                </div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px', lineHeight: 1.4 }}>
                                    {idea.idea_no ? <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', marginRight: '6px', fontWeight: 500 }}>#{idea.idea_no}</span> : null}
                                    {idea.title}
                                </h3>
                                {idea.description && (
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {idea.description}
                                    </p>
                                )}

                                {idea.reference_links && (
                                    <div style={{ margin: '4px 0 6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {idea.reference_links.split(',').map((link, i) => {
                                            const url = link.trim()
                                            if (!url) return null
                                            return (
                                                <a key={i} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer"
                                                    style={{ fontSize: '0.6875rem', color: '#2563EB', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 20 20" fill="#2563EB"><path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 001.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" /></svg>
                                                    Link {i + 1}
                                                </a>
                                            )
                                        })}
                                    </div>
                                )}

                                {idea.feedback && (
                                    <div style={{ margin: '8px 0', padding: '8px 12px', borderRadius: '8px', background: 'rgba(118,118,128,0.05)', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconMessageCircle size={12} /> {idea.feedback}</span>
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                        {authorName && (
                                            <div style={{
                                                width: '20px', height: '20px', borderRadius: '50%',
                                                background: getAvatarColor(authorName),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', fontSize: '0.5625rem', fontWeight: 600, overflow: 'hidden',
                                            }}>{(() => { const av = idea.author ? (Array.isArray(idea.author) ? (idea.author as any)[0]?.avatar_url : idea.author.avatar_url) : null; return av ? <img src={av} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : authorName[0]; })()}</div>
                                        )}
                                        {authorName || 'Anonymous'}
                                        <span>·</span>
                                        <span>{new Date(idea.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    {isAdmin && (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {idea.status === 'submitted' && (
                                                <>
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(idea.id, 'accepted')} style={{ padding: '2px 8px', fontSize: '0.6875rem', height: '24px', background: '#10B981', border: 'none' }}>Accept</button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(idea.id, 'rejected')} style={{ padding: '2px 8px', fontSize: '0.6875rem', height: '24px' }}>Reject</button>
                                                </>
                                            )}
                                            {idea.status === 'accepted' && (
                                                <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(idea.id, 'implemented')} style={{ padding: '2px 8px', fontSize: '0.6875rem', height: '24px', background: '#7C3AED', border: 'none' }}>Mark Implemented</button>
                                            )}
                                            {(idea.status === 'rejected' || idea.status === 'implemented') && (
                                                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{idea.status === 'rejected' ? 'Rejected' : 'Implemented'}</span>
                                            )}
                                            {isSuperAdmin && <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(idea.id)} style={{ padding: '2px', color: '#DC2626' }}>
                                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                            </button>}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}

            {/* Submit Idea Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IconLightbulb size={20} color="#3B82F6" /> Share an Idea</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} autoComplete="off">
                                <div className="form-group">
                                    <label className="form-label">Title *</label>
                                    <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Your idea in a sentence..." name="ideaTitle" id="ideaTitle" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Explain your idea in detail..." rows={4} style={{ resize: 'vertical', minHeight: '100px' }} name="ideaDesc" id="ideaDesc" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} name="ideaCategory">
                                            {ideaCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} name="ideaPriority">
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reference Links</label>
                                    <input className="form-input" value={form.reference_links} onChange={e => setForm({ ...form, reference_links: e.target.value })} placeholder="Paste URLs separated by commas..." name="ideaLinks" id="ideaLinks" />
                                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '2px', display: 'block' }}>Separate multiple links with commas</span>
                                </div>
                            </form>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.title.trim()}>
                                    {saving ? 'Submitting...' : 'Share Idea'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
        </RequireFeature>
    )
}
