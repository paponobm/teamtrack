'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { IconFileText, IconX } from '@/components/icons/Icons'

interface SalaryEntry {
    id: string
    employee_id: string
    employee: { id: string; name: string; employee_id: string | null; avatar_url: string | null; department: string | null }
    basic_salary: number
    extra_duty: number
    performance_bonus: number
    festival_bonus: number
    advance: number
    loan: number
    other_deduction: number
    payment_status: 'Paid' | 'Unpaid'
    payment_method: string | null
    payment_date: string | null
    attendance: { present: number; late: number; absent: number; leave: number }
    fine: number
    net_payable: number
}

const EDITABLE_AMOUNT_FIELDS = [
    { key: 'basic_salary', label: 'Basic Salary' },
    { key: 'extra_duty', label: 'Extra Duty' },
    { key: 'advance', label: 'Advance' },
    { key: 'loan', label: 'Loan' },
    { key: 'performance_bonus', label: 'Performance Bonus' },
    { key: 'festival_bonus', label: 'Festival Bonus' },
    { key: 'other_deduction', label: 'Other Deduction' },
] as const

// Same set/colors used for PR Management's payment gateway breakdown — reused here so a
// given method reads the same way everywhere in the app.
const PAYMENT_METHODS = ['bKash', 'Rocket', 'Nagad', 'Bank', 'Cash'] as const
const PAYMENT_METHOD_COLORS: Record<string, string> = {
    'bKash': '#E2136E', 'Rocket': '#8C3494', 'Nagad': '#F7941D', 'Bank': '#2563EB', 'Cash': '#10B981',
}

function currentMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || 'U').charCodeAt(0) % colors.length]
}

function daysInMonth(month: string) {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m, 0).getDate()
}

