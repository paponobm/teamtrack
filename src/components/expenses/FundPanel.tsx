'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'

interface FundHolder {
    employee_id: string
    name: string
    avatar_url: string | null
    role: string
    allocated: number
    used: number
    remaining: number
}
interface Allocation {
    id: string
    employee_id: string
    employee_name: string
    amount: number
    note: string | null
    allocated_by: string | null
    created_at: string
}
interface FundData {
    isSuperAdmin: boolean
    summary: FundHolder[]
    adminTargets: { id: string; name: string }[]
    myFund: { allocated: number; used: number; remaining: number }
    allocations: Allocation[]
    totals: { allocated: number; used: number; remaining: number }
}

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

const taka = (n: number) => `৳${Number(n || 0).toLocaleString()}`

// Health color by how much of the fund is left.
function healthColor(remaining: number, allocated: number) {
    if (allocated <= 0) return '#6B7280'
    const ratio = remaining / allocated
    if (remaining <= 0) return '#DC2626'
    if (ratio < 0.25) return '#F59E0B'
    return '#10B981'
}

interface FundPanelProps {
    activeEmployeeId?: string | null
    onSelectEmployee?: (employeeId: string | null) => void
}

export default function FundPanel({ activeEmployeeId, onSelectEmployee }: FundPanelProps) {
    const toast = useToast()
    const [data, setData] = useState<FundData | null>(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(true)
    const [showAllocate, setShowAllocate] = useState(false)
    const [showLedger, setShowLedger] = useState(false)
    const [allocForm, setAllocForm] = useState({ employee_id: '', amount: '', note: '' })
    const [saving, setSaving] = useState(false)

    const fetchFunds = useCallback(async () => {
        try {
            const res = await fetch('/api/funds')
            if (res.ok) setData(await res.json())
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchFunds() }, [fetchFunds])

    const handleAllocate = async () => {
        if (!allocForm.employee_id || !allocForm.amount || Number(allocForm.amount) <= 0) return
        setSaving(true)
        try {
            const res = await fetch('/api/funds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: allocForm.employee_id, amount: Number(allocForm.amount), note: allocForm.note || null }),
            })
            if (res.ok) {
                toast.success('Fund allocated successfully')
                setShowAllocate(false); setAllocForm({ employee_id: '', amount: '', note: '' })
                await fetchFunds()
            } else {
                const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to allocate fund')
            }
        } catch { toast.error('Failed to allocate fund') }
        finally { setSaving(false) }
    }

    const handleDeleteAllocation = async (id: string) => {
        if (!confirm('Remove this allocation? It will reduce that member\'s allocated fund.')) return
        const res = await fetch(`/api/funds?id=${id}`, { method: 'DELETE' })
        if (res.ok) { toast.success('Allocation removed'); await fetchFunds() }
        else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to remove allocation') }
    }

    if (loading || !data) return null
    const isSuper = data.isSuperAdmin
    const holders = data.summary

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ marginBottom: '24px', padding: '18px 20px', border: '1px solid var(--color-border-light)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.25rem' }}>💰</span>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>Team Funds</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                            {isSuper
                                ? `${taka(data.totals.remaining)} remaining of ${taka(data.totals.allocated)} allocated`
                                : `Your fund: ${taka(data.myFund.remaining)} remaining of ${taka(data.myFund.allocated)}`}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isSuper && (
                        <button className="btn btn-sm" style={{ background: '#7C3AED', color: '#fff', border: 'none' }} onClick={() => setShowAllocate(true)}>
                            <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style={{ marginRight: 4 }}><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            Allocate Fund
                        </button>
                    )}
                    <button className="btn btn-ghost btn-icon" onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        {holders.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-tertiary)', fontSize: '0.8125rem', marginTop: '12px' }}>
                                No funds allocated yet.{isSuper ? ' Use “Allocate Fund” to give an admin a fund.' : ''}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginTop: '16px' }}>
                                {holders.map((h, i) => {
                                    const color = healthColor(h.remaining, h.allocated)
                                    const usedPct = h.allocated > 0 ? Math.min(100, (h.used / h.allocated) * 100) : 0
                                    const isActive = !!onSelectEmployee && activeEmployeeId === h.employee_id
                                    return (
                                        <motion.div key={h.employee_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                            onClick={onSelectEmployee ? () => onSelectEmployee(isActive ? null : h.employee_id) : undefined}
                                            title={onSelectEmployee ? (isActive ? 'Click to clear filter' : `Click to view only ${h.name}'s expenses`) : undefined}
                                            style={{
                                                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                                                borderRadius: '12px', padding: '14px',
                                                background: isActive ? 'rgba(37,99,235,0.06)' : 'var(--color-surface)',
                                                cursor: onSelectEmployee ? 'pointer' : 'default',
                                                boxShadow: isActive ? '0 0 0 1px var(--color-primary)' : 'none',
                                                transition: 'border-color 0.15s, background 0.15s',
                                            }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                <div className="avatar avatar-sm" style={{ background: getAvatarColor(h.name), overflow: 'hidden', flexShrink: 0 }}>
                                                    {h.avatar_url
                                                        ? <img src={h.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : (h.name[0]?.toUpperCase() || '?')}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</div>
                                                    <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>{h.role}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                <span style={{ fontSize: '1.375rem', fontWeight: 800, color }}>{taka(h.remaining)}</span>
                                                <span style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>left</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 3, background: 'var(--color-bg-secondary)', margin: '8px 0 6px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${usedPct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>
                                                <span>Used {taka(h.used)}</span>
                                                <span>of {taka(h.allocated)}</span>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Allocation ledger (super admin) */}
                        {isSuper && data.allocations.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowLedger(s => !s)} style={{ fontSize: '0.75rem' }}>
                                    {showLedger ? 'Hide' : 'Show'} allocation history ({data.allocations.length})
                                </button>
                                {showLedger && (
                                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflow: 'auto' }}>
                                        {data.allocations.map(a => (
                                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-surface)', borderRadius: '8px', fontSize: '0.75rem' }}>
                                                <span style={{ fontWeight: 700, color: '#7C3AED', minWidth: '72px' }}>{taka(a.amount)}</span>
                                                <span style={{ fontWeight: 600 }}>{a.employee_name}</span>
                                                {a.note && <span style={{ color: 'var(--color-text-tertiary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.note}</span>}
                                                <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                <button onClick={() => handleDeleteAllocation(a.id)} title="Remove allocation" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', padding: 2, flexShrink: 0 }}>
                                                    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Allocate modal */}
            <AnimatePresence>
                {showAllocate && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAllocate(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                        <motion.div className="card" initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '100%', padding: '20px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>Allocate Fund</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group">
                                    <label className="form-label">Recipient (Admin) *</label>
                                    <select className="form-input" value={allocForm.employee_id} onChange={e => setAllocForm({ ...allocForm, employee_id: e.target.value })}>
                                        <option value="">Select admin...</option>
                                        {data.adminTargets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Amount (৳) *</label>
                                    <input className="form-input" type="number" min="1" value={allocForm.amount} onChange={e => setAllocForm({ ...allocForm, amount: e.target.value })} placeholder="e.g. 10000" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Note</label>
                                    <input className="form-input" value={allocForm.note} onChange={e => setAllocForm({ ...allocForm, note: e.target.value })} placeholder="Optional note..." />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowAllocate(false)}>Cancel</button>
                                <button className="btn btn-sm" style={{ background: '#7C3AED', color: '#fff', border: 'none' }} onClick={handleAllocate} disabled={saving || !allocForm.employee_id || !allocForm.amount}>
                                    {saving ? 'Allocating...' : 'Allocate'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
