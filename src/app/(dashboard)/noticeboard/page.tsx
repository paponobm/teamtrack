'use client'

import RequireFeature from '@/components/common/RequireFeature'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'

interface Notice {
    id: string
    title: string
    content: string | null
    type: 'notice' | 'meeting' | 'announcement' | 'other'
    priority: 'normal' | 'important' | 'urgent' | 'emergency'
    is_pinned: boolean
    expires_at: string | null
    created_at: string
    updated_at: string
    author: { id: string; name: string; employee_id: string; avatar_url?: string | null } | null
    read_count: number
    is_read: boolean
}

interface NoticeReader {
    name: string
    employee_id: string
    read_at: string
    avatar_url?: string | null
}

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } }
}

const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } }
}

const typeColors: Record<string, string> = {
    notice: '#2563EB',
    meeting: '#7C3AED',
    announcement: '#DC2626',
    other: '#6B7280',
}

const typeBadgeClass: Record<string, string> = {
    notice: 'badge-info',
    meeting: 'badge-warning',
    announcement: 'badge-danger',
    other: 'badge-neutral',
}

const priorityBadgeStyles: Record<string, { bg: string; color: string; border: string }> = {
    important: { bg: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' },
    urgent: { bg: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
    emergency: { bg: '#DC2626', color: '#FFFFFF', border: '1px solid #DC2626' },
}

const priorityStyles: Record<string, { border: string; bg: string }> = {
    emergency: { border: '2px solid #DC2626', bg: 'rgba(220, 38, 38, 0.06)' },
    urgent: { border: '2px solid #DC2626', bg: 'rgba(220, 38, 38, 0.04)' },
    important: { border: '2px solid #F59E0B', bg: 'rgba(245, 158, 11, 0.04)' },
    normal: { border: '1px solid var(--color-border-light)', bg: 'transparent' },
}

const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'archive', label: 'Archive' },
]

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[name.charCodeAt(0) % colors.length]
}

const emptyNotice: {
    title: string
    content: string
    type: 'notice' | 'meeting' | 'announcement' | 'other'
    priority: 'normal' | 'important' | 'urgent' | 'emergency'
    is_pinned: boolean
    expires_at: string
} = {
    title: '',
    content: '',
    type: 'notice',
    priority: 'normal',
    is_pinned: false,
    expires_at: '',
}