// Present days vs. the calendar month's day count — green/amber/red so a thin sheet reads
// at a glance without opening every row.
function attendanceColor(present: number, totalDays: number) {
    if (totalDays <= 0) return '#6B7280'
    const ratio = present / totalDays
    if (ratio >= 0.9) return '#16A34A'
    if (ratio >= 0.7) return '#D97706'
    return '#DC2626'
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMonthLabel(month: string) {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function SalarySheet() {
    const { success: toastSuccess, error: toastError } = useToast()
    const [month, setMonth] = useState(currentMonth)
    const [sheetExists, setSheetExists] = useState<boolean | null>(null)
    const [entries, setEntries] = useState<SalaryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [editing, setEditing] = useState<SalaryEntry | null>(null)

    const load = useCallback(async (m: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/payroll/salary-sheets?month=${m}`)
            if (res.ok) {
                const json = await res.json()
                setSheetExists(!!json.sheet)
                setEntries(json.entries || [])
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load(month) }, [month, load])

    const handleCreate = async () => {
        setCreating(true)
        try {
            const res = await fetch('/api/payroll/salary-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month }),
            })
            if (res.ok) {
                const json = await res.json()
                setSheetExists(true)
                setEntries(json.entries || [])
                toastSuccess('Salary sheet created')
            } else {
                const err = await res.json()
                toastError(err.error || 'Failed to create salary sheet')
            }
        } finally {
            setCreating(false)
        }
    }

    const totalDays = daysInMonth(month)

    return (
        <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} 
                style={{ marginBottom: '4px', padding: '40px 0' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{formatMonthLabel(month)} Employee Salary Sheet</h2>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Month</label>
                <input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.8125rem', width: 'auto' }} />
            </motion.div>

            {!loading && sheetExists === false && (
                <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                    <IconFileText size={28} color="var(--color-text-tertiary)" />
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>No salary sheet for this month yet</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>Create one to auto-load active employees and start entering salary amounts.</div>
                    <button className="btn btn-primary" disabled={creating} onClick={handleCreate} style={{ marginTop: '8px' }}>
                        {creating ? 'Creating...' : 'Create Salary Sheet'}
                    </button>
                </div>
            )}

            {!loading && sheetExists && (
                <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                    <table className="table payroll-grid-table" style={{ whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr>
                                <th>SL</th>
                                <th>Employee</th>
                                <th>Department</th>
                                <th>Basic Salary</th>
                                <th>Attendance (Day)</th>
                                <th>Extra Duty</th>
                                <th>Advance</th>
                                <th>Loan</th>
                                <th>Monthly Fine</th>
                                <th>Performance Bonus</th>
                                <th>Festival Bonus</th>
                                <th>Net Salary</th>
                                <th>Paid / Non-Paid</th>
                                <th>Payment Method</th>
                                <th>Payment Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e, i) => (
                                <tr key={e.id} onClick={() => setEditing(e)} style={{ cursor: 'pointer' }}>
                                    <td>{i + 1}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="avatar avatar-sm" style={{ background: getAvatarColor(e.employee.name), overflow: 'hidden', flexShrink: 0, width: 28, height: 28, fontSize: '0.75rem' }}>
                                                {e.employee.avatar_url ? (
                                                    <img src={e.employee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (e.employee.name || 'U')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{e.employee.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{e.employee.employee_id || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{e.employee.department || '—'}</td>
                                    <td>৳{e.basic_salary.toLocaleString()}</td>
                                    <td>
                                        <span style={{ fontWeight: 700, color: attendanceColor(e.attendance.present, totalDays) }}>{e.attendance.present}</span>
                                        <span style={{ color: 'var(--color-text-tertiary)' }}> / {totalDays}</span>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                                            Leave: {e.attendance.leave} · Late: {e.attendance.late}
                                        </div>
                                    </td>
                                    <td>৳{e.extra_duty.toLocaleString()}</td>
                                    <td>৳{e.advance.toLocaleString()}</td>
                                    <td>৳{e.loan.toLocaleString()}</td>
                                    <td style={{ color: e.fine > 0 ? '#DC2626' : undefined }}>৳{e.fine.toLocaleString()}</td>
                                    <td>৳{e.performance_bonus.toLocaleString()}</td>
                                    <td>৳{e.festival_bonus.toLocaleString()}</td>
                                    <td style={{ fontWeight: 700, color: '#16A34A' }}>৳{e.net_payable.toLocaleString()}</td>
                                    <td>
                                        <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: e.payment_status === 'Paid' ? '#16A34A' : '#DC2626', background: e.payment_status === 'Paid' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)' }}>
                                            {e.payment_status === 'Paid' ? 'Paid' : 'Non-Paid'}
                                        </span>
                                    </td>
                                    <td>
                                        {e.payment_method ? (
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: PAYMENT_METHOD_COLORS[e.payment_method] || '#6B7280', background: `${PAYMENT_METHOD_COLORS[e.payment_method] || '#6B7280'}15` }}>
                                                {e.payment_method}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td>{formatDate(e.payment_date)}</td>
                                </tr>
                            ))}
                            {entries.length === 0 && (
                                <tr><td colSpan={15} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>No active employees found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <AnimatePresence>
                {editing && (
                    <EditEntryModal
                        entry={editing}
                        onClose={() => setEditing(null)}
                        onSaved={(updated) => {
                            setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
                            setEditing(null)
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Excel/Sheets-style grid borders, scoped to this table only — the shared
                .table class elsewhere in the app keeps its row-only borders. */}
            <style jsx>{`
                .payroll-grid-table {
                    border-collapse: collapse;
                }
                .payroll-grid-table th,
                .payroll-grid-table td {
                    border: 1px solid var(--color-border-light);
                }
            `}</style>
        </div>
    )
}

function EditEntryModal({ entry, onClose, onSaved }: { entry: SalaryEntry; onClose: () => void; onSaved: (e: SalaryEntry) => void }) {
    const { success: toastSuccess, error: toastError } = useToast()
    const [amounts, setAmounts] = useState({
        basic_salary: entry.basic_salary,
        extra_duty: entry.extra_duty,
        advance: entry.advance,
        loan: entry.loan,
        performance_bonus: entry.performance_bonus,
        festival_bonus: entry.festival_bonus,
        other_deduction: entry.other_deduction,
    })
    const [paymentStatus, setPaymentStatus] = useState(entry.payment_status)
    const [paymentMethod, setPaymentMethod] = useState(entry.payment_method || '')
    const [paymentDate, setPaymentDate] = useState(entry.payment_date || '')
    const [saving, setSaving] = useState(false)

    const netPayable = amounts.basic_salary + amounts.extra_duty + amounts.performance_bonus + amounts.festival_bonus
        - entry.fine - amounts.advance - amounts.loan - amounts.other_deduction

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/payroll/salary-entries', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: entry.id,
                    ...amounts,
                    payment_status: paymentStatus,
                    payment_method: paymentMethod || null,
                    payment_date: paymentDate || null,
                }),
            })
            if (res.ok) {
                onSaved({
                    ...entry, ...amounts, payment_status: paymentStatus,
                    payment_method: paymentMethod || null, payment_date: paymentDate || null,
                    net_payable: netPayable,
                })
                toastSuccess('Salary entry updated')
            } else {
                const err = await res.json()
                toastError(err.error || 'Failed to update')
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">{entry.employee.name}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}><IconX size={18} /></button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '12px', borderRadius: '10px', background: 'var(--color-bg-secondary)' }}>
                        <ReadOnlyField label="Employee ID" value={entry.employee.employee_id || '—'} />
                        <ReadOnlyField label="Department" value={entry.employee.department || '—'} />
                        <ReadOnlyField label="Attendance" value={`${entry.attendance.present} present, ${entry.attendance.absent} absent`} />
                        <ReadOnlyField label="Leave Days" value={String(entry.attendance.leave)} />
                        <ReadOnlyField label="Fine" value={`৳${entry.fine.toLocaleString()}`} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {EDITABLE_AMOUNT_FIELDS.map(f => (
                            <div key={f.key}>
                                <label className="form-label">{f.label}</label>
                                <input className="form-input" type="number" min={0} value={amounts[f.key]}
                                    onChange={e => setAmounts(prev => ({ ...prev, [f.key]: Math.max(0, Number(e.target.value) || 0) }))} />
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div>
                            <label className="form-label">Payment Status</label>
                            <select className="form-input" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'Paid' | 'Unpaid')}>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Paid">Paid</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Payment Method</label>
                            <select className="form-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                <option value="">—</option>
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Payment Date</label>
                            <input className="form-input" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', background: 'rgba(22,163,74,0.08)' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Net Salary</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16A34A' }}>৳{netPayable.toLocaleString()}</span>
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginTop: '2px' }}>{value}</div>
        </div>
    )
}
