'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { IconClipboard, IconUsers, IconMegaphone, IconPin, IconCheckCircle, IconClock, IconBanknote, IconLayers } from '@/components/icons/Icons'
import React from 'react'
import { useLanguage } from '@/lib/LanguageContext'
import MemberDashboard from '@/components/dashboard/MemberDashboard'
import BirthdayBanner from '@/components/dashboard/BirthdayBanner'
import { usePermissions } from '@/lib/PermissionsContext'
import DatePicker from '@/components/ui/DatePicker'

interface DashboardStats {
    totalMembers: number
    activeToday: number
    attendanceRate: number
    todayOrders: number
    todayAmount: number
    monthOrders: number
    monthAmount: number
    openProblems: number
}

interface ModuleStats {
    attendance: { total: number; present: number; late: number; absent: number; leave: number }
    workLog: { todayOrders: number; todayAmount: number; monthOrders: number; monthAmount: number }
    members: { total: number }
    problems: { total: number; open: number; inProgress: number; resolved: number }
    courier: { total: number; pending: number; resolved: number; fraud: number }
    expenses: { total: number; pending: number; paid: number; rejected: number; count: number }
    requisitions: { total: number; pending: number; approved: number; rejected: number }
}

interface Activity {
    name: string
    action: string
    time: string
    type: string
    avatar_url?: string | null
}

interface Performer {
    id: string
    name: string
    points: number
    orders: number
    avatar_url?: string | null
}

interface DashboardNotice {
    id: string
    title: string
    content: string | null
    type: 'notice' | 'meeting' | 'announcement' | 'other'
    priority: 'normal' | 'important' | 'urgent'
    is_pinned: boolean
    created_at: string
    author: { name: string } | null
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } } }

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Local (not UTC) YYYY-MM-DD so the dashboard day filter doesn't shift in UTC+ timezones.
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[name.charCodeAt(0) % colors.length]
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const noticeStripeColors: Record<string, string> = { notice: '#2563EB', meeting: '#7C3AED', announcement: '#DC2626', other: '#6B7280' }
const noticeBadgeClass: Record<string, string> = { notice: 'badge-info', meeting: 'badge-warning', announcement: 'badge-danger', other: 'badge-neutral' }
const noticeTypeIcons: Record<string, React.ReactNode> = { notice: <IconClipboard size={16} />, meeting: <IconUsers size={16} />, announcement: <IconMegaphone size={16} />, other: <IconPin size={16} /> }

function getDismissedIds(): string[] {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('tt_dismissed_notices') || '[]') } catch { return [] }
}
function dismissNoticeId(id: string) {
    const ids = getDismissedIds()
    if (!ids.includes(id)) { ids.push(id); localStorage.setItem('tt_dismissed_notices', JSON.stringify(ids)) }
}

