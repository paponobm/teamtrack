'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { getLocalDateString, getWeekRange, getMonthRange } from '@/lib/dateRange'
import {
    IconWallet, IconUsers, IconPlus, IconX, IconBanknote, IconCheckCircle, IconClock,
    IconSearch, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconCalendar,
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

interface Emi {
    id: string
    employee_id: string
    amount: number
    term_months: number
    start_date: string
    interest_rate: number
    monthly_installment: number
    created_at: string
    employee: { id: string; name: string; employee_id: string | null; avatar_url: string | null } | null
    created_by_employee: { id: string; name: string } | null
    total_payable: number
    paid: number
    due: number
    paid_installments: number
    total_installments: number
    remaining_installments: number
}

interface EmployeeOption {
    id: string
    name: string
    employee_id: string | null
    avatar_url: string | null
}

// Advance and EMI are two distinct tables/deduction types (see src/lib/emis.ts) merged
// client-side into one "Advance/EMI" list, matching how the Salary Sheet already keeps them
// as separate Advance/Loan columns while showing them together here for admin convenience.
interface CombinedRow {
    id: string
    record_type: 'Advance' | 'EMI'
    employee_id: string
    employee: EmployeeOption | null
    date: string
    amount: number
    // Advance has no installments — Paid/Due here is simply the full amount, gated by its own
    // payment_status. EMI is installment-based (see getEmiPaidSummaries in src/lib/emis.ts),
    // same Paid/Due semantics as Provident Fund.
    paid: number
    due: number
    advance?: Advance
    emi?: Emi
}

type DateRangeMode = 'all' | 'today' | 'week' | 'month' | 'custom'
const TERM_OPTIONS = [3, 6, 12, 24] as const

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || 'U').charCodeAt(0) % colors.length]
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Advance & EMI Management, embedded as a Finance Hub tab. Every advance is mirrored into
// the `expenses` table (category "Employee Advance", see src/lib/advances.ts) at creation/
// edit/delete time, so it's automatically included in the Overview tab's Total Expenses/Net
// Balance. EMI is a separate installment-loan module (src/lib/emis.ts) that also feeds the
// Salary Sheet's Loan column directly, and is mirrored into `expenses` the same way (category
// "Employee Loan", principal amount only — the linked expense's status stays 'pending' since
// EMI has no payment_status of its own; repayment happens via the Salary Sheet's live
// deduction, not a status flip on the expense).
export default function AdvanceManager() {
    const { success: toastSuccess, error: toastError } = useToast()

    const [advances, setAdvances] = useState<Advance[]>([])
    const [emis, setEmis] = useState<Emi[]>([])
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [employeeFilter, setEmployeeFilter] = useState('')
    const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('today')
    const [refDate, setRefDate] = useState(() => getLocalDateString())
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [addType, setAddType] = useState<'Advance' | 'EMI'>('Advance')
    const [editing, setEditing] = useState<CombinedRow | null>(null)

    const fetchData = useCallback(async () => {
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
            const [advRes, emiRes] = await Promise.all([
                fetch(`/api/advances?${params}`),
                fetch(`/api/emis?${params}`),
            ])
            if (advRes.ok) {
                const json = await advRes.json()
                setAdvances(json.advances || [])
            }
            if (emiRes.ok) {
                const json = await emiRes.json()
                setEmis(json.emis || [])
            }
        } finally {
            setLoading(false)
        }
    }, [dateRangeMode, refDate, customStart, customEnd])

    useEffect(() => { fetchData() }, [fetchData])

    useEffect(() => {
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) })
    }, [])

    const combined: CombinedRow[] = [
        ...advances.map(a => ({
            id: a.id, record_type: 'Advance' as const, employee_id: a.employee_id, employee: a.employee, date: a.advance_date, amount: a.amount,
            paid: a.payment_status === 'Paid' ? a.amount : 0, due: a.payment_status === 'Paid' ? 0 : a.amount,
            advance: a,
        })),
        ...emis.map(e => ({
            id: e.id, record_type: 'EMI' as const, employee_id: e.employee_id, employee: e.employee, date: e.start_date, amount: e.amount,
            paid: e.paid, due: e.due,
            emi: e,
        })),
    ].sort((a, b) => b.date.localeCompare(a.date))

    const filtered = combined.filter(row => {
        if (employeeFilter && row.employee_id !== employeeFilter) return false
        if (!search) return true
        const q = search.toLowerCase()
        return (row.employee?.name || '').toLowerCase().includes(q) || (row.employee?.employee_id || '').toLowerCase().includes(q)
    })

    // Total Advance/Total EMI each stay scoped to their own record type (principal amount,
    // matching the Amount column); Paid/Due are kept separate per record type too (Advance's
    // own payment_status vs. EMI's installment-based Paid/Due, see CombinedRow above), rather
    // than summed together, so each card reads as a single, unambiguous figure. Total
    // Employees reflects everyone with either in view.
    const summary = filtered.reduce((acc, row) => {
        if (row.record_type === 'Advance') {
            acc.totalAdvance += row.amount
            acc.totalAdvancePaid += row.paid
            acc.totalAdvanceDue += row.due
        } else {
            acc.totalEmi += row.amount
            acc.totalEmiPaid += row.paid
            acc.totalEmiDue += row.due
        }
        acc.employeeIds.add(row.employee_id)
        return acc
    }, { totalAdvance: 0, totalEmi: 0, totalAdvancePaid: 0, totalAdvanceDue: 0, totalEmiPaid: 0, totalEmiDue: 0, employeeIds: new Set<string>() })

    const handleDelete = async (row: CombinedRow) => {
        const label = row.record_type === 'Advance' ? 'advance' : 'EMI'
        const extra = ' This also removes its linked Finance Hub expense entry.'
        if (!confirm(`Delete this ${label} record for ${row.employee?.name || 'this employee'}?${extra}`)) return
        const url = row.record_type === 'Advance' ? `/api/advances/${row.id}` : `/api/emis/${row.id}`
        const res = await fetch(url, { method: 'DELETE' })
        if (res.ok) {
            if (row.record_type === 'Advance') setAdvances(prev => prev.filter(a => a.id !== row.id))
            else setEmis(prev => prev.filter(e => e.id !== row.id))
            toastSuccess(`${label === 'advance' ? 'Advance' : 'EMI'} record deleted`)
        } else {
            const err = await res.json()
            toastError(err.error || 'Failed to delete')
        }
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Salary Advance & EMI</h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>Manage employee advances, EMI loans and payment records</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setAddType('Advance'); setShowModal(true) }}>
                    <IconPlus size={16} /> Add Advance / EMI
                </button>
            </div>

            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconWallet size={14} color="var(--color-text-tertiary)" /> Total Advance</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>৳{summary.totalAdvance.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconBanknote size={14} color="var(--color-text-tertiary)" /> Total EMI</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#D97706' }}>৳{summary.totalEmi.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconUsers size={14} color="var(--color-text-tertiary)" /> Total Employees</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{summary.employeeIds.size}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="var(--color-text-tertiary)" /> Total Advance Paid</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>৳{summary.totalAdvancePaid.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="var(--color-text-tertiary)" /> Total Advance Due</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>৳{summary.totalAdvanceDue.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="var(--color-text-tertiary)" /> Total EMI Paid</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>৳{summary.totalEmiPaid.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="var(--color-text-tertiary)" /> Total EMI Due</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>৳{summary.totalEmiDue.toLocaleString()}</span>
                </div>
            </motion.div>

            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                    <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                    <input className="form-input" type="text" placeholder="Search by employee ID or name..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: '34px', height: '34px', fontSize: '0.8125rem', width: '100%' }} />
                </div>
                <select className="form-input" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
                    style={{ height: '34px', fontSize: '0.8125rem', width: 'auto' }}>
                    <option value="">All Employees</option>
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}{emp.employee_id ? ` (${emp.employee_id})` : ''}</option>
                    ))}
                </select>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {([{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }, { key: 'all', label: 'All' }] as const).map(opt => (
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

            <motion.div variants={item} initial="hidden" animate="show" className="card" style={{ overflowX: 'auto', padding: 0 }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>SL</th>
                            <th>Employee</th>
                            <th>Advance/EMI</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Paid</th>
                            <th>Due</th>
                            <th>Total Amount</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && filtered.map((row, i) => (
                            <tr key={`${row.record_type}-${row.id}`}>
                                <td>{i + 1}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="avatar avatar-sm" style={{ background: getAvatarColor(row.employee?.name || 'U'), overflow: 'hidden', flexShrink: 0, width: 28, height: 28, fontSize: '0.75rem' }}>
                                            {row.employee?.avatar_url ? (
                                                <img src={row.employee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (row.employee?.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{row.employee?.name || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{row.employee?.employee_id || '—'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span
                                        title={row.record_type === 'EMI' && row.emi ? `${row.emi.term_months} months, ${row.emi.interest_rate}% interest, ৳${row.emi.monthly_installment.toLocaleString()}/mo` : undefined}
                                        style={{
                                            display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                                            background: row.record_type === 'Advance' ? 'rgba(37,99,235,0.1)' : 'rgba(217,119,6,0.1)',
                                            color: row.record_type === 'Advance' ? '#2563EB' : '#D97706',
                                        }}>
                                        {row.record_type === 'Advance' ? 'Advance' : 'EMI'}
                                    </span>
                                </td>
                                <td>{formatDate(row.date)}</td>
                                <td style={{ fontWeight: 700 }}>
                                    ৳{row.amount.toLocaleString()}
                                    {row.record_type === 'EMI' && row.emi && (
                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>৳{row.emi.monthly_installment.toLocaleString()}/mo × {row.emi.term_months}</div>
                                    )}
                                </td>
                                <td style={{ color: '#16A34A' }}>
                                    ৳{row.paid.toLocaleString()}
                                    {row.record_type === 'EMI' && row.emi && row.emi.paid_installments > 0 && (
                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>৳{row.emi.monthly_installment.toLocaleString()} × {row.emi.paid_installments}</div>
                                    )}
                                </td>
                                <td style={{ color: row.due > 0 ? '#DC2626' : undefined }}>
                                    ৳{row.due.toLocaleString()}
                                    {row.record_type === 'EMI' && row.emi && row.emi.remaining_installments > 0 && (
                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>৳{row.emi.monthly_installment.toLocaleString()} × {row.emi.remaining_installments}</div>
                                    )}
                                </td>
                                <td style={{ fontWeight: 700 }}>
                                    ৳{(row.record_type === 'EMI' && row.emi ? row.emi.total_payable : row.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    {row.record_type === 'EMI' && row.emi && row.emi.interest_rate > 0 && (
                                        <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', marginLeft: '4px' }}>({row.emi.interest_rate}%)</span>
                                    )}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => { setEditing(row); setAddType(row.record_type); setShowModal(true) }} title="Edit"><IconEdit size={15} /></button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(row)} title="Delete" style={{ color: '#DC2626' }}><IconTrash size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>No advance or EMI records found.</td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>Loading...</td></tr>
                        )}
                    </tbody>
                </table>
            </motion.div>

            <AnimatePresence>
                {showModal && (
                    <AddEditModal
                        editing={editing}
                        addType={addType}
                        setAddType={setAddType}
                        employees={employees}
                        onClose={() => setShowModal(false)}
                        onSavedAdvance={(saved, isNew) => {
                            setAdvances(prev => isNew ? [saved, ...prev] : prev.map(a => a.id === saved.id ? saved : a))
                            setShowModal(false)
                        }}
                        onSavedEmi={(saved, isNew) => {
                            setEmis(prev => isNew ? [saved, ...prev] : prev.map(e => e.id === saved.id ? saved : e))
                            setShowModal(false)
                        }}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function AddEditModal({ editing, addType, setAddType, employees, onClose, onSavedAdvance, onSavedEmi }: {
    editing: CombinedRow | null
    addType: 'Advance' | 'EMI'
    setAddType: (t: 'Advance' | 'EMI') => void
    employees: EmployeeOption[]
    onClose: () => void
    onSavedAdvance: (advance: Advance, isNew: boolean) => void
    onSavedEmi: (emi: Emi, isNew: boolean) => void
}) {
    const isEdit = !!editing
    // Editing locks the type to whatever record is being edited — you can't turn an Advance
    // into an EMI mid-edit. Adding shows a picker so the same "Add Record" button covers both.
    const recordType = isEdit ? editing!.record_type : addType

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">{isEdit ? `Edit ${recordType}` : 'Add  Advance / EMI'}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}><IconX size={18} /></button>
                </div>

                {!isEdit && (
                    <div style={{ display: 'flex', gap: '2px', margin: '16px 20px 0', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                        {(['Advance', 'EMI'] as const).map(t => (
                            <button key={t} onClick={() => setAddType(t)} type="button"
                                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', background: addType === t ? 'var(--color-bg-primary)' : 'transparent', color: addType === t ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', boxShadow: addType === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                                {t}
                            </button>
                        ))}
                    </div>
                )}

                {recordType === 'Advance' ? (
                    <AdvanceForm advance={editing?.advance || null} employees={employees} onClose={onClose} onSaved={onSavedAdvance} />
                ) : (
                    <EmiForm emi={editing?.emi || null} employees={employees} onClose={onClose} onSaved={onSavedEmi} />
                )}
            </motion.div>
        </div>
    )
}

function AdvanceForm({ advance, employees, onClose, onSaved }: {
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
    // No status picker in this UI (see table above) — new advances default Unpaid, and
    // editing preserves whatever status the record already has (e.g. set by the Payroll
    // "mark salary Paid" cascade) rather than silently resetting it.
    const paymentStatus: 'Paid' | 'Unpaid' = advance?.payment_status || 'Unpaid'
    const [saving, setSaving] = useState(false)

    const isEdit = !!advance

    const handleSave = async () => {
        if (!employeeId) { toastError('Please select an employee'); return }
        if (!Number.isFinite(amount) || amount <= 0) { toastError('Amount must be greater than 0'); return }

        setSaving(true)
        try {
            if (isEdit) {
                const res = await fetch(`/api/advances/${advance.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: employeeId, amount, advance_date: advanceDate, note, payment_status: paymentStatus }),
                })
                if (res.ok) {
                    const selectedEmployee = employees.find(e => e.id === employeeId)
                    onSaved({
                        ...advance, employee_id: employeeId, amount, advance_date: advanceDate, note, payment_status: paymentStatus,
                        employee: selectedEmployee ? { id: selectedEmployee.id, name: selectedEmployee.name, employee_id: selectedEmployee.employee_id, avatar_url: selectedEmployee.avatar_url } : advance.employee,
                    }, false)
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
        <>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                    <label className="form-label">Employee *</label>
                    <select className="form-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                        <option value="">Select employee...</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}{emp.employee_id ? ` (${emp.employee_id})` : ''}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="form-label">Amount (৳) *</label>
                    <input className="form-input" type="number" min={1} value={amount}
                        onFocus={e => e.target.select()}
                        onChange={e => setAmount(Math.max(0, Number(e.target.value) || 0))} />
                </div>

                <div>
                    <label className="form-label">Date *</label>
                    <input className="form-input" type="date" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)} />
                </div>

                <div>
                    <label className="form-label">Note</label>
                    <textarea className="form-input" rows={3} placeholder="Advance for personal emergency" value={note} onChange={e => setNote(e.target.value)} />
                </div>
            </div>

            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
        </>
    )
}

function EmiForm({ emi, employees, onClose, onSaved }: {
    emi: Emi | null
    employees: EmployeeOption[]
    onClose: () => void
    onSaved: (emi: Emi, isNew: boolean) => void
}) {
    const { success: toastSuccess, error: toastError } = useToast()
    const [employeeId, setEmployeeId] = useState(emi?.employee_id || '')
    const [termMonths, setTermMonths] = useState<number>(emi?.term_months || 3)
    const [amount, setAmount] = useState(emi?.amount ?? 0)
    const [startDate, setStartDate] = useState(emi?.start_date || getLocalDateString())
    const [interestRate, setInterestRate] = useState(emi?.interest_rate ?? 0)
    const [saving, setSaving] = useState(false)

    const isEdit = !!emi

    // Flat interest, split evenly: Total = Amount × (1 + rate/100), Monthly = Total ÷ term.
    // Mirrors src/lib/emis.ts computeMonthlyInstallment exactly — shown live so the admin
    // sees what will land in the Salary Sheet's Loan column before saving.
    const previewTotalPayable = amount * (1 + (interestRate || 0) / 100)
    const previewInstallment = amount > 0 && termMonths > 0 ? previewTotalPayable / termMonths : 0

    const handleSave = async () => {
        if (!employeeId) { toastError('Please select an employee'); return }
        if (!Number.isFinite(amount) || amount <= 0) { toastError('Amount must be greater than 0'); return }
        if (!Number.isFinite(interestRate) || interestRate < 0) { toastError('Interest rate must be 0 or greater'); return }

        setSaving(true)
        try {
            if (isEdit) {
                const res = await fetch(`/api/emis/${emi.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: employeeId, amount, term_months: termMonths, start_date: startDate, interest_rate: interestRate }),
                })
                if (res.ok) {
                    const selectedEmployee = employees.find(e => e.id === employeeId)
                    onSaved({
                        ...emi, employee_id: employeeId, amount, term_months: termMonths, start_date: startDate, interest_rate: interestRate, monthly_installment: previewInstallment,
                        total_payable: previewTotalPayable, due: Math.max(0, previewTotalPayable - emi.paid),
                        employee: selectedEmployee ? { id: selectedEmployee.id, name: selectedEmployee.name, employee_id: selectedEmployee.employee_id, avatar_url: selectedEmployee.avatar_url } : emi.employee,
                    }, false)
                    toastSuccess('EMI updated')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to update')
                }
            } else {
                const res = await fetch('/api/emis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: employeeId, amount, term_months: termMonths, start_date: startDate, interest_rate: interestRate }),
                })
                if (res.ok) {
                    const json = await res.json()
                    onSaved(json.emi, true)
                    toastSuccess('EMI added')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to add EMI')
                }
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                    <label className="form-label">Employee Name *</label>
                    <select className="form-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                        <option value="">Select employee...</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}{emp.employee_id ? ` (${emp.employee_id})` : ''}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="form-label">Type *</label>
                    <select className="form-input" value={termMonths} onChange={e => setTermMonths(Number(e.target.value))}>
                        {TERM_OPTIONS.map(t => <option key={t} value={t}>{t} Month</option>)}
                    </select>
                </div>

                <div>
                    <label className="form-label">Amount (৳) *</label>
                    <input className="form-input" type="number" min={1} value={amount}
                        onFocus={e => e.target.select()}
                        onChange={e => setAmount(Math.max(0, Number(e.target.value) || 0))} />
                </div>

                <div>
                    <label className="form-label">Start Date *</label>
                    <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>

                <div>
                    <label className="form-label">Interest Rate (%) *</label>
                    <input className="form-input" type="number" min={0} step={0.01} value={interestRate}
                        onFocus={e => e.target.select()}
                        onChange={e => setInterestRate(Math.max(0, Number(e.target.value) || 0))} />
                </div>

                {amount > 0 && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', background: 'rgba(217,119,6,0.08)', borderRadius: '8px', padding: '8px 10px' }}>
                        Monthly installment: <strong style={{ color: '#D97706' }}>৳{previewInstallment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> × {termMonths} months
                    </div>
                )}
            </div>

            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
        </>
    )
}
