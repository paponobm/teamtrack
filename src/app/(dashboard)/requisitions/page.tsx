'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import RequireFeature from '@/components/common/RequireFeature'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'

interface Requisition {
    id: string
    requisition_no: number
    date: string
    item_description: string | null
    quantity: number
    reason: string | null
    priority: string
    manager_approval: 'pending' | 'approved' | 'rejected'
    management_approval: 'pending' | 'approved' | 'rejected'
    purchase_status: 'pending' | 'purchased' | 'cancelled'
    purchase_date: string | null
    remarks: string | null
    requester: { id: string; name: string } | null
    created_at: string
}

// Local (not UTC) YYYY-MM-DD so date-range filters don't shift a day in UTC+ timezones.
const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

const approvalBadge: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    approved: { label: 'Approved', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
    rejected: { label: 'Rejected', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: '#DC2626' },
    high: { label: 'High', color: '#F59E0B' },
    medium: { label: 'Medium', color: '#3B82F6' },
    low: { label: 'Low', color: '#6B7280' },
}

const emptyForm = {
    item_description: '',
    quantity: '1',
    reason: '',
    priority: 'medium',
    remarks: '',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getName = (obj: any) => { if (!obj) return null; return Array.isArray(obj) ? obj[0]?.name : obj.name }

export default function RequisitionsPage() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const [reqs, setReqs] = useState<Requisition[]>([])
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

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
                params.set('start_date', refDate); params.set('end_date', refDate)
            } else if (dateRangeMode === 'week') {
                const r = getWeekRange(new Date(refDate)); params.set('start_date', r.start); params.set('end_date', r.end)
            } else if (dateRangeMode === 'month') {
                const r = getMonthRange(new Date(refDate)); params.set('start_date', r.start); params.set('end_date', r.end)
            } else if (dateRangeMode === 'custom' && customStart && customEnd) {
                params.set('start_date', customStart); params.set('end_date', customEnd)
            }
            const res = await fetch(`/api/requisitions?${params}`)
            if (res.ok) { const d = await res.json(); setReqs(d.requisitions || []); setStats(d.stats || { total: 0, pending: 0, approved: 0, rejected: 0 }) }
        } catch { console.error('Failed') }
        finally { setLoading(false) }
    }, [dateRangeMode, refDate, customStart, customEnd])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin') setIsAdmin(true)
    }, [perms])

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true) }

    const openEdit = (r: Requisition) => {
        setEditingId(r.id)
        setForm({
            item_description: r.item_description || '',
            quantity: String(r.quantity ?? 1),
            reason: r.reason || '',
            priority: r.priority || 'medium',
            remarks: r.remarks || '',
        })
        setShowModal(true)
    }

    const closeModal = () => { setShowModal(false); setEditingId(null); setForm(emptyForm) }

    const handleSave = async () => {
        if (!form.item_description.trim()) return
        setSaving(true)
        try {
            const isEdit = !!editingId
            const res = await fetch('/api/requisitions', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isEdit
                    ? { id: editingId, item_description: form.item_description, quantity: Number(form.quantity), reason: form.reason, priority: form.priority, remarks: form.remarks }
                    : { ...form, quantity: Number(form.quantity) }),
            })
            if (res.ok) { toast.success(isEdit ? 'Requisition updated' : 'Requisition submitted'); await fetchData(); closeModal() }
            else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to save requisition') }
        } catch { console.error('Save failed') }
        finally { setSaving(false) }
    }

    const handleApproval = async (id: string, field: string, value: string) => {
        const res = await fetch('/api/requisitions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, [field]: value }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to update requisition'); return }
        await fetchData()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this requisition?')) return
        const res = await fetch(`/api/requisitions?id=${id}`, { method: 'DELETE' })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to delete requisition'); return }
        toast.success('Requisition deleted')
        await fetchData()
    }

    const filtered = reqs.filter(r => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (!(r.item_description || '').toLowerCase().includes(q) && !(r.reason || '').toLowerCase().includes(q)) return false
        }
        return true
    })

    const statCards = [
        { label: 'Total Requests', value: stats.total, color: '#1E3A5F' },
        { label: 'Pending', value: stats.pending, color: '#F59E0B' },
        { label: 'Approved', value: stats.approved, color: '#10B981' },
        { label: 'Rejected', value: stats.rejected, color: '#DC2626' },
    ]

    return (
        <RequireFeature slugs={['requisitions']}>
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Requisitions</h1>
                    <p className="page-subtitle">Submit and manage purchase requests and supply orders.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={openCreate}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    New Request
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
                                <motion.div layoutId="reqDateTab" style={{
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
                        <button className="btn btn-ghost btn-icon" onClick={() => { const d = new Date(refDate + 'T00:00:00'); if (dateRangeMode === 'month') d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - (dateRangeMode === 'week' ? 7 : 1)); setRefDate(fmtLocalDate(d)) }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                        <button className="btn btn-ghost btn-icon" onClick={() => { const d = new Date(refDate + 'T00:00:00'); if (dateRangeMode === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + (dateRangeMode === 'week' ? 7 : 1)); setRefDate(fmtLocalDate(d)) }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                )}
                {dateRangeMode === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input" style={{ padding: '6px 8px', fontSize: '0.8125rem', width: '150px', border: '1px solid var(--color-border-light)', borderRadius: '8px' }} />
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>to</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input" style={{ padding: '6px 8px', fontSize: '0.8125rem', width: '150px', border: '1px solid var(--color-border-light)', borderRadius: '8px' }} />
                    </div>
                )}
            </motion.div>

            {/* Stats */}
            <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {statCards.map(s => (
                    <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>{s.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    </div>
                ))}
            </motion.div>

            {/* Search */}
            <motion.div variants={item} style={{ marginBottom: '20px', maxWidth: '300px' }}>
                <div style={{ position: 'relative' }}>
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <input className="form-input" type="text" placeholder="Search requisitions..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '34px', height: '36px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px' }}
                    />
                </div>
            </motion.div>

            {/* List */}
            {loading ? (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: 4, height: 48, borderRadius: 2, background: 'var(--color-bg-tertiary)' }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div className="skeleton" style={{ width: '50%', height: 14 }} />
                                <div className="skeleton" style={{ width: '70%', height: 10 }} />
                            </div>
                            <div className="skeleton" style={{ width: 60, height: 24, borderRadius: '12px' }} />
                        </div>
                    ))}
                </motion.div>
            ) : filtered.length === 0 ? (
                <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>No requisitions yet</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Click &quot;New Request&quot; to submit one.</p>
                </motion.div>
            ) : (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.map(r => {
                        const pc = priorityConfig[r.priority] || priorityConfig.medium
                        const ma = approvalBadge[r.manager_approval]
                        const mga = approvalBadge[r.management_approval]
                        const isOwner = !!perms.employee_id && getName(r.requester) != null && (Array.isArray(r.requester) ? (r.requester as unknown as { id: string }[])[0]?.id : r.requester?.id) === perms.employee_id
                        const stillPending = r.manager_approval === 'pending' && r.management_approval === 'pending'
                        const canEdit = isAdmin || (isOwner && stillPending)
                        return (
                            <motion.div key={r.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}
                                whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} transition={{ duration: 0.2 }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: pc.color }} />
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>REQ-{String(r.requisition_no).padStart(4, '0')}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 500, color: pc.color, background: `${pc.color}15` }}>{pc.label}</span>
                                        </div>
                                        <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px' }}>{r.item_description || 'No description'}
                                            <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)', marginLeft: '8px', fontSize: '0.8125rem' }}>×{r.quantity}</span>
                                        </div>
                                        {r.reason && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '4px 0 8px', lineHeight: 1.5 }}>{r.reason}</p>}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', flexWrap: 'wrap' }}>
                                            <span>{new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            {getName(r.requester) && <span>By: {getName(r.requester)}</span>}
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Manager: <span style={{ padding: '1px 6px', borderRadius: '4px', fontWeight: 600, color: ma.color, background: ma.bg }}>{ma.label}</span>
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Management: <span style={{ padding: '1px 6px', borderRadius: '4px', fontWeight: 600, color: mga.color, background: mga.bg }}>{mga.label}</span>
                                            </span>
                                            {r.management_approval === 'approved' && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    Purchase: <span style={{ padding: '1px 6px', borderRadius: '4px', fontWeight: 600, color: r.purchase_status === 'purchased' ? '#10B981' : r.purchase_status === 'cancelled' ? '#DC2626' : '#F59E0B', background: r.purchase_status === 'purchased' ? 'rgba(16,185,129,0.08)' : r.purchase_status === 'cancelled' ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)' }}>
                                                        {r.purchase_status === 'purchased' ? 'Purchased' : r.purchase_status === 'cancelled' ? 'Cancelled' : 'Pending'}
                                                    </span>
                                                    {r.purchase_date && <span style={{ fontSize: '0.6875rem' }}>({new Date(r.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {(isAdmin || canEdit) && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                                            {canEdit && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)} style={{ padding: '4px 8px', fontSize: '0.6875rem', color: 'var(--color-text-secondary)', alignSelf: 'flex-end' }} title="Edit requisition">
                                                    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style={{ marginRight: '3px' }}><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                    Edit
                                                </button>
                                            )}
                                            {isAdmin && r.manager_approval === 'pending' && (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleApproval(r.id, 'manager_approval', 'approved')} style={{ padding: '4px 8px', fontSize: '0.6875rem', color: '#10B981' }}>✓ Manager</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleApproval(r.id, 'manager_approval', 'rejected')} style={{ padding: '4px 8px', fontSize: '0.6875rem', color: '#DC2626' }}>✗</button>
                                                </div>
                                            )}
                                            {isAdmin && r.manager_approval === 'approved' && r.management_approval === 'pending' && (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleApproval(r.id, 'management_approval', 'approved')} style={{ padding: '4px 8px', fontSize: '0.6875rem', color: '#10B981' }}>✓ Mgmt</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleApproval(r.id, 'management_approval', 'rejected')} style={{ padding: '4px 8px', fontSize: '0.6875rem', color: '#DC2626' }}>✗</button>
                                                </div>
                                            )}
                                            {isAdmin && r.management_approval === 'approved' && r.purchase_status !== 'purchased' && (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleApproval(r.id, 'purchase_status', 'purchased')} style={{ padding: '4px 8px', fontSize: '0.6875rem', color: '#10B981' }}>✓ Purchased</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleApproval(r.id, 'purchase_status', 'cancelled')} style={{ padding: '4px 8px', fontSize: '0.6875rem', color: '#DC2626' }}>✗ Cancel</button>
                                                </div>
                                            )}
                                            {isAdmin && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r.id)} style={{ padding: '4px', color: '#DC2626', alignSelf: 'flex-end' }}>
                                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{editingId ? 'Edit Requisition' : 'New Requisition'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={closeModal}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group">
                                    <label className="form-label">Item Description *</label>
                                    <input className="form-input" value={form.item_description} onChange={e => setForm({ ...form, item_description: e.target.value })} placeholder="What do you need?" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Quantity</label>
                                        <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reason</label>
                                    <textarea className="form-input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Why is this needed?" rows={2} style={{ resize: 'vertical' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Remarks</label>
                                    <input className="form-input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Any notes..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={closeModal}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.item_description.trim()}>
                                    {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Submit Request')}
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
