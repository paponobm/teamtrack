'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import { usePermissions } from '@/lib/PermissionsContext'
import Link from 'next/link'

interface SidebarProps {
    user?: {
        name: string
        role: string
        email: string
        avatar_url?: string | null
    }
    onClose?: () => void
    isOpen?: boolean
}

const navItems = [
    {
        sectionKey: 'nav.overview',
        items: [
            { labelKey: 'nav.dashboard', href: '/dashboard', icon: 'dashboard', slugs: null, adminOnly: false },
            { labelKey: 'nav.myProfile', href: '/profile', icon: 'profile', slugs: null, adminOnly: false },
            { labelKey: 'nav.myAttendance', href: '/my-attendance', icon: 'attendance', slugs: null, adminOnly: false },
            { labelKey: 'nav.noticeboard', href: '/noticeboard', icon: 'noticeboard', slugs: ['notice-board'], adminOnly: false },
        ]
    },
    {
        sectionKey: 'nav.work',
        items: [
            { labelKey: 'nav.workLog', href: '/work-log', icon: 'work', slugs: ['work-log', 'orders-2000-plus', 'suggest-orders', 'pending-orders', 'payment-confirmation', 'daily-order-submit', 'refund-exchange', 'customer-review', 'pr-sending'], adminOnly: false },
            { labelKey: 'nav.prManagement', href: '/pr-management', icon: 'memories', slugs: ['pr-sending'], adminOnly: false },
            { labelKey: 'nav.problems', href: '/problems', icon: 'problem', slugs: ['problem-box'], adminOnly: false },
            { labelKey: 'nav.tasks', href: '/tasks', icon: 'tasks', slugs: ['tasks'], adminOnly: false },
            { labelKey: 'nav.todo', href: '/todo', icon: 'tasks', slugs: null, adminOnly: false },
        ]
    },
    {
        sectionKey: 'nav.people',
        items: [
            { labelKey: 'nav.members', href: '/members', icon: 'members', slugs: null, adminOnly: true },
            { labelKey: 'nav.attendance', href: '/attendance', icon: 'attendance', slugs: null, adminOnly: true },
            { labelKey: 'nav.reports', href: '/reports', icon: 'reports', slugs: null, adminOnly: true },
            { labelKey: 'Fines', href: '/fines', icon: 'expense', slugs: null, adminOnly: false },
        ]
    },
    {
        sectionKey: 'nav.operations',
        items: [
            { labelKey: 'nav.courier', href: '/courier', icon: 'courier', slugs: ['courier'], adminOnly: false },
            { labelKey: 'nav.expenses', href: '/expenses', icon: 'expense', slugs: null, adminOnly: true },
            { labelKey: 'Product Buy', href: '/advance-management', icon: 'productBuy', slugs: null, adminOnly: true },
            { labelKey: 'Payroll Management', href: '/payroll-management', icon: 'payroll', slugs: null, adminOnly: 'super' as const },
            { labelKey: 'nav.requisitions', href: '/requisitions', icon: 'requisition', slugs: ['requisitions'], adminOnly: false },
            { labelKey: 'nav.ideas', href: '/ideas', icon: 'idea', slugs: ['idea-sharing'], adminOnly: false },
            { labelKey: 'nav.content', href: '/content', icon: 'content', slugs: ['content'], adminOnly: false },
            { labelKey: 'nav.memories', href: '/memories', icon: 'memories', slugs: ['memories'], adminOnly: false },
        ]
    },
    {
        sectionKey: 'nav.settings',
        adminOnly: 'super' as const,
        items: [
            { labelKey: 'nav.appearance', href: '/settings/appearance', icon: 'appearance', slugs: null, adminOnly: 'super' as const },
            { labelKey: 'nav.auditLog', href: '/audit-log', icon: 'audit', slugs: null, adminOnly: 'super' as const },
            { labelKey: 'nav.settings', href: '/settings', icon: 'settings', slugs: null, adminOnly: 'super' as const },
        ]
    }
]

