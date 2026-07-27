'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { IconCheckCircle } from '@/components/icons/Icons'
import LeaveCalendar from '@/components/attendance/LeaveCalendar'

interface PendingLeave {
    id: string
    employee_id: string
    leave_date: string
    reason: string
    status: string
    created_at: string
    employee: {
        id: string
        name: string
        avatar_url: string | null
        designation: string
    }
}

const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

function ExpandableReason({ reason }: { reason: string }) {
    const [expanded, setExpanded] = useState(false)
    const isLong = reason && reason.length > 60
    if (!reason) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
    return (
        <div>
            <span style={{ wordBreak: 'break-word' }}>
                {expanded || !isLong ? reason : reason.slice(0, 60) + '...'}
            </span>
            {isLong && (
                <button onClick={() => setExpanded(v => !v)}
                    style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                    {expanded ? 'Show less' : 'Show more'}
                </button>
            )}
        </div>
    )
}

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[name.charCodeAt(0) % colors.length]
}

export default function AdminLeaves() {
    const [leaves, setLeaves] = useState<PendingLeave[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'calendar'>('pending')

    const fetchLeaves = useCallback(async () => {
        if (activeTab === 'calendar') {
            // calendar needs history data
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/leaves/admin?tab=history`, { cache: 'no-store' })
                const data = await res.json()
                if (res.ok) setLeaves(data.records || [])
                else setError(data.error || 'Failed to fetch')
            } catch (e: any) { setError(e.message) }
            finally { setLoading(false) }
            return
        }
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/leaves/admin?tab=${activeTab}`, { cache: 'no-store' })
            const data = await res.json()
            if (res.ok) {
                setLeaves(data.records || [])
            } else {
                setError(data.error || 'Failed to fetch')
            }
        } catch (e: any) { 
            setError(e.message)
        }
        finally { setLoading(false) }
    }, [activeTab])

    useEffect(() => { fetchLeaves() }, [fetchLeaves])

    const [rejectModalData, setRejectModalData] = useState<{ id: string, groupIds: string[] } | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    const handleAction = async (id: string, action: 'approve' | 'reject', groupIds: string[], reason?: string) => {
        setActionLoading(id)
        try {
            const res = await fetch('/api/leaves/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ record_ids: groupIds, action, rejection_reason: reason })
            })
            if (res.ok) {
                // Remove all IDs in this group from pending list
                setLeaves(prev => prev.filter(l => !groupIds.includes(l.id)))
                // Trigger sidebar to re-fetch if possible, or just dispatch an event
                window.dispatchEvent(new CustomEvent('leaves-updated'))
            }
        } catch { /* ignore */ }
        finally {
            setActionLoading(null)
            setRejectModalData(null)
            setRejectReason('')
        }
    }

    return (
        <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Tabs */}
            <div className="tabs" style={{ display: 'inline-flex', background: 'var(--color-bg-primary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-border-light)', alignSelf: 'flex-start' }}>
                {([{ key: 'pending', label: 'Pending Leaves' }, { key: 'history', label: 'Leave History' }, { key: 'calendar', label: 'Calendar' }] as const).map(tab => (
                    <button key={tab.key}
                        className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeTab === tab.key ? '#fff' : 'var(--color-text-secondary)', background: activeTab === tab.key ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'calendar' ? (
                loading ? (
                    <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading calendar...</div>
                ) : (
                    <LeaveCalendar records={leaves} />
                )
            ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Leave Date</th>
                                <th>Reason</th>
                                <th>{activeTab === 'history' ? 'Status' : 'Applied On'}</th>
                                {activeTab === 'pending' && <th style={{ textAlign: 'right' }}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {error ? (
                                <tr>
                                    <td colSpan={activeTab === 'pending' ? 5 : 4} style={{ textAlign: 'center', padding: '32px', color: 'red' }}>Error: {error}</td>
                                </tr>
                            ) : loading ? (
                                <tr>
                                    <td colSpan={activeTab === 'pending' ? 5 : 4} style={{ textAlign: 'center', padding: '32px' }}>Loading {activeTab === 'pending' ? 'pending requests' : 'leave history'}...</td>
                                </tr>
                            ) : leaves.length === 0 ? (
                                <tr>
                                    <td colSpan={activeTab === 'pending' ? 5 : 4} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-tertiary)' }}>
                                        {activeTab === 'pending' ? (
                                            <>
                                                <IconCheckCircle size={32} color="#10B981" />
                                                <div style={{ marginTop: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>All caught up!</div>
                                                <div style={{ fontSize: '0.875rem' }}>No pending leave requests.</div>
                                            </>
                                        ) : (
                                            <div>No leave history found.</div>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                Object.values(leaves.reduce((acc, curr) => {
                                    const key = `${curr.employee_id}-${curr.created_at}-${curr.reason}`
                                    if (!acc[key]) {
                                        acc[key] = { ...curr, dates: [curr.leave_date], ids: [curr.id] }
                                    } else {
                                        acc[key].dates.push(curr.leave_date)
                                        acc[key].ids.push(curr.id)
                                    }
                                    return acc
                                }, {} as Record<string, any>))
                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                .map((l: any) => {
                                    l.dates.sort()
                                    const dateStr = l.dates.length === 1 
                                        ? new Date(l.dates[0]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                                        : `${new Date(l.dates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(l.dates[l.dates.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${l.dates.length} days)`

                                    return (
                                        <tr key={l.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="avatar avatar-sm" style={{ background: getAvatarColor(l.employee.name), overflow: 'hidden' }}>
                                                        {l.employee.avatar_url ? (
                                                            <img src={l.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : l.employee.name[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{l.employee.name}</div>
                                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{l.employee.designation}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                {dateStr}
                                            </td>
                                            <td style={{ maxWidth: '250px' }}>
                                                <ExpandableReason reason={l.reason} />
                                                {activeTab === 'history' && l.status === 'rejected' && l.rejection_reason && (
                                                    <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '4px', fontStyle: 'italic', whiteSpace: 'normal' }}>
                                                        Reason: {l.rejection_reason}
                                                    </div>
                                                )}
                                            </td>
                                            {activeTab === 'pending' ? (
                                                <td style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                                                    {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </td>
                                            ) : (
                                                <td>
                                                    {l.status === 'approved' ? (
                                                        <span className="badge badge-success">Approved</span>
                                                    ) : (
                                                        <span className="badge badge-danger">Rejected</span>
                                                    )}
                                                </td>
                                            )}
                                            {activeTab === 'pending' && (
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                                                        <button 
                                                            className="btn" 
                                                            style={{ padding: '6px 12px', fontSize: '0.8125rem', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                                                            onClick={() => handleAction(l.id, 'approve', l.ids)}
                                                            disabled={actionLoading === l.id}
                                                        >
                                                            {actionLoading === l.id ? '...' : 'Approve'}
                                                        </button>
                                                        <button 
                                                            className="btn" 
                                                            style={{ padding: '6px 12px', fontSize: '0.8125rem', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                                                            onClick={() => setRejectModalData({ id: l.id, groupIds: l.ids })}
                                                            disabled={actionLoading === l.id}
                                                        >
                                                            {actionLoading === l.id ? '...' : 'Reject'}
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* Reject Leave Modal */}
            {rejectModalData && (
                <div className="modal-overlay" onClick={() => setRejectModalData(null)} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <motion.div 
                        className="modal"
                        onClick={e => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        style={{ maxWidth: '400px', width: '100%', background: 'var(--color-bg-primary)', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
                    >
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ color: '#DC2626' }}>Reject Leave Request</h3>
                            <button className="modal-close" onClick={() => setRejectModalData(null)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                                Please provide a reason for rejecting this leave request. This will be visible to the employee.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Rejection Reason</label>
                                <textarea 
                                    className="input" 
                                    placeholder="e.g., Too many leaves taken this month..."
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    style={{ minHeight: '100px', resize: 'vertical' }}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="btn" style={{ background: 'var(--color-background-secondary)' }} onClick={() => setRejectModalData(null)}>
                                Cancel
                            </button>
                            <button 
                                className="btn btn-primary" 
                                style={{ background: '#DC2626' }}
                                disabled={!rejectReason.trim()}
                                onClick={() => handleAction(rejectModalData.id, 'reject', rejectModalData.groupIds, rejectReason)}
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    )
}