export default function DashboardPage() {
    const { data: perms, isLoading: permsLoading } = usePermissions()
    const router = useRouter()
    const { t } = useLanguage()
    const [dismissedIds, setDismissedIds] = useState<string[]>([])
    const [dashDate, setDashDate] = useState(() => localDate(new Date()))
    const [dashMode, setDashMode] = useState<'today' | 'yesterday' | 'monthly' | 'custom'>('today')

    const isAdmin = perms?.is_super || ['Owner', 'Super Admin', 'Admin'].includes(perms?.role || '')
    const isSuperAdmin = perms?.is_super || ['Owner', 'Super Admin'].includes(perms?.role || '')
    const employeeId = perms?.employee_id || ''

    const todayStr = localDate(new Date())
    const yesterdayStr = localDate(new Date(Date.now() - 86400000))
    const monthStartStr = localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    const isTodaySelected = dashDate === todayStr && dashMode !== 'monthly'

    const handleModeChange = (mode: 'today' | 'yesterday' | 'monthly' | 'custom') => {
        setDashMode(mode)
        if (mode === 'today') setDashDate(todayStr)
        else if (mode === 'yesterday') setDashDate(yesterdayStr)
        else if (mode === 'monthly') setDashDate(monthStartStr)
    }

    // Fetch data using SWR (date-scoped for admins)
    const { data: dashData } = useSWR(isAdmin ? `/api/dashboard?date=${dashDate}` : null, fetcher, { revalidateOnFocus: true })
    const { data: rawNotices } = useSWR('/api/notices', fetcher, { revalidateOnFocus: true })
    const { data: myStats } = useSWR(!isAdmin && employeeId ? `/api/dashboard/employee?employee_id=${employeeId}` : null, fetcher)

    const notices = Array.isArray(rawNotices) ? rawNotices : []
    const loading = permsLoading || (isAdmin && !dashData) || (!isAdmin && employeeId && !myStats)

    useEffect(() => {
        setDismissedIds(getDismissedIds())
    }, [])

    const handleDismiss = (noticeId: string) => {
        dismissNoticeId(noticeId)
        setDismissedIds(prev => [...prev, noticeId])
        fetch('/api/notices/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notice_id: noticeId }),
        }).catch(() => { })
    }

    // Pinned notices can't be dismissed; others can
    const visibleNotices = notices.filter(n =>
        n.is_pinned || !dismissedIds.includes(n.id)
    ).slice(0, 5)

    const s = dashData?.stats
    const statCards = !isAdmin && myStats ? [
        { label: t('dash.todayOrders'), value: myStats.todayOrders?.toString() || '0', change: `৳${(myStats.todayAmount || 0).toLocaleString()}`, positive: true, color: '#2563EB' },
        { label: t('dash.monthlyOrders'), value: myStats.monthOrders?.toString() || '0', change: `৳${(myStats.monthAmount || 0).toLocaleString()}`, positive: true, color: '#3B82F6' },
        { label: 'Delivery Rate', value: `${myStats.deliveryRate || 0}%`, change: `${myStats.cancelRate || 0}% cancel`, positive: (myStats.deliveryRate || 0) >= 50, color: '#1E40AF' },
        { label: 'My Points', value: myStats.totalPoints?.toString() || '0', change: `${myStats.attendanceRate || 0}% attendance`, positive: true, color: '#1E3A5F' },
    ] : s ? [
        { label: t('dash.totalMembers'), value: s.totalMembers.toString(), change: `${s.activeToday} ${t('dash.activeToday')}`, positive: true, color: '#2563EB' },
        { label: t('dash.todayOrders'), value: s.todayOrders.toString(), change: `৳${s.todayAmount.toLocaleString()}`, positive: true, color: '#3B82F6' },
        { label: t('dash.monthlyOrders'), value: s.monthOrders.toString(), change: `৳${s.monthAmount.toLocaleString()}`, positive: true, color: '#1E40AF' },
        { label: t('dash.openProblems'), value: s.openProblems.toString(), change: s.openProblems > 5 ? t('dash.needsAttention') : t('dash.underControl'), positive: s.openProblems <= 5, color: '#1E3A5F' },
    ] : []

    if (loading) {
        return (
            <div>
                <div className="page-header"><div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Loading...</p></div></div>
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                    <span className="spinner" style={{ margin: '0 auto', display: 'block', width: '32px', height: '32px' }} />
                </div>
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <motion.div variants={container} animate="show">
                <motion.div className="page-header" variants={item}>
                    <div>
                        <h1 className="page-title">{t('dash.title')}</h1>
                        <p className="page-subtitle">{t('dash.welcome')}</p>
                    </div>
                </motion.div>
                <MemberDashboard 
                    myStats={myStats} 
                    employeeId={employeeId} 
                    notices={visibleNotices} 
                    onDismiss={handleDismiss} 
                    timeAgo={timeAgo} 
                />
            </motion.div>
        )
    }

    return (
        <motion.div variants={container} animate="show">
            <BirthdayBanner />
            <motion.div className="page-header" variants={item} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h1 className="page-title">{t('dash.title')}</h1>
                    <p className="page-subtitle">{t('dash.welcome')}</p>
                </div>
                {/* Day filter — Today / Yesterday / Monthly / Custom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                        {([{ key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' }, { key: 'monthly', label: 'Monthly' }, { key: 'custom', label: 'Custom' }] as const).map(tab => (
                            <button key={tab.key} onClick={() => handleModeChange(tab.key)}
                                style={{
                                    position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none',
                                    fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                    color: dashMode === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                    cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                                }}>
                                {dashMode === tab.key && (
                                    <motion.div layoutId="dashDateTab" style={{
                                        position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                        borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                )}
                                <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                    {dashMode === 'custom' && (
                        <motion.div initial={{ opacity: 0, scale: 0.95, x: -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', alignItems: 'center' }}>
                            <DatePicker value={dashDate} max={todayStr} onChange={val => setDashDate(val)} align="right" />
                        </motion.div>
                    )}
                    {!isTodaySelected && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleModeChange('today')} style={{ fontSize: '0.75rem' }} title="Back to today">Reset</button>
                    )}
                </div>
            </motion.div>

            {/* Notice Banners - prominent dismissible cards above stats */}
            {visibleNotices.length > 0 && (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {visibleNotices.map((notice) => {
                        const stripe = noticeStripeColors[notice.type] || '#6B7280'
                        const isUrgent = notice.priority === 'urgent'
                        const isImportant = notice.priority === 'important'
                        return (
                            <motion.div
                                key={notice.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20, height: 0 }}
                                style={{
                                    background: isUrgent ? 'rgba(220,38,38,0.04)' : isImportant ? 'rgba(245,158,11,0.04)' : 'var(--color-bg-primary)',
                                    border: isUrgent ? '1px solid rgba(220,38,38,0.2)' : isImportant ? '1px solid rgba(245,158,11,0.2)' : '1px solid var(--color-border-light)',
                                    borderRadius: '12px',
                                    borderLeft: `4px solid ${stripe}`,
                                    padding: '14px 16px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    boxShadow: isUrgent ? '0 0 0 1px rgba(220,38,38,0.1), 0 2px 8px rgba(220,38,38,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                                    transition: 'box-shadow 0.2s',
                                }}
                                onClick={() => router.push('/noticeboard')}
                                whileHover={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
                            >
                                <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>
                                    {noticeTypeIcons[notice.type]}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {notice.is_pinned && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem', color: '#F59E0B', fontWeight: 600 }}><IconPin size={12} color="#F59E0B" /> PINNED</span>
                                        )}
                                        <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{notice.title}</span>
                                        <span className={`badge ${noticeBadgeClass[notice.type]}`} style={{ fontSize: '0.625rem' }}>{notice.type}</span>
                                        {notice.priority !== 'normal' && (
                                            <span className={`badge ${isUrgent ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.625rem' }}>
                                                {notice.priority}
                                            </span>
                                        )}
                                    </div>
                                    {notice.content && (
                                        <p style={{
                                            fontSize: '0.8125rem', color: 'var(--color-text-secondary)',
                                            margin: '4px 0 0', lineHeight: 1.5,
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                        }}>
                                            {notice.content}
                                        </p>
                                    )}
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {notice.author?.name && <span>{notice.author.name}</span>}
                                        <span>{timeAgo(notice.created_at)}</span>
                                    </div>
                                </div>
                                {!notice.is_pinned && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDismiss(notice.id) }}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                            color: 'var(--color-text-tertiary)', flexShrink: 0, borderRadius: '6px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'color 0.15s, background 0.15s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'var(--color-bg-secondary)' }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'none' }}
                                        title="Dismiss"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}

            {/* Stats Grid for Admin */}
            <motion.div className="grid grid-4" variants={item}>
                {statCards.map((stat) => (
                    <motion.div key={stat.label} className="stat-card" whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} transition={{ duration: 0.2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="stat-label">{stat.label}</span>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stat.color }} />
                            </div>
                        </div>
                        <span className="stat-value">{stat.value}</span>
                        <span className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>{stat.change}</span>
                    </motion.div>
                ))}
            </motion.div>

            {/* Module Stats - All page stats from one view */}
            {isAdmin && dashData?.moduleStats && (
                <>
                    {/* Attendance - same cards as /attendance */}
                    <motion.div variants={item} style={{ marginTop: '24px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => router.push('/attendance')}>
                            <IconClock size={14} /> {t('dash.attendance') || 'Attendance'} →
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                            {[
                                { label: t('dash.present') || 'Present', value: dashData.moduleStats.attendance.present, color: '#16A34A', icon: <IconCheckCircle size={14} color="#16A34A" /> },
                                { label: t('dash.absent') || 'Absent', value: dashData.moduleStats.attendance.absent, color: '#DC2626', icon: null },
                                { label: t('dash.late') || 'Late', value: dashData.moduleStats.attendance.late, color: '#F59E0B', icon: <IconClock size={14} color="#F59E0B" /> },
                                { label: t('dash.onLeave') || 'On Leave', value: dashData.moduleStats.attendance.leave, color: '#7C3AED', icon: null },
                            ].map(s => (
                                <motion.div key={s.label} className="card" whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => router.push('/attendance')}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: `${s.color}12` }}>
                                        {s.icon || <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />}
                                    </span>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.label}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Work Log - same cards as /work-log */}
                    <motion.div variants={item} style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => router.push('/work-log')}>
                            <IconClipboard size={14} /> {t('dash.workLog') || 'Work Log'} →
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                            {[
                                { label: t('dash.todayOrders'), value: dashData.moduleStats.workLog.todayOrders.toString(), sub: `৳${dashData.moduleStats.workLog.todayAmount.toLocaleString()}`, color: '#2563EB', icon: <IconClipboard size={14} color="#2563EB" /> },
                                { label: t('dash.monthlyOrders'), value: dashData.moduleStats.workLog.monthOrders.toString(), sub: `৳${dashData.moduleStats.workLog.monthAmount.toLocaleString()}`, color: '#1E40AF', icon: <IconLayers size={14} color="#1E40AF" /> },
                            ].map(s => (
                                <motion.div key={s.label} className="card" whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => router.push('/work-log')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: `${s.color}12` }}>
                                            {s.icon}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{s.label}</span>
                                    </div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 500 }}>{s.sub}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Members - quick stat */}
                    <motion.div variants={item} style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => router.push('/members')}>
                            <IconUsers size={14} /> {t('dash.members') || 'Members'} →
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                            <motion.div className="card" whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => router.push('/members')}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: '#2563EB12' }}>
                                    <IconUsers size={16} color="#2563EB" />
                                </span>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563EB', lineHeight: 1 }}>{dashData.moduleStats.members.total}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{t('dash.activeMembers') || 'Active Members'}</div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Problems - same cards as /problems */}
                    <motion.div variants={item} style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => router.push('/problems')}>
                            <IconClipboard size={14} /> Problem Box →
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                            {[
                                { label: 'Total', value: dashData.moduleStats.problems.total, color: '#1E3A5F' },
                                { label: 'Open', value: dashData.moduleStats.problems.open, color: '#DC2626' },
                                { label: 'In Progress', value: dashData.moduleStats.problems.inProgress, color: '#F59E0B' },
                                { label: 'Resolved', value: dashData.moduleStats.problems.resolved, color: '#10B981' },
                            ].map(s => (
                                <motion.div key={s.label} className="card" whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => router.push('/problems')}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: `${s.color}10` }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                                    </span>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.label}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Courier - same cards as /courier */}
                    <motion.div variants={item} style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => router.push('/courier')}>
                            <IconBanknote size={14} /> Courier Issues →
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                            {[
                                { label: 'Total Issues', value: dashData.moduleStats.courier.total, color: '#1E3A5F' },
                                { label: 'Pending', value: dashData.moduleStats.courier.pending, color: '#F59E0B' },
                                { label: 'Resolved', value: dashData.moduleStats.courier.resolved, color: '#10B981' },
                                { label: 'Fraud Cases', value: dashData.moduleStats.courier.fraud, color: '#DC2626' },
                            ].map(s => (
                                <motion.div key={s.label} className="card" whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => router.push('/courier')}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: `${s.color}10` }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                                    </span>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.label}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Expenses - same cards as /expenses (super admin only #14) */}
                    {isSuperAdmin && <motion.div variants={item} style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => router.push('/expenses')}>
                            <IconBanknote size={14} /> Expenses →
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                            {[
                                { label: 'Total Expenses', value: `৳${dashData.moduleStats.expenses.total.toLocaleString()}`, sub: `${dashData.moduleStats.expenses.count} entries`, color: '#1E3A5F' },
                                { label: 'Pending', value: `৳${dashData.moduleStats.expenses.pending.toLocaleString()}`, sub: 'Awaiting approval', color: '#F59E0B' },
                                { label: 'Paid', value: `৳${dashData.moduleStats.expenses.paid.toLocaleString()}`, sub: 'Approved & paid', color: '#10B981' },
                                { label: 'Rejected', value: `৳${dashData.moduleStats.expenses.rejected.toLocaleString()}`, sub: 'Not approved', color: '#DC2626' },
                            ].map(s => (
                                <motion.div key={s.label} className="card" whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => router.push('/expenses')}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '4px' }}>{s.label}</div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.sub}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>}

                    {/* Requisitions - same cards as /requisitions */}
                    <motion.div variants={item} style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => router.push('/requisitions')}>
                            <IconLayers size={14} /> Requisitions →
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                            {[
                                { label: 'Total Requests', value: dashData.moduleStats.requisitions.total, color: '#1E3A5F' },
                                { label: 'Pending', value: dashData.moduleStats.requisitions.pending, color: '#F59E0B' },
                                { label: 'Approved', value: dashData.moduleStats.requisitions.approved, color: '#10B981' },
                                { label: 'Rejected', value: dashData.moduleStats.requisitions.rejected, color: '#DC2626' },
                            ].map(s => (
                                <motion.div key={s.label} className="card" whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => router.push('/requisitions')}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: `${s.color}10` }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                                    </span>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.label}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </>
            )}

            {/* Bottom Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                {/* Recent Activity */}
                <motion.div className="card" variants={item}>
                    <div className="card-header">
                        <h3 className="card-title">{t('dash.todayActivity')}</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/work-log')}>View all</button>
                    </div>
                    {(dashData?.recentActivity?.length || 0) === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>{t('dash.noActivity')}</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            {dashData?.recentActivity.map((activity: Activity, i: number) => (
                                <motion.div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < (dashData?.recentActivity.length || 0) - 1 ? '1px solid var(--color-border-light)' : 'none' }}
                                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                                    <div className="avatar avatar-sm" style={{ background: getAvatarColor(activity.name), overflow: 'hidden' }}>
                                        {activity.avatar_url ? (
                                            <img src={activity.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : activity.name[0]}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.875rem' }}><strong>{activity.name}</strong> {activity.action}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{timeAgo(activity.time)}</div>
                                    </div>
                                    <span className="badge badge-info">{activity.type}</span>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Top Performers */}
                <motion.div className="card" variants={item}>
                    <div className="card-header">
                        <h3 className="card-title">{t('dash.topPerformers')}</h3>
                        <span className="badge badge-neutral">{t('dash.thisMonth')}</span>
                    </div>
                    {(dashData?.topPerformers?.length || 0) === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>{t('dash.noScores')}</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            {dashData?.topPerformers.map((performer: Performer, i: number) => (
                                <motion.div key={performer.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: i < (dashData?.topPerformers.length || 0) - 1 ? '1px solid var(--color-border-light)' : 'none' }}
                                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06 }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: i === 0 ? '#2563EB' : i === 1 ? '#93C5FD' : i === 2 ? '#60A5FA' : 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, color: i < 3 ? '#fff' : 'var(--color-text-secondary)' }}>
                                        {i + 1}
                                    </div>
                                    <div className="avatar avatar-sm" style={{ background: getAvatarColor(performer.name), overflow: 'hidden' }}>
                                        {performer.avatar_url ? (
                                            <img src={performer.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : performer.name[0]}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{performer.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{performer.orders} {t('dash.orders')}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)' }}>{performer.points}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{t('dash.points')}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    )
}