export default function NoticeboardPage() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const [notices, setNotices] = useState<Notice[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
    const [form, setForm] = useState(emptyNotice)
    const [saving, setSaving] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [readersPopup, setReadersPopup] = useState<{ noticeId: string; readers: NoticeReader[]; loading: boolean } | null>(null)

    const [leavesToday, setLeavesToday] = useState<any[]>([])
    const [loadingLeaves, setLoadingLeaves] = useState(true)
    const [absentToday, setAbsentToday] = useState<any[]>([])
    const [loadingAbsent, setLoadingAbsent] = useState(true)

    const fetchLeavesToday = useCallback(async () => {
        try {
            const res = await fetch('/api/leaves/today')
            if (res.ok) {
                setLeavesToday(await res.json())
            }
        } catch (err) {
            console.error('Failed to fetch leaves today', err)
        } finally {
            setLoadingLeaves(false)
        }
    }, [])

    const fetchAbsentToday = useCallback(async () => {
        try {
            const res = await fetch('/api/attendance/absent')
            if (res.ok) {
                setAbsentToday(await res.json())
            }
        } catch {
            // ignore
        } finally {
            setLoadingAbsent(false)
        }
    }, [])

    const fetchNotices = useCallback(async () => {
        try {
            const res = await fetch('/api/notices?all=true')
            if (res.ok) {
                const data = await res.json()
                setNotices(data)

                // Immediately call read API for any unread ones (skip already-expired notices)
                const unreadIds = (data as Notice[])
                    .filter(n => !n.is_read && (!n.expires_at || new Date(n.expires_at + 'T23:59:59') >= new Date()))
                    .map(n => n.id)

                if (unreadIds.length > 0) {
                    fetch('/api/notices/read', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notice_ids: unreadIds })
                    }).then(r => {
                        if (r.ok) {
                            // Instant UI update
                            setNotices(prev => prev.map(n => {
                                if (unreadIds.includes(n.id)) {
                                    return { ...n, is_read: true, read_count: n.read_count + 1 }
                                }
                                return n
                            }))
                        }
                    }).catch(() => {})
                }
            }
        } catch {
            console.error('Failed to fetch notices')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchNotices()
        fetchLeavesToday()
        fetchAbsentToday()
    }, [fetchNotices, fetchLeavesToday, fetchAbsentToday])

    useEffect(() => {
        if (perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin') {
            setIsAdmin(true)
        }
        if (perms.is_super || perms.role === 'Owner' || perms.role === 'Super Admin') {
            setIsSuperAdmin(true)
        }
    }, [perms])

    const openAddModal = () => {
        setEditingNotice(null)
        setForm(emptyNotice)
        setShowModal(true)
    }

    const openEditModal = (notice: Notice) => {
        setEditingNotice(notice)
        setForm({
            title: notice.title,
            content: notice.content || '',
            type: notice.type,
            priority: notice.priority,
            is_pinned: notice.is_pinned,
            expires_at: notice.expires_at || '',
        })
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!form.title.trim()) return
        setSaving(true)

        try {
            const method = editingNotice ? 'PUT' : 'POST'
            const body = editingNotice
                ? { id: editingNotice.id, ...form }
                : form

            const res = await fetch('/api/notices', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (res.ok) {
                await fetchNotices()
                setShowModal(false)
                setForm(emptyNotice)
                setEditingNotice(null)
                toast.success(editingNotice ? 'Notice updated' : 'Notice posted')
            } else {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || 'Failed to save notice. Please try again.')
            }
        } catch {
            toast.error('Failed to save notice. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this notice?')) return

        try {
            const res = await fetch(`/api/notices?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                await fetchNotices()
                toast.success('Notice deleted')
            } else {
                toast.error('Failed to delete notice')
            }
        } catch {
            toast.error('Failed to delete notice')
        }
    }

    const handleViewReaders = async (noticeId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setReadersPopup({ noticeId, readers: [], loading: true })
        try {
            const res = await fetch(`/api/notices/readers?notice_id=${noticeId}`)
            if (res.ok) {
                const data = await res.json()
                setReadersPopup({ noticeId, readers: data, loading: false })
            }
        } catch {
            setReadersPopup(null)
        }
    }

    const isExpiredNotice = (n: Notice) => !!n.expires_at && new Date(n.expires_at + 'T23:59:59') < new Date()

    // Filter & search
    const filteredNotices = notices.filter(n => {
        if (activeFilter === 'archive') {
            if (!isExpiredNotice(n)) return false
        } else {
            // 'all' tab: hide expired notices (they auto-go to archive)
            if (isExpiredNotice(n)) return false
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (!n.title.toLowerCase().includes(q) && !(n.content || '').toLowerCase().includes(q)) return false
        }
        return true
    })

    const unreadCount = notices.filter(n => {
        const isExpired = n.expires_at && new Date(n.expires_at + 'T23:59:59') < new Date()
        return !n.is_read && !isExpired
    }).length

    return (
        <RequireFeature slugs={['notice-board']}>
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Noticeboard
                        {unreadCount > 0 && (
                            <span style={{
                                background: '#DC2626', color: '#fff', fontSize: '0.6875rem',
                                fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                                lineHeight: 1.4,
                            }}>
                                {unreadCount} new
                            </span>
                        )}
                    </h1>
                    <p className="page-subtitle">Weekly notices, meetings, and important announcements.</p>
                </div>
                {isAdmin && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Add Notice
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Apple-style Segmented Control + Search */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={{
                    display: 'flex',
                    position: 'relative',
                    background: 'rgba(118, 118, 128, 0.08)',
                    borderRadius: '10px',
                    padding: '2px',
                }}>
                    {filterTabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveFilter(tab.key)}
                            style={{
                                position: 'relative',
                                padding: '7px 18px',
                                borderRadius: '8px',
                                border: 'none',
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                letterSpacing: '-0.01em',
                                background: 'transparent',
                                color: activeFilter === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer',
                                transition: 'color 0.2s ease',
                                zIndex: 1,
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            {activeFilter === tab.key && (
                                <motion.div
                                    layoutId="activeTab"
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: 'var(--color-bg-primary)',
                                        borderRadius: '8px',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                    }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
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
                        <input
                            className="form-input"
                            type="text"
                            placeholder="Search notices..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                paddingLeft: '34px',
                                height: '36px',
                                fontSize: '0.8125rem',
                                background: 'rgba(118, 118, 128, 0.08)',
                                border: 'none',
                                borderRadius: '10px',
                                outline: 'none',
                                transition: 'box-shadow 0.2s ease',
                            }}
                            onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)'}
                            onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                        />
                    </div>
                </div>
            </motion.div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-tertiary)' }}>
                            Loading notices...
                        </div>
                    ) : filteredNotices.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>
                                {searchQuery ? 'No matching notices' : 'No notices yet'}
                            </h3>
                            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                                {searchQuery
                                    ? `No notices matching "${searchQuery}"`
                                    : isAdmin ? 'Click "Add Notice" to create the first notice.' : 'No notices have been posted yet.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredNotices.map((notice) => {
                                const pStyle = priorityStyles[notice.priority] || priorityStyles.normal
                                return (
                                    <motion.div
                                        key={notice.id}
                                        className="card"
                                        style={{
                                            border: pStyle.border,
                                            background: pStyle.bg,
                                            position: 'relative',
                                            overflow: 'hidden',
                                        }}
                                        whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {/* Priority stripe */}
                                        {notice.priority !== 'normal' && (
                                            <div style={{
                                                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                                                background: notice.priority === 'emergency' ? '#7F1D1D' : notice.priority === 'urgent' ? '#DC2626' : '#F59E0B',
                                            }} />
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                            {/* Icon */}
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '10px',
                                                background: `${typeColors[notice.type]}15`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, marginTop: '2px',
                                            }}>
                                                {notice.type === 'meeting' ? (
                                                    <svg width="20" height="20" viewBox="0 0 20 20" fill={typeColors[notice.type]}>
                                                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                                    </svg>
                                                ) : notice.type === 'announcement' ? (
                                                    <svg width="20" height="20" viewBox="0 0 20 20" fill={typeColors[notice.type]}>
                                                        <path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg width="20" height="20" viewBox="0 0 20 20" fill={typeColors[notice.type]}>
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                    {notice.is_pinned && (
                                                        <svg width="14" height="14" viewBox="0 0 20 20" fill="#F59E0B" style={{ flexShrink: 0 }}>
                                                            <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V5zm6 7l-1 5-1-5h2z" />
                                                        </svg>
                                                    )}
                                                    {/* Dynamic Badge */}
                                                    {(() => {
                                                        const isExpired = notice.expires_at && new Date(notice.expires_at + 'T23:59:59') < new Date()
                                                        if (isExpired) {
                                                            return (
                                                                <span style={{
                                                                    background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.5625rem',
                                                                    fontWeight: 700, padding: '1px 6px', borderRadius: '6px',
                                                                    letterSpacing: '0.05em', flexShrink: 0, textTransform: 'uppercase'
                                                                }}>
                                                                    Expired
                                                                </span>
                                                            )
                                                        }
                                                        if (!notice.is_read) {
                                                            return (
                                                                <span style={{
                                                                    background: '#2563EB', color: '#fff', fontSize: '0.5625rem',
                                                                    fontWeight: 700, padding: '1px 6px', borderRadius: '6px',
                                                                    letterSpacing: '0.05em', flexShrink: 0,
                                                                }}>
                                                                    NEW
                                                                </span>
                                                            )
                                                        }
                                                        return null
                                                    })()}
                                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{notice.title}</h3>
                                                    <span className={`badge ${typeBadgeClass[notice.type] || 'badge-neutral'}`} style={{ fontSize: '0.6875rem' }}>
                                                        {notice.type}
                                                    </span>
                                                    {notice.priority !== 'normal' && (
                                                        <span style={{
                                                            fontSize: '0.6875rem',
                                                            fontWeight: 700,
                                                            padding: '2px 10px',
                                                            borderRadius: '6px',
                                                            background: priorityBadgeStyles[notice.priority]?.bg || '#E5E7EB',
                                                            color: priorityBadgeStyles[notice.priority]?.color || '#374151',
                                                            border: priorityBadgeStyles[notice.priority]?.border || 'none',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.03em',
                                                        }}>
                                                            {notice.priority}
                                                        </span>
                                                    )}
                                                </div>

                                                {notice.content && (
                                                    <p style={{
                                                        fontSize: '0.875rem', color: 'var(--color-text-secondary)',
                                                        margin: '8px 0', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                                                    }}>
                                                        {notice.content}
                                                    </p>
                                                )}

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '8px' }}>
                                                    {notice.author && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <div style={{
                                                                width: '18px', height: '18px', borderRadius: '50%',
                                                                background: getAvatarColor(notice.author.name),
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: '#fff', fontSize: '0.5625rem', fontWeight: 600, overflow: 'hidden',
                                                            }}>
                                                                {notice.author.avatar_url ? (
                                                                    <img src={notice.author.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : notice.author.name[0]}
                                                            </div>
                                                            {notice.author.name}
                                                        </span>
                                                    )}
                                                    <span>{new Date(notice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                    {notice.expires_at && (
                                                        <span style={{ color: '#DC2626', fontWeight: 600 }}>
                                                            Expires: {new Date(notice.expires_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    )}
                                                    {/* View count - clickable to show readers */}
                                                    <span
                                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', position: 'relative' }}
                                                        onClick={(e) => handleViewReaders(notice.id, e)}
                                                        title="Click to see who viewed this notice"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                        </svg>
                                                        <span style={{ textDecoration: 'underline', fontWeight: 500 }}>{notice.read_count} viewed</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Admin actions */}
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => openEditModal(notice)}
                                                        title="Edit"
                                                        style={{ padding: '6px' }}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                        </svg>
                                                    </button>
                                                    {isAdmin && (
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => handleDelete(notice.id)}
                                                            title="Delete"
                                                            style={{ padding: '6px', color: '#DC2626' }}
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Sidebar Widget (Who's on Leave Today) */}
                <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Absent Today widget */}
                    <div className="card" style={{ padding: '20px', borderColor: absentToday.length > 0 ? 'rgba(220,38,38,0.2)' : undefined }}>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '8px', background: 'rgba(220,38,38,0.1)', fontSize: '0.9375rem' }}>
                                ❌
                            </span>
                            Absent Today
                            {absentToday.length > 0 && (
                                <span style={{ background: '#DC2626', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', marginLeft: 'auto' }}>
                                    {absentToday.length}
                                </span>
                            )}
                        </h3>
                        {loadingAbsent ? (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '12px 0' }}>Checking...</div>
                        ) : absentToday.length === 0 ? (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '12px 0' }}>No unaccounted absences ✓</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {absentToday.map((a: any) => (
                                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(220,38,38,0.03)', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.1)' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: getAvatarColor(a.employee?.name || 'U'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.625rem', fontWeight: 600, overflow: 'hidden', flexShrink: 0 }}>
                                            {a.employee?.avatar_url ? (
                                                <img src={a.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (a.employee?.name || 'U')[0]}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.employee?.name || 'Unknown'}</div>
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{a.employee?.designation || 'Team Member'}</div>
                                        </div>
                                        <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Absent</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', fontSize: '0.9375rem' }}>
                                🏠
                            </span>
                            Out Today
                            {leavesToday.length > 0 && (
                                <span style={{ background: '#F59E0B', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', marginLeft: 'auto' }}>
                                    {leavesToday.length}
                                </span>
                            )}
                        </h3>
                        {loadingLeaves ? (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
                                Loading leaves...
                            </div>
                        ) : leavesToday.length === 0 ? (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
                                Everyone is present today! ✨
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {leavesToday.map((l: any) => (
                                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(245, 158, 11, 0.03)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            background: getAvatarColor(l.employee?.name || 'U'),
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontSize: '0.625rem', fontWeight: 600, overflow: 'hidden', flexShrink: 0
                                        }}>
                                            {l.employee?.avatar_url ? (
                                                <img src={l.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (l.employee?.name || 'U')[0]}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-text-primary)' }}>{l.employee?.name || 'Unknown'}</div>
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.employee?.designation || 'Team Member'}</div>
                                        </div>
                                        <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#D97706', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }} title={l.reason || 'Personal'}>
                                            Leave
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Readers Popup */}
            <AnimatePresence>
                {readersPopup && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setReadersPopup(null)}
                    >
                        <motion.div
                            className="modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ maxWidth: '420px', width: '100%' }}
                        >
                            <div className="modal-header">
                                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="18" height="18" viewBox="0 0 20 20" fill="var(--color-primary)">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                    Notice Viewers
                                </h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setReadersPopup(null)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            <div className="modal-body" style={{ maxHeight: '400px', overflow: 'auto' }}>
                                {readersPopup.loading ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-tertiary)' }}>Loading viewers...</div>
                                ) : readersPopup.readers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-tertiary)' }}>No one has viewed this notice yet</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                                            {readersPopup.readers.length} {readersPopup.readers.length === 1 ? 'person' : 'people'} viewed this notice
                                        </div>
                                        {readersPopup.readers.map((reader, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                    background: getAvatarColor(reader.name),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontSize: '0.625rem', fontWeight: 600, flexShrink: 0, overflow: 'hidden',
                                                }}>
                                                    {reader.avatar_url ? (
                                                        <img src={reader.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : reader.name[0]}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{reader.name}</div>
                                                    {reader.employee_id && (
                                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{reader.employee_id}</div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
                                                    {new Date(reader.read_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            className="modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ maxWidth: '560px', width: '100%' }}
                        >
                            <div className="modal-header">
                                <h2 className="modal-title">{editingNotice ? 'Edit Notice' : 'Add New Notice'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Title *</label>
                                    <input
                                        className="form-input"
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="Notice title..."
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Content</label>
                                    <textarea
                                        className="form-input"
                                        value={form.content}
                                        onChange={(e) => setForm({ ...form, content: e.target.value })}
                                        placeholder="Write your notice content here..."
                                        rows={4}
                                        style={{ resize: 'vertical', minHeight: '100px' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Type</label>
                                        <select
                                            className="form-input"
                                            value={form.type}
                                            onChange={(e) => setForm({ ...form, type: e.target.value as Notice['type'] })}
                                        >
                                            <option value="notice">Notice</option>
                                            <option value="meeting">Meeting</option>
                                            <option value="announcement">Announcement</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select
                                            className="form-input"
                                            value={form.priority}
                                            onChange={(e) => setForm({ ...form, priority: e.target.value as Notice['priority'] })}
                                        >
                                            <option value="normal">Normal</option>
                                            <option value="important">Important</option>
                                            <option value="urgent">Urgent</option>
                                            <option value="emergency">Emergency</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Expires On</label>
                                        <input
                                            className="form-input"
                                            type="date"
                                            value={form.expires_at}
                                            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                                        <input
                                            type="checkbox"
                                            id="pinned"
                                            checked={form.is_pinned}
                                            onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                                        />
                                        <label htmlFor="pinned" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                                            Pin to top
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleSave}
                                    disabled={saving || !form.title.trim()}
                                >
                                    {saving ? 'Saving...' : editingNotice ? 'Update Notice' : 'Create Notice'}
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
