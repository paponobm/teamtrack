'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import LeaveApplicationModal from './LeaveApplicationModal'
import { usePermissions } from '@/lib/PermissionsContext'
import AdminLeaves from './AdminLeaves'
import Link from 'next/link'

interface LeaveRecord {
    id: string
    leave_date: string
    reason: string
    status: string
    rejection_reason?: string
    created_at: string
}

const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

export default function MyLeaves() {
    const { data: perms } = usePermissions()
    const isAdmin = perms?.is_super || perms?.is_admin

    const [activeSubTab, setActiveSubTab] = useState<'my_leaves' | 'team_leaves'>('my_leaves')
    const [leaves, setLeaves] = useState<LeaveRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const fetchLeaves = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/leaves/apply')
            if (res.ok) {
                const data = await res.json()
                setLeaves(data.records || [])
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        if (isAdmin) {
            setActiveSubTab('team_leaves')
        }
    }, [isAdmin])

    useEffect(() => { 
        fetchLeaves()
        
        // Mark as read when member visits this tab
        if (!isAdmin) {
            fetch('/api/leaves/mark-read', { method: 'POST' }).then(() => {
                window.dispatchEvent(new CustomEvent('leaves-updated'))
            }).catch(() => {})
        }
    }, [fetchLeaves, isAdmin])

    const handleCancel = async (idGroup: string, ids: string[]) => {
        if (!confirm('Are you sure you want to cancel this leave application?')) return
        
        setActionLoading(idGroup)
        try {
            const res = await fetch(`/api/leaves/apply?ids=${ids.join(',')}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                setLeaves(prev => prev.filter(l => !ids.includes(l.id)))
            }
        } catch { /* ignore */ }
        finally {
            setActionLoading(null)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <span className="badge badge-success">Approved</span>
            case 'rejected': return <span className="badge badge-danger">Rejected</span>
            default: return <span className="badge badge-warning">Pending</span>
        }
    }

    const subTabs = [
        { key: 'team_leaves', label: 'Team Leaves' },
        { key: 'my_leaves', label: 'My Leaves' }
    ]

    return (
        <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {isAdmin && (
                <div className="tabs" style={{ display: 'inline-flex', background: 'var(--color-bg-primary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-border-light)', alignSelf: 'flex-start' }}>
                    {subTabs.map(tab => (
                        <button 
                            key={tab.key}
                            className={`tab-btn ${activeSubTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveSubTab(tab.key as any)}
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeSubTab === tab.key ? '#fff' : 'var(--color-text-secondary)', background: activeSubTab === tab.key ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {isAdmin && activeSubTab === 'team_leaves' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Manage Team Leaves</h2>
                        <Link href="/attendance" className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
                            Go to Team Attendance
                        </Link>
                    </div>
                    <AdminLeaves />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>My Leave Applications</h2>
                        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                            Apply for Leave
                        </button>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Applied On</th>
                                        <th>Leave Date</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>Loading leaves...</td>
                                        </tr>
                                    ) : leaves.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-tertiary)' }}>No leave applications found</td>
                                        </tr>
                                    ) : (
                                        Object.values(leaves.reduce((acc, curr) => {
                                            const key = `${curr.created_at}-${curr.reason}`
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
                                                    <td style={{ color: 'var(--color-text-secondary)' }}>
                                                        {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td style={{ fontWeight: 500 }}>
                                                        {dateStr}
                                                    </td>
                                                    <td style={{ maxWidth: '300px' }}>
                                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {l.reason}
                                                        </div>
                                                        {l.status === 'rejected' && l.rejection_reason && (
                                                            <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '4px', whiteSpace: 'normal', fontStyle: 'italic' }}>
                                                                Reason: {l.rejection_reason}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{getStatusBadge(l.status)}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {l.status === 'pending' && (
                                                            <button 
                                                                className="btn btn-ghost" 
                                                                style={{ padding: '6px 12px', fontSize: '0.8125rem', color: '#DC2626' }}
                                                                onClick={() => handleCancel(l.id, l.ids)}
                                                                disabled={actionLoading === l.id}
                                                            >
                                                                {actionLoading === l.id ? '...' : 'Cancel'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <LeaveApplicationModal 
                        isOpen={isModalOpen} 
                        onClose={() => setIsModalOpen(false)} 
                        onSuccess={fetchLeaves} 
                    />
                </div>
            )}
        </motion.div>
    )
}