function NavIcon({ type }: { type: string }) {
    const icons: Record<string, React.ReactElement> = {
        dashboard: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm8 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM3 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm8 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>),
        noticeboard: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>),
        work: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>),
        problem: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>),
        tasks: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" /></svg>),
        members: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>),
        attendance: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>),
        courier: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm7 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M0 4a1 1 0 011-1h9a1 1 0 011 1v7h2V8a1 1 0 011-1h2.382l1.894 3.789A1 1 0 0118.618 11H18v3h-2a3 3 0 01-6 0H8a3 3 0 01-6 0H1a1 1 0 01-1-1V4z" /></svg>),
        expense: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>),
        requisition: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>),
        idea: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zm4.657 2.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM4 11a1 1 0 100-2H3a1 1 0 000 2h1zm3 5v1a1 1 0 102 0v-1a4.002 4.002 0 003.874-3H6.126A4.002 4.002 0 007 16zm-1.464-2.464a1 1 0 10-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707z" /></svg>),
        content: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4zm2 0h1V9h-1v2zm-2-2v-4h2v4h-2zM5 9h2V5H5v4zm0 2v4h2v-4H5z" clipRule="evenodd" /></svg>),
        memories: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /><path d="M8 7a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>),
        appearance: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" /></svg>),
        permissions: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>),
        settings: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>),
        reports: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" /></svg>),
        profile: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>),
        audit: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>),
        leaderboard: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>),
        payroll: (<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zm-8 1a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" /></svg>),
        productBuy: (<svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a1 1 0 01.994.89l1 9A1 1 0 0117 18H3a1 1 0 01-.994-1.11l1-9A1 1 0 014 6h2zm2 0h4V5a1 1 0 00-1-1H9a1 1 0 00-1 1v1zm-1 3a1 1 0 112 0 1 1 0 01-2 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg>),
    }
    return icons[type] || <svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="3" /></svg>
}

