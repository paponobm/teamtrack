'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useLanguage } from '@/lib/LanguageContext'
import { motion, AnimatePresence } from 'framer-motion'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface HeaderProps {
    title?: string
    onMenuClick?: () => void
}

interface Notification {
    id: string
    title: string
    message: string | null
    type: string | null
    related_entity_type: string | null
    related_entity_id: string | null
    is_read: boolean
    created_at: string
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

export default function Header({ title, onMenuClick }: HeaderProps) {
    const [searchFocused, setSearchFocused] = useState(false)
    const { t } = useLanguage()
    const router = useRouter()
    
    // Notifications SWR
    const { data: notifData, mutate: mutateNotifs } = useSWR('/api/notifications', fetcher, {
        refreshInterval: 30000, // Poll every 30s
        revalidateOnFocus: true,
    })
    const notifications: Notification[] = notifData?.notifications || []
    const unreadCount = notifData?.unread_count || 0

    const [showNotifs, setShowNotifs] = useState(false)
    const [darkMode, setDarkMode] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLDivElement>(null)
    const [searchQuery, setSearchQuery] = useState('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [searchResults, setSearchResults] = useState<any[]>([])
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(null)
    
    // Notification Details Modal State
    const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [notifDetails, setNotifDetails] = useState<any>(null)
    const [loadingDetails, setLoadingDetails] = useState(false)

    const handleSearch = (q: string) => {
        if (searchTimer.current) clearTimeout(searchTimer.current)
        if (q.length < 2) { setSearchResults([]); return }
        searchTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
                if (res.ok) { const data = await res.json(); setSearchResults(data.results || []) }
            } catch { /* ignore */ }
        }, 300)
    }

    useEffect(() => {
        // Load dark mode preference
        const saved = localStorage.getItem('teamtrack-theme')
        if (saved === 'dark') { setDarkMode(true); document.documentElement.setAttribute('data-theme', 'dark') }
    }, [])

    // Clear the search debounce on unmount so it can't fire setState after the Header is gone.
    useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

    // Close the notification details modal on Escape.
    useEffect(() => {
        if (!selectedNotif) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedNotif(null) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [selectedNotif])

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowNotifs(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const toggleDarkMode = () => {
        const next = !darkMode
        setDarkMode(next)
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
        localStorage.setItem('teamtrack-theme', next ? 'dark' : 'light')
    }

    const markAllRead = async () => {
        try {
            if (notifications.length === 0) return
            await fetch('/api/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mark_all_read: true, employee_id: 'all' }),
            })
            mutateNotifs((prev: any) => ({
                ...prev,
                notifications: prev.notifications.map((n: any) => ({ ...n, is_read: true })),
                unread_count: 0
            }), false)
        } catch { /* ignore */ }
    }

    const handleNotifClick = async (n: Notification) => {
        // Mark as read immediately
        if (!n.is_read) {
            try {
                await fetch('/api/notifications', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: n.id }),
                })
                mutateNotifs((prev: any) => ({
                    ...prev,
                    notifications: prev.notifications.map((x: any) => x.id === n.id ? { ...x, is_read: true } : x),
                    unread_count: Math.max(0, prev.unread_count - 1)
                }), false)
            } catch { /* ignore */ }
        }

        // Fetch details if it's an audit log
        if (n.related_entity_type === 'audit_log' && n.related_entity_id) {
            setShowNotifs(false)
            setSelectedNotif(n)
            setLoadingDetails(true)
            try {
                const res = await fetch(`/api/audit-log?id=${n.related_entity_id}`)
                if (res.ok) {
                    const data = await res.json()
                    setNotifDetails(data.entry)
                }
            } catch { /* ignore */ }
            setLoadingDetails(false)
        } else {
            // It's an old notification or doesn't have details, just close the dropdown
            setShowNotifs(false)
        }
    }

    return (
        <header className="header">
            <div className="header-left">
                <button className="sidebar-toggle" id="sidebar-toggle" onClick={onMenuClick}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
                {title && <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{title}</h2>}
                <div className="header-search" style={{ position: 'relative' }} ref={searchRef}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill={searchFocused ? '#0071E3' : '#86868B'} style={{ transition: 'fill 150ms' }}>
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <input
                        type="text"
                        placeholder={t('common.search')}
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); handleSearch(e.target.value) }}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    />
                    {searchFocused && searchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'var(--color-bg-primary)', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)', zIndex: 1000, maxHeight: '360px', overflowY: 'auto', minWidth: '320px' }}>
                            {searchResults.map((r: { type: string; id: string; title: string; subtitle: string; href: string }) => (
                                <div key={`${r.type}-${r.id}`} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(118,118,128,0.06)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    onMouseDown={() => { router.push(r.href); setSearchQuery(''); setSearchResults([]); setSearchFocused(false) }}>
                                    <span className="badge badge-info" style={{ fontSize: '0.5625rem', textTransform: 'uppercase' }}>{r.type}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{r.subtitle}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {/* Dark mode toggle */}
                <button className="notification-btn" onClick={toggleDarkMode} title={darkMode ? 'Light mode' : 'Dark mode'}
                    style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>
                    {darkMode ? (
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                        </svg>
                    )}
                </button>

                {/* Notifications */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <button className="notification-btn" id="notifications-btn" onClick={() => setShowNotifs(!showNotifs)}
                        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                        </svg>
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '4px', right: '4px',
                                width: '16px', height: '16px', borderRadius: '50%',
                                background: '#DC2626', color: '#fff', fontSize: '0.5625rem',
                                fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px solid var(--color-bg-primary)',
                            }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>

                    <AnimatePresence>
                        {showNotifs && (
                            <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                    width: '360px', maxHeight: '420px', overflowY: 'auto',
                                    background: 'var(--color-bg-primary)',
                                    borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                                    zIndex: 1000,
                                }}
                            >
                                <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)' }}>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Notifications</span>
                                    {unreadCount > 0 && (
                                        <button onClick={markAllRead} style={{ fontSize: '0.75rem', color: '#0071E3', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Mark all read</button>
                                    )}
                                </div>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>
                                        No notifications yet
                                    </div>
                                ) : (
                                    <div style={{ padding: '4px 0' }}>
                                        {notifications.slice(0, 20).map(n => (
                                            <div key={n.id} style={{
                                                padding: '10px 16px', display: 'flex', gap: '10px',
                                                background: n.is_read ? 'transparent' : 'rgba(0,113,227,0.03)',
                                                cursor: 'pointer', transition: 'background 0.15s',
                                            }}
                                                onClick={() => handleNotifClick(n)}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(118,118,128,0.06)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(0,113,227,0.03)')}>
                                                <div style={{
                                                    width: '8px', height: '8px', borderRadius: '50%', marginTop: '5px', flexShrink: 0,
                                                    background: n.is_read ? 'transparent' : '#0071E3',
                                                }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.8125rem', fontWeight: n.is_read ? 400 : 600, lineHeight: 1.4 }}>{n.title}</div>
                                                    {n.message && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px', lineHeight: 1.4 }}>{n.message}</div>}
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>{timeAgo(n.created_at)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Notification Details Modal */}
            <AnimatePresence>
                {selectedNotif && (
                    <div
                        onClick={() => setSelectedNotif(null)}
                        style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                    }}>
                        <motion.div
                            onClick={e => e.stopPropagation()}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            style={{
                                background: 'var(--color-bg-primary)',
                                borderRadius: '16px',
                                width: '100%', maxWidth: '500px',
                                maxHeight: '90vh', overflowY: 'auto',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                                display: 'flex', flexDirection: 'column'
                            }}
                        >
                            <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>{selectedNotif.title}</h3>
                                <button onClick={() => { setSelectedNotif(null); setNotifDetails(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                            
                            <div style={{ padding: '24px 20px' }}>
                                <p style={{ fontSize: '0.9375rem', margin: '0 0 20px 0', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                    {selectedNotif.message}
                                </p>

                                {loadingDetails ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
                                        <div className="spinner"></div>
                                    </div>
                                ) : notifDetails ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--color-bg-secondary)', padding: '12px 16px', borderRadius: '12px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0071E3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', fontWeight: 600 }}>
                                                {notifDetails.actor?.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{notifDetails.actor?.name || 'Unknown User'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                                                    {notifDetails.module?.replace('_', ' ')}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ background: 'var(--color-bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Action Performed</div>
                                            <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{notifDetails.action}</div>
                                            
                                            {notifDetails.details && Object.keys(notifDetails.details).length > 0 && (
                                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border-light)' }}>
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 500 }}>Additional Details</div>
                                                    <pre style={{ margin: 0, padding: '12px', background: 'var(--color-bg-primary)', borderRadius: '8px', fontSize: '0.8125rem', overflowX: 'auto', border: '1px solid var(--color-border-light)' }}>
                                                        {JSON.stringify(notifDetails.details, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                                            {new Date(notifDetails.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-tertiary)', borderRadius: '12px' }}>
                                        Details could not be loaded.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </header>
    )
}
