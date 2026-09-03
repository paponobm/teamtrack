'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/LanguageContext'
import { useToast } from '@/lib/ToastContext'
import { IconClipboard, IconUsers, IconPin, IconMegaphone, IconCheckCircle, IconClock, IconLayers, IconBanknote } from '@/components/icons/Icons'
import BirthdayBanner from '@/components/dashboard/BirthdayBanner'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function MemberDashboard({ myStats, employeeId, notices, onDismiss, timeAgo }: { myStats: any; employeeId: string; notices: any[]; onDismiss: (id: string) => void; timeAgo: (date: string) => string }) {
    const { t } = useLanguage()
    const router = useRouter()
    const toast = useToast()
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [tasks, setTasks] = useState<any[]>([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [points, setPoints] = useState<any[]>([])
    const [loadingTasks, setLoadingTasks] = useState(true)

    useEffect(() => {
        if (!employeeId) {
            setLoadingTasks(false)
            return
        }
        
        Promise.all([
            fetch('/api/tasks').then(r => r.json()).catch(() => []),
            fetch(`/api/points?employee_id=${employeeId}&limit=5`).then(r => r.json()).catch(() => [])
        ]).then(([taskData, pointData]) => {
            if (Array.isArray(taskData)) {
                // Filter specifically to pending assignments or in_progress tasks
                const myActiveTasks = taskData.filter(t => 
                    t.status !== 'completed' && 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    t.task_assignments?.some((a: any) => a.employee_id === employeeId && a.status !== 'rejected')
                ).slice(0, 5)
                setTasks(myActiveTasks)
            }
            if (Array.isArray(pointData)) setPoints(pointData)
            setLoadingTasks(false)
        })
    }, [employeeId])

    const statCards = [
        { label: 'My Points', value: myStats?.totalPoints?.toString() || '0', change: 'Total earned', positive: true, color: '#F59E0B' },
        { label: 'Attendance', value: `${myStats?.presentDays ?? 0}P / ${myStats?.absentDays ?? 0}A / ${myStats?.lateDays ?? 0}L`, change: 'Present / Absent / Late', positive: (myStats?.attendanceRate || 0) >= 80, color: '#10B981' },
        { label: 'Work Logged', value: myStats?.monthOrders?.toString() || '0', change: 'Entries this month', positive: true, color: '#3B82F6' },
        { label: 'Active Tasks', value: tasks.length.toString(), change: 'Requires action', positive: tasks.length === 0, color: '#1E3A5F' },
    ]

    const handleTaskAction = async (taskId: string, action: 'accepted' | 'rejected' | 'completed') => {
        try {
            const res = action === 'completed'
                ? await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, status: 'completed' }) })
                : await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, assignment_response: action }) })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err.error || 'Action failed. Please try again.')
                return // do NOT remove the task from the list on failure
            }
            // Only remove from the list after the server confirms
            setTasks(prev => prev.filter(t => t.id !== taskId))
            if (action === 'accepted') toast.success('Task accepted')
            if (action === 'completed') toast.success('Task completed 🎉')
            // Refresh the points list so the "Recent Points" panel reflects the award
            const pts = await fetch(`/api/points?employee_id=${employeeId}&limit=5`).then(r => r.json()).catch(() => [])
            if (Array.isArray(pts)) setPoints(pts)
        } catch (e) {
            console.error(e)
            toast.error('Something went wrong. Please try again.')
        }
    }

    const noticeStripeColors: Record<string, string> = { notice: '#2563EB', meeting: '#7C3AED', announcement: '#DC2626', other: '#6B7280' }
    const noticeBadgeClass: Record<string, string> = { notice: 'badge-info', meeting: 'badge-warning', announcement: 'badge-danger', other: 'badge-neutral' }
    const noticeTypeIcons: Record<string, React.ReactNode> = { notice: <IconClipboard size={16} />, meeting: <IconUsers size={16} />, announcement: <IconMegaphone size={16} />, other: <IconPin size={16} /> }

    return (
        <motion.div variants={container} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <BirthdayBanner />

            {/* Notices */}
            {notices && notices.length > 0 && (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {notices.map((notice) => {
                        const stripe = noticeStripeColors[notice.type] || '#6B7280'
                        const isUrgent = notice.priority === 'urgent'
                        const isImportant = notice.priority === 'important'
                        return (
                            <motion.div key={notice.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                style={{
                                    background: isUrgent ? 'rgba(220,38,38,0.04)' : isImportant ? 'rgba(245,158,11,0.04)' : 'var(--color-bg-primary)',
                                    border: isUrgent ? '1px solid rgba(220,38,38,0.2)' : isImportant ? '1px solid rgba(245,158,11,0.2)' : '1px solid var(--color-border-light)',
                                    borderRadius: '12px', borderLeft: `4px solid ${stripe}`, padding: '14px 16px',
                                    display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer',
                                    boxShadow: isUrgent ? '0 0 0 1px rgba(220,38,38,0.1), 0 2px 8px rgba(220,38,38,0.08)' : '0 1px 3px rgba(0,0,0,0.04)'
                                }} onClick={() => router.push('/noticeboard')}
                            >
                                <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>{noticeTypeIcons[notice.type]}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {notice.is_pinned && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem', color: '#F59E0B', fontWeight: 600 }}><IconPin size={12} color="#F59E0B" /> PINNED</span>}
                                        <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{notice.title}</span>
                                        <span className={`badge ${noticeBadgeClass[notice.type]}`} style={{ fontSize: '0.625rem' }}>{notice.type}</span>
                                        {notice.priority !== 'normal' && <span className={`badge ${isUrgent ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.625rem' }}>{notice.priority}</span>}
                                    </div>
                                    {notice.content && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '4px 0 0', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{notice.content}</p>}
                                </div>
                                {!notice.is_pinned && (
                                    <button onClick={(e) => { e.stopPropagation(); onDismiss(notice.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-tertiary)' }}>
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                )}
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}

            {/* Quick Actions Row */}
            <motion.div variants={item} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => router.push('/work-log')} style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <IconClipboard size={18} /> Log Work
                </button>
                <button className="btn btn-secondary" onClick={() => router.push('/problems')} style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <IconMegaphone size={18} /> Report Problem
                </button>
                <button className="btn btn-secondary" onClick={() => router.push('/tasks')} style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <IconCheckCircle size={18} /> My Tasks
                </button>
            </motion.div>

            {/* Stats Grid */}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                
                {/* My Tasks */}
                <motion.div variants={item} className="card">
                    <div className="card-header" style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IconCheckCircle size={18} color="var(--color-primary)" /> Actionable Tasks</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/tasks')}>View all</button>
                    </div>
                    {loadingTasks ? (
                        <div style={{ padding: '24px 0', textAlign: 'center' }}><span className="spinner" style={{ width: 24, height: 24, margin: '0 auto', display: 'block' }}/></div>
                    ) : tasks.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>No pending tasks right now! 🎉</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tasks.map(t => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const myAssignment = t.task_assignments?.find((a: any) => a.employee_id === employeeId)
                                const isPending = myAssignment?.status === 'pending'
                                
                                return (
                                    <div key={t.id} style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{t.title}</div>
                                            <span className={`badge ${t.priority === 'high' ? 'badge-danger' : t.priority === 'urgent' ? 'badge-danger' : t.priority === 'medium' ? 'badge-warning' : 'badge-success'}`}>{t.priority}</span>
                                        </div>
                                        {t.description && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</div>}
                                        
                                        {isPending ? (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleTaskAction(t.id, 'accepted')}>Accept (+5 Pts)</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleTaskAction(t.id, 'rejected')}>Decline</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Assigned to you</span>
                                                <button className="btn btn-success btn-sm" onClick={() => handleTaskAction(t.id, 'completed')}>Mark Complete</button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Point History */}
                <motion.div variants={item} className="card">
                    <div className="card-header" style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IconBanknote size={18} color="#F59E0B" /> Recent Points</h3>
                        <span className="badge badge-warning">{myStats?.totalPoints || 0} Total</span>
                    </div>
                    {points.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>No points earned yet. Start accepting tasks!</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                            {points.map((p, i) => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < points.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.points > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.points > 0 ? '#10B981' : '#DC2626', fontWeight: 700, fontSize: '0.875rem' }}>
                                        {p.points > 0 ? '+' : ''}{p.points}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.description || p.source}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{timeAgo(p.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

            </div>
        </motion.div>
    )
}