export default function Sidebar({ user, onClose, isOpen }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const { lang, setLang, t } = useLanguage()
    const { data, isLoading } = usePermissions()
    const userPermissions = data.permissions
    const isSuper = data.is_super
    const isAdmin = data.is_admin
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [pendingLeavesCount, setPendingLeavesCount] = useState(0)
    const [unreadLeavesCount, setUnreadLeavesCount] = useState(0)
    const [pendingTasksCount, setPendingTasksCount] = useState(0)

    useEffect(() => {
        let mounted = true // guard against setState after unmount (e.g. fast logout)
        // Load collapsed state
        try {
            const saved = localStorage.getItem('tt_sidebar_collapsed')
            if (saved === 'true') setIsCollapsed(true)
        } catch { /* */ }

        // Fetch pending leaves count if admin
        if (isAdmin || isSuper) {
            fetch('/api/leaves/pending-count')
                .then(res => res.json())
                .then(data => {
                    if (mounted && data.count !== undefined) {
                        setPendingLeavesCount(data.count)
                    }
                })
                .catch(err => console.error('Failed to fetch pending leaves count:', err))
        }

        // Fetch unread leaves updates for all users
        fetch('/api/leaves/unread-count')
            .then(res => res.json())
            .then(data => {
                if (mounted && data.count !== undefined) {
                    setUnreadLeavesCount(data.count)
                }
            })
            .catch(err => console.error('Failed to fetch unread leaves count:', err))

        // Fetch pending tasks count
        const fetchPendingTasks = () => {
            fetch('/api/tasks?count_only=true')
                .then(res => res.json())
                .then(data => {
                    if (mounted && data.count !== undefined) {
                        setPendingTasksCount(data.count)
                    }
                })
                .catch(err => console.error('Failed to fetch pending tasks count:', err))
        }
        fetchPendingTasks()

        // Listen for leaves-updated event
        const handleLeavesUpdated = () => {
            fetch('/api/leaves/unread-count').then(res => res.json()).then(data => { if (mounted) setUnreadLeavesCount(data.count || 0) }).catch(() => {})
        }

        const handleTasksUpdated = () => {
            fetchPendingTasks()
        }

        window.addEventListener('leaves-updated', handleLeavesUpdated)
        window.addEventListener('tasks-updated', handleTasksUpdated)
        return () => {
            mounted = false
            window.removeEventListener('leaves-updated', handleLeavesUpdated)
            window.removeEventListener('tasks-updated', handleTasksUpdated)
        }
    }, [isAdmin, isSuper])

    const toggleCollapse = () => {
        setIsCollapsed(prev => {
            const next = !prev
            try { localStorage.setItem('tt_sidebar_collapsed', String(next)) } catch { /* */ }
            // Dispatch resize event so layout adjusts
            window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: next } }))
            return next
        })
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const getAvatarColor = (name: string) => {
        const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
        return colors[name.charCodeAt(0) % colors.length]
    }

    const hasAccess = (item: { slugs: string[] | null; adminOnly?: boolean | 'super' }) => {
        if (item.adminOnly === 'super') return isSuper
        if (item.adminOnly === true) return isAdmin || isSuper
        if (isSuper) return true
        if (isAdmin && !item.slugs) return true // Admins bypass slug checks for normal pages
        if (!item.slugs) return true
        if (isLoading) return false // Still loading, so hide restricted links temporarily until loaded

        // Check if user has access to AT LEAST ONE of the required slugs
        return item.slugs.some((slug: string) => userPermissions && userPermissions[slug] && userPermissions[slug] !== 'no_access')
    }

    const filteredNav = navItems
        .filter(section => {
            const adminProp = (section as { adminOnly?: boolean | 'super' }).adminOnly
            if (adminProp === 'super') return isSuper
            if (adminProp === true) return isAdmin || isSuper
            return true
        })
        .map(section => ({
            ...section,
            items: section.items.filter(item => hasAccess(item)),
        }))
        .filter(section => section.items.length > 0)



    return (
        <>
            <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
            <motion.aside
                className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}
                initial={false}
                animate={{ width: isCollapsed ? 72 : 260 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="sidebar-header" style={{ justifyContent: isCollapsed ? 'center' : undefined }}>
                    {!isCollapsed && (
                        <>
                            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                                <rect width="48" height="48" rx="12" fill="url(#sidebar-logo-gradient)" />
                                <path d="M14 20h20M14 28h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="33" cy="28" r="3" fill="white" />
                                <defs><linearGradient id="sidebar-logo-gradient" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#1E40AF" /><stop offset="1" stopColor="#2563EB" /></linearGradient></defs>
                            </svg>
                            <span className="sidebar-logo">Teamtrack</span>
                            {/* Language Toggle */}
                            <button
                                onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
                                style={{
                                    marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px',
                                    fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)',
                                    transition: 'all 0.2s', letterSpacing: '0.5px',
                                }}
                                title={lang === 'en' ? 'বাংলায় দেখুন' : 'Switch to English'}
                            >
                                {lang === 'en' ? 'বাং' : 'EN'}
                            </button>
                        </>
                    )}
                    {/* Collapse toggle button */}
                    <button
                        onClick={toggleCollapse}
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
                            cursor: 'pointer', transition: 'all 0.2s',
                            marginLeft: isCollapsed ? 0 : '4px', flexShrink: 0,
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}>
                            <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                <div className="sidebar-user-container" style={{ padding: '0 12px', margin: '8px 0 16px 0', flexShrink: 0 }}>
                    <div className="sidebar-user" style={isCollapsed ? { justifyContent: 'center', padding: '12px 8px' } : undefined}>
                        <div className="avatar avatar-sm" style={{ background: getAvatarColor(user?.name || 'U'), overflow: 'hidden', flexShrink: 0 }}>
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (user?.name || 'U')[0].toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="sidebar-user-info">
                                <div className="sidebar-user-name">{user?.name || 'User'}</div>
                                <div className="sidebar-user-role">{user?.role || 'Member'}</div>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {filteredNav.map((section) => (
                        <div key={section.sectionKey}>
                            {!isCollapsed && (
                                <div className="sidebar-section-title">{t(section.sectionKey)}</div>
                            )}
                            {section.items.map((navItem) => (
                                <Link
                                    key={navItem.href}
                                    href={navItem.href}
                                    // Highlight the parent nav item on its sub-pages too (e.g. /settings/appearance).
                                    className={`sidebar-link ${pathname === navItem.href || pathname.startsWith(navItem.href + '/') ? 'active' : ''}`}
                                    // Let <Link> handle navigation natively (so cmd/ctrl/shift-click open new tabs);
                                    // just close the mobile drawer on a normal click.
                                    onClick={() => onClose?.()}
                                    title={isCollapsed ? t(navItem.labelKey) : undefined}
                                    style={isCollapsed ? { justifyContent: 'center', padding: '10px' } : undefined}
                                >
                                    <NavIcon type={navItem.icon} />
                                    {!isCollapsed && t(navItem.labelKey)}
                                    {/* My Attendance: the member's OWN leave-decision alert (everyone) */}
                                    {navItem.href === '/my-attendance' && unreadLeavesCount > 0 && (
                                        <div style={{
                                            marginLeft: isCollapsed ? '0' : 'auto',
                                            position: isCollapsed ? 'absolute' : 'static',
                                            top: isCollapsed ? '8px' : 'auto',
                                            right: isCollapsed ? '8px' : 'auto',
                                            background: '#ef4444',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            padding: isCollapsed ? '2px 4px' : '2px 8px',
                                            borderRadius: '12px',
                                            lineHeight: 1,
                                            minWidth: isCollapsed ? '16px' : 'auto',
                                            textAlign: 'center'
                                        }}>
                                            {unreadLeavesCount}
                                        </div>
                                    )}
                                    {/* Attendance (admin page): count of NEW leave requests awaiting action */}
                                    {navItem.href === '/attendance' && pendingLeavesCount > 0 && (
                                        <div style={{
                                            marginLeft: isCollapsed ? '0' : 'auto',
                                            position: isCollapsed ? 'absolute' : 'static',
                                            top: isCollapsed ? '8px' : 'auto',
                                            right: isCollapsed ? '8px' : 'auto',
                                            background: '#ef4444',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            padding: isCollapsed ? '2px 4px' : '2px 8px',
                                            borderRadius: '12px',
                                            lineHeight: 1,
                                            minWidth: isCollapsed ? '16px' : 'auto',
                                            textAlign: 'center'
                                        }}>
                                            {pendingLeavesCount}
                                        </div>
                                    )}
                                    {navItem.href === '/tasks' && pendingTasksCount > 0 && (
                                        <div style={{
                                            marginLeft: isCollapsed ? '0' : 'auto',
                                            position: isCollapsed ? 'absolute' : 'static',
                                            top: isCollapsed ? '8px' : 'auto',
                                            right: isCollapsed ? '8px' : 'auto',
                                            background: '#ef4444',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            padding: isCollapsed ? '2px 4px' : '2px 8px',
                                            borderRadius: '12px',
                                            lineHeight: 1,
                                            minWidth: isCollapsed ? '16px' : 'auto',
                                            textAlign: 'center'
                                        }}>
                                            {pendingTasksCount}
                                        </div>
                                    )}
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="sidebar-logout-btn" style={isCollapsed ? { justifyContent: 'center', padding: '12px 8px' } : undefined}>
                        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '18px', height: '18px', flexShrink: 0 }}>
                            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                        </svg>
                        {!isCollapsed && <span>Logout</span>}
                    </button>
                </div>
            </motion.aside>
        </>
    )
}
