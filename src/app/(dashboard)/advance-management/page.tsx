'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { getLocalDateString, getWeekRange, getMonthRange } from '@/lib/dateRange'
import {
    IconWallet, IconBanknote, IconCheckCircle, IconClock, IconPlus, IconX,
    IconSearch, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconCalendar, IconShieldAlert,
} from '@/components/icons/Icons'

interface Advance {
    id: string
    employee_id: string
    amount: number
    advance_date: string
    note: string | null
    payment_status: 'Paid' | 'Unpaid'
    created_at: string
    employee: { id: string; name: string; employee_id: string | null; avatar_url: string | null } | null
    created_by_employee: { id: string; name: string } | null
}

interface EmployeeOption {
    id: string
    name: string
    employee_id: string | null
    avatar_url: string | null
}

type DateRangeMode = 'all' | 'today' | 'week' | 'month' | 'custom'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || 'U').charCodeAt(0) % colors.length]
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdvanceManagementPage() {
    const { data, isLoading: permsLoading } = usePermissions()
    const { success: toastSuccess, error: toastError } = useToast()

    const [advances, setAdvances] = useState<Advance[]>([])
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Unpaid'>('all')
    const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('all')
    const [refDate, setRefDate] = useState(() => getLocalDateString())
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Advance | null>(null)

    const isAdmin = data.is_admin || data.is_super

    const fetchAdvances = useCallback(async () => {
        setLoading(true)
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
            const res = await fetch(`/api/advances?${params}`)
            if (res.ok) {
                const json = await res.json()
                setAdvances(json.advances || [])
            }
        } finally {
            setLoading(false)
        }
    }, [dateRangeMode, refDate, customStart, customEnd])

    useEffect(() => { fetchAdvances() }, [fetchAdvances])

    useEffect(() => {
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) })
    }, [])

    const filtered = advances.filter(a => {
        if (statusFilter !== 'all' && a.payment_status !== statusFilter) return false
        if (!search) return true
        const q = search.toLowerCase()
        return (a.employee?.name || '').toLowerCase().includes(q) || (a.employee?.employee_id || '').toLowerCase().includes(q)
    })

    // Computed from the same filtered set the table shows, so Total Paid + Total Unpaid
    // always equals Total Amount for whatever combination of date + employee filters is active.
    const summary = filtered.reduce((acc, a) => {
        acc.count++
        acc.totalAmount += a.amount
        if (a.payment_status === 'Paid') acc.totalPaid += a.amount
        else acc.totalUnpaid += a.amount
        return acc
    }, { count: 0, totalAmount: 0, totalPaid: 0, totalUnpaid: 0 })

    const handleDelete = async (adv: Advance) => {
        if (!confirm(`Delete this advance record for ${adv.employee?.name || 'this employee'}?`)) return
        const res = await fetch(`/api/advances/${adv.id}`, { method: 'DELETE' })
        if (res.ok) {
            setAdvances(prev => prev.filter(a => a.id !== adv.id))
            toastSuccess('Advance record deleted')
        } else {
            const err = await res.json()
            toastError(err.error || 'Failed to delete')
        }
    }

    if (permsLoading) return null

    if (!isAdmin) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--color-text-tertiary)' }}>
                <IconShieldAlert size={32} />
                <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Access restricted to Admins</div>
            </div>
        )
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Advance Management</h1>
                    <p className="page-subtitle">Manage employee advances and payment records</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowModal(true) }}>
                    <IconPlus size={16} /> Add Advance
                </button>
            </motion.div>

            <motion.div variants={item} className="grid grid-4" style={{ gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconWallet size={14} color="var(--color-text-tertiary)" /> Total Advance</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{summary.count}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconBanknote size={14} color="var(--color-text-tertiary)" /> Total Amount</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>৳{summary.totalAmount.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="var(--color-text-tertiary)" /> Total Paid</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>৳{summary.totalPaid.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="var(--color-text-tertiary)" /> Total Unpaid</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>৳{summary.totalUnpaid.toLocaleString()}</span>
                </div>
            </motion.div>

            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '240px' }}>
                    <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                    <input className="form-input" type="text" placeholder="Search by employee ID or name..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: '34px', height: '34px', fontSize: '0.8125rem', width: '100%' }} />
                </div>
                <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'Paid' | 'Unpaid')}
                    style={{ height: '34px', fontSize: '0.8125rem', width: 'auto' }}>
                    <option value="all">All Status</option>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                </select>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {([{ key: 'all', label: 'All' }, { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }] as const).map(opt => (
                        <button key={opt.key} onClick={() => setDateRangeMode(opt.key)}
                            style={{ position: 'relative', padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '0.8125rem', fontWeight: 500, background: 'transparent', color: dateRangeMode === opt.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', zIndex: 1 }}>
                            {dateRangeMode === opt.key && (
                                <motion.div layoutId="advanceDateTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
                        </button>
                    ))}
                </div>
                {(dateRangeMode === 'today' || dateRangeMode === 'week' || dateRangeMode === 'month') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => {
                            const d = new Date(refDate); d.setDate(d.getDate() - (dateRangeMode === 'week' ? 7 : dateRangeMode === 'month' ? 30 : 1)); setRefDate(getLocalDateString(d))
                        }} style={{ borderRadius: '8px' }}>
                            <IconChevronLeft size={16} />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 4px', fontSize: '0.8125rem' }}>
                            <IconCalendar size={14} color="var(--color-text-tertiary)" />
                            <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '0', fontSize: '0.8125rem', width: '130px' }} />
                        </div>
                        <button className="btn btn-ghost btn-icon" onClick={() => {
                            const d = new Date(refDate); d.setDate(d.getDate() + (dateRangeMode === 'week' ? 7 : dateRangeMode === 'month' ? 30 : 1)); setRefDate(getLocalDateString(d))
                        }} style={{ borderRadius: '8px' }}>
                            <IconChevronRight size={16} />
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

            <motion.div variants={item} className="card" style={{ overflowX: 'auto', padding: 0 }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>SL</th>
                            <th>Employee</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Note</th>
                            <th>Payment Status</th>
                            <th>Created By</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && filtered.map((a, i) => (
                            <tr key={a.id}>
                                <td>{i + 1}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="avatar avatar-sm" style={{ background: getAvatarColor(a.employee?.name || 'U'), overflow: 'hidden', flexShrink: 0, width: 28, height: 28, fontSize: '0.75rem' }}>
                                            {a.employee?.avatar_url ? (
                                                <img src={a.employee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (a.employee?.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{a.employee?.name || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{a.employee?.employee_id || '—'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ fontWeight: 700 }}>৳{a.amount.toLocaleString()}</td>
                                <td>{formatDate(a.advance_date)}</td>
                                <td style={{ maxWidth: '220px', whiteSpace: 'normal', color: 'var(--color-text-secondary)' }}>{a.note || '—'}</td>
                                <td>
                                    <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: a.payment_status === 'Paid' ? '#16A34A' : '#DC2626', background: a.payment_status === 'Paid' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)' }}>
                                        {a.payment_status}
                                    </span>
                                </td>
                                <td style={{ color: 'var(--color-text-tertiary)' }}>{a.created_by_employee?.name || '—'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => { setEditing(a); setShowModal(true) }} title="Edit"><IconEdit size={15} /></button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(a)} title="Delete" style={{ color: '#DC2626' }}><IconTrash size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>No advance records found.</td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>Loading...</td></tr>
                        )}
                    </tbody>
                </table>
            </motion.div>

            <AnimatePresence>
                {showModal && (
                    <AdvanceModal
                        advance={editing}
                        employees={employees}
                        onClose={() => setShowModal(false)}
                        onSaved={(saved, isNew) => {
                            setAdvances(prev => isNew ? [saved, ...prev] : prev.map(a => a.id === saved.id ? saved : a))
                            setShowModal(false)
                        }}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function AdvanceModal({ advance, employees, onClose, onSaved }: {
    advance: Advance | null
    employees: EmployeeOption[]
    onClose: () => void
    onSaved: (advance: Advance, isNew: boolean) => void
}) {
    const { success: toastSuccess, error: toastError } = useToast()
    const [employeeId, setEmployeeId] = useState(advance?.employee_id || '')
    const [amount, setAmount] = useState(advance?.amount ?? 0)
    const [advanceDate, setAdvanceDate] = useState(advance?.advance_date || getLocalDateString())
    const [note, setNote] = useState(advance?.note || '')
    const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid'>(advance?.payment_status || 'Unpaid')
    const [saving, setSaving] = useState(false)

    const isEdit = !!advance

    const handleSave = async () => {
        if (!isEdit && !employeeId) { toastError('Please select an employee'); return }
        if (!Number.isFinite(amount) || amount <= 0) { toastError('Amount must be greater than 0'); return }

        setSaving(true)
        try {
            if (isEdit) {
                const res = await fetch(`/api/advances/${advance.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount, advance_date: advanceDate, note, payment_status: paymentStatus }),
                })
                if (res.ok) {
                    onSaved({ ...advance, amount, advance_date: advanceDate, note, payment_status: paymentStatus }, false)
                    toastSuccess('Advance updated')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to update')
                }
            } else {
                const res = await fetch('/api/advances', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: employeeId, amount, advance_date: advanceDate, note, payment_status: paymentStatus }),
                })
                if (res.ok) {
                    const json = await res.json()
                    onSaved(json.advance, true)
                    toastSuccess('Advance added')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to add advance')
                }
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">{isEdit ? 'Edit Advance' : 'Add Advance'}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}><IconX size={18} /></button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label className="form-label">Employee {!isEdit && '*'}</label>
                        {isEdit ? (
                            <input className="form-input" value={`${advance.employee?.name || ''} ${advance.employee?.employee_id ? `(${advance.employee.employee_id})` : ''}`} disabled style={{ opacity: 0.7 }} />
                        ) : (
                            <select className="form-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                                <option value="">Select employee...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}{emp.employee_id ? ` (${emp.employee_id})` : ''}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="form-label">Total Amount (৳) *</label>
                        <input className="form-input" type="number" min={1} value={amount}
                            onFocus={e => e.target.select()}
                            onChange={e => setAmount(Math.max(0, Number(e.target.value) || 0))} />
                    </div>

                    <div>
                        <label className="form-label">Advance Date *</label>
                        <input className="form-input" type="date" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)} />
                    </div>

                    <div>
                        <label className="form-label">Note</label>
                        <textarea className="form-input" rows={3} placeholder="Advance for personal emergency" value={note} onChange={e => setNote(e.target.value)} />
                    </div>

                    <div>
                        <label className="form-label">Payment Status</label>
                        <select className="form-input" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'Paid' | 'Unpaid')}>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Paid">Paid</option>
                        </select>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
            </motion.div>
        </div>
    )
}
