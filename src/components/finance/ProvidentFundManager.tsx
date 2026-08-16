'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { getLocalDateString, getWeekRange, getMonthRange } from '@/lib/dateRange'
import {
    IconUsers, IconPlus, IconX, IconBanknote, IconCheckCircle, IconClock, IconTrendingUp,
    IconSearch, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconCalendar,
} from '@/components/icons/Icons'

interface ProvidentFund {
    id: string
    employee_id: string
    principal_amount: number
    duration_months: number
    interest_rate: number
    monthly_installment: number
    start_date: string
    note: string | null
    created_at: string
    employee: { id: string; name: string; employee_id: string | null; avatar_url: string | null; department: { id: string; name: string } | null } | null
    created_by_employee: { id: string; name: string } | null
    total_payable: number
    total_amount: number
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

type DateRangeMode = 'all' | 'today' | 'week' | 'month' | 'custom'
// Extendable on purpose — the API doesn't restrict duration_months to this list, so a new
// option can be added here alone whenever a longer/shorter term is needed.
const DURATION_OPTIONS = [3, 6, 12, 18, 24] as const

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || 'U').charCodeAt(0) % colors.length]
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Provident Fund, embedded as a Finance Hub tab alongside Salary Advance & EMI. Architecturally
// identical to EMI (src/lib/providentFunds.ts) — flat interest over a fixed duration, feeding
// the Salary Sheet's Provident Fund deduction live. No linked Expense record (it's a payroll
// deduction, not an out-of-pocket expense) — same precedent EMI already established. Paid/Due
// come from whether each covered month's Salary Sheet entry was marked Paid, so "paying" an
// installment is just using the Salary Sheet's existing Mark-as-Paid flow — no separate
// payment-recording UI here.
export default function ProvidentFundManager() {
    const { success: toastSuccess, error: toastError } = useToast()

    const [funds, setFunds] = useState<ProvidentFund[]>([])
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [employeeFilter, setEmployeeFilter] = useState('')
    const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('today')
    const [refDate, setRefDate] = useState(() => getLocalDateString())
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<ProvidentFund | null>(null)

    const fetchFunds = useCallback(async () => {
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
            const res = await fetch(`/api/provident-funds?${params}`)
            if (res.ok) {
                const json = await res.json()
                setFunds(json.provident_funds || [])
            }
        } finally {
            setLoading(false)
        }
    }, [dateRangeMode, refDate, customStart, customEnd])

    useEffect(() => { fetchFunds() }, [fetchFunds])

    useEffect(() => {
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) })
    }, [])

    const filtered = funds.filter(f => {
        if (employeeFilter && f.employee_id !== employeeFilter) return false
        if (!search) return true
        const q = search.toLowerCase()
        return (f.employee?.name || '').toLowerCase().includes(q) || (f.employee?.employee_id || '').toLowerCase().includes(q)
    })

    // Computed from the same filtered set the table shows, so the cards always match whatever
    // combination of date + employee filters is active.
    const summary = filtered.reduce((acc, f) => {
        acc.totalProvidentFund += f.principal_amount
        acc.totalPaid += f.paid
        acc.totalDue += f.due
        acc.employeeIds.add(f.employee_id)
        return acc
    }, { totalProvidentFund: 0, totalPaid: 0, totalDue: 0, employeeIds: new Set<string>() })

    // How many records use each interest rate — e.g. "10% — 2, 8% — 1" — so a mix of rates
    // across employees is visible at a glance instead of collapsing to a single misleading number.
    const interestRateBreakdown = Object.entries(
        filtered.reduce((acc, f) => {
            acc[f.interest_rate] = (acc[f.interest_rate] || 0) + 1
            return acc
        }, {} as Record<number, number>)
    ).sort((a, b) => Number(b[0]) - Number(a[0]))

    const handleDelete = async (f: ProvidentFund) => {
        if (!confirm(`Delete this Provident Fund record for ${f.employee?.name || 'this employee'}? This also removes its remaining Salary Sheet deductions.`)) return
        const res = await fetch(`/api/provident-funds/${f.id}`, { method: 'DELETE' })
        if (res.ok) {
            setFunds(prev => prev.filter(x => x.id !== f.id))
            toastSuccess('Provident Fund record deleted')
        } else {
            const err = await res.json()
            toastError(err.error || 'Failed to delete')
        }
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Provident Fund</h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>Manage employee provident fund contributions, installments, and returns.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
                    <IconPlus size={16} /> Add Provident Fund
                </button>
            </div>

            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconBanknote size={14} color="var(--color-text-tertiary)" /> Total Provident Fund</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>৳{summary.totalProvidentFund.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconUsers size={14} color="var(--color-text-tertiary)" /> Total Employees</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{summary.employeeIds.size}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="var(--color-text-tertiary)" /> Total Paid</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>৳{summary.totalPaid.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="var(--color-text-tertiary)" /> Total Due</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>৳{summary.totalDue.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconTrendingUp size={14} color="var(--color-text-tertiary)" /> Interest Rate</span>
                    {interestRateBreakdown.length === 0 ? (
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>—</span>
                    ) : interestRateBreakdown.length === 1 ? (
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{interestRateBreakdown[0][0]}%</span>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {interestRateBreakdown.map(([rate, count]) => (
                                <div key={rate} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#2563EB' }}>{rate}%</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
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
                                <motion.div layoutId="providentFundDateTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
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
                            <th>Department</th>
                            <th>Provident Amount</th>
                            <th>Duration</th>
                            <th>Start Date</th>
                            <th>Interest</th>
                            <th>Paid</th>
                            <th>Due</th>
                            <th>Total Amount</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && filtered.map((f, i) => (
                            <tr key={f.id}>
                                <td>{i + 1}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="avatar avatar-sm" style={{ background: getAvatarColor(f.employee?.name || 'U'), overflow: 'hidden', flexShrink: 0, width: 28, height: 28, fontSize: '0.75rem' }}>
                                            {f.employee?.avatar_url ? (
                                                <img src={f.employee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (f.employee?.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{f.employee?.name || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{f.employee?.employee_id || '—'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>{f.employee?.department?.name || '—'}</td>
                                <td style={{ fontWeight: 700 }}>৳{f.principal_amount.toLocaleString()}</td>
                                <td>{f.duration_months} Months</td>
                                <td>{formatDate(f.start_date)}</td>
                                <td>{f.interest_rate}%</td>
                                <td style={{ color: '#16A34A' }}>
                                    ৳{f.paid.toLocaleString()}
                                    {f.paid_installments > 0 && (
                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>৳{f.monthly_installment.toLocaleString()} × {f.paid_installments}</div>
                                    )}
                                </td>
                                <td style={{ color: f.due > 0 ? '#DC2626' : undefined }}>
                                    ৳{f.due.toLocaleString()}
                                    {f.remaining_installments > 0 && (
                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>৳{f.monthly_installment.toLocaleString()} × {f.remaining_installments}</div>
                                    )}
                                </td>
                                <td style={{ fontWeight: 700 }}>৳{f.total_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => { setEditing(f); setShowModal(true) }} title="Edit"><IconEdit size={15} /></button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(f)} title="Delete" style={{ color: '#DC2626' }}><IconTrash size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>No provident fund records found.</td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>Loading...</td></tr>
                        )}
                    </tbody>
                </table>
            </motion.div>

            <AnimatePresence>
                {showModal && (
                    <ProvidentFundModal
                        fund={editing}
                        employees={employees}
                        onClose={() => setShowModal(false)}
                        onSaved={(saved, isNew) => {
                            setFunds(prev => isNew ? [saved, ...prev] : prev.map(f => f.id === saved.id ? saved : f))
                            setShowModal(false)
                        }}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function ProvidentFundModal({ fund, employees, onClose, onSaved }: {
    fund: ProvidentFund | null
    employees: EmployeeOption[]
    onClose: () => void
    onSaved: (fund: ProvidentFund, isNew: boolean) => void
}) {
    const { success: toastSuccess, error: toastError } = useToast()
    const [employeeId, setEmployeeId] = useState(fund?.employee_id || '')
    const [principalAmount, setPrincipalAmount] = useState(fund?.principal_amount ?? 0)
    const [durationMonths, setDurationMonths] = useState<number>(fund?.duration_months || 12)
    const [interestRate, setInterestRate] = useState(fund?.interest_rate ?? 0)
    const [startDate, setStartDate] = useState(fund?.start_date || getLocalDateString())
    const [note, setNote] = useState(fund?.note || '')
    const [saving, setSaving] = useState(false)

    const isEdit = !!fund

    // Unlike EMI, the employee only ever pays back their own principal — the monthly
    // deduction (and Paid/Due) is principal ÷ duration, never inflated by interest (see
    // src/lib/providentFunds.ts computeMonthlyInstallment). Total Amount is a separate,
    // informational figure: principal + interest, what the employee receives back from the
    // company at maturity — it has no bearing on what's deducted or on Due.
    const totalPayable = principalAmount
    const monthlyInstallment = principalAmount > 0 && durationMonths > 0 ? totalPayable / durationMonths : 0
    const totalAmount = principalAmount * (1 + (interestRate || 0) / 100)

    const handleSave = async () => {
        if (!employeeId) { toastError('Please select an employee'); return }
        if (!Number.isFinite(principalAmount) || principalAmount <= 0) { toastError('Provident Fund Amount must be greater than 0'); return }
        if (!Number.isFinite(interestRate) || interestRate < 0) { toastError('Interest rate must be 0 or greater'); return }

        setSaving(true)
        try {
            const payload = { employee_id: employeeId, principal_amount: principalAmount, duration_months: durationMonths, start_date: startDate, interest_rate: interestRate, note }
            if (isEdit) {
                const res = await fetch(`/api/provident-funds/${fund.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (res.ok) {
                    const selectedEmployee = employees.find(e => e.id === employeeId)
                    const totalPaidSoFar = fund.paid
                    onSaved({
                        ...fund, employee_id: employeeId, principal_amount: principalAmount, duration_months: durationMonths, start_date: startDate, interest_rate: interestRate, note,
                        monthly_installment: monthlyInstallment, total_payable: totalPayable, total_amount: totalAmount, due: Math.max(0, totalPayable - totalPaidSoFar),
                        employee: selectedEmployee ? { id: selectedEmployee.id, name: selectedEmployee.name, employee_id: selectedEmployee.employee_id, avatar_url: selectedEmployee.avatar_url, department: fund.employee?.department || null } : fund.employee,
                    }, false)
                    toastSuccess('Provident Fund updated')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to update')
                }
            } else {
                const res = await fetch('/api/provident-funds', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (res.ok) {
                    const json = await res.json()
                    onSaved(json.provident_fund, true)
                    toastSuccess('Provident Fund added')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to add Provident Fund')
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
                    <div className="modal-title">{isEdit ? 'Edit Provident Fund' : 'Add Provident Fund'}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}><IconX size={18} /></button>
                </div>

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
                        <label className="form-label">Provident Fund Amount (৳) *</label>
                        <input className="form-input" type="number" min={1} value={principalAmount}
                            onFocus={e => e.target.select()}
                            onChange={e => setPrincipalAmount(Math.max(0, Number(e.target.value) || 0))} />
                    </div>

                    <div>
                        <label className="form-label">Duration *</label>
                        <select className="form-input" value={durationMonths} onChange={e => setDurationMonths(Number(e.target.value))}>
                            {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} Months</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="form-label">Interest Rate (%) *</label>
                        <input className="form-input" type="number" min={0} step={0.01} value={interestRate}
                            onFocus={e => e.target.select()}
                            onChange={e => setInterestRate(Math.max(0, Number(e.target.value) || 0))} />
                    </div>

                    <div>
                        <label className="form-label">Start Date *</label>
                        <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>

                    <div>
                        <label className="form-label">Note</label>
                        <textarea className="form-input" rows={3} placeholder="Provident fund note..." value={note} onChange={e => setNote(e.target.value)} />
                    </div>

                    {principalAmount > 0 && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', background: 'rgba(37,99,235,0.08)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>Principal Amount: <strong style={{ color: 'var(--color-text-primary)' }}>৳{principalAmount.toLocaleString()}</strong></div>
                            <div>Interest Rate: <strong style={{ color: 'var(--color-text-primary)' }}>{interestRate}%</strong></div>
                            <div>Duration: <strong style={{ color: 'var(--color-text-primary)' }}>{durationMonths} Months</strong></div>
                            <div>Monthly Installment (deducted from salary): <strong style={{ color: '#2563EB' }}>৳{monthlyInstallment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
                            <div>Total Amount (principal + interest, received at maturity): <strong style={{ color: '#16A34A' }}>৳{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
            </motion.div>
        </div>
    )
}
