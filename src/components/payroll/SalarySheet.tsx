'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { IconFileText, IconX, IconPrinter } from '@/components/icons/Icons'
import PaySlipModal from './PaySlipModal'

export interface SalaryEntry {
    id: string
    employee_id: string
    employee: { id: string; name: string; employee_id: string | null; avatar_url: string | null; joining_date: string | null; department: string | null }
    basic_salary: number
    extra_duty: number
    transportation_bill: number
    snacks_bill: number
    performance_bonus: number
    festival_bonus: number
    advance: number
    advance_records: { date: string; amount: number }[]
    loan: number
    other_deduction: number
    payment_status: 'Paid' | 'Unpaid'
    payment_method: string | null
    payment_date: string | null
    attendance: { present: number; late: number; absent: number; leave: number }
    fine: number
    net_payable: number
}

// Advance is intentionally not here — it's read-only, computed live from the Advance
// Management module (src/app/(dashboard)/advance-management), same as Fine.
const EDITABLE_AMOUNT_FIELDS = [
    { key: 'basic_salary', label: 'Basic Salary' },
    { key: 'extra_duty', label: 'Extra Duty' },
    { key: 'transportation_bill', label: 'Transportation Bill' },
    { key: 'snacks_bill', label: 'Snacks Bill' },
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
    const [payslipEntry, setPayslipEntry] = useState<SalaryEntry | null>(null)

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
                                <th className="sticky-col-1">SL</th>
                                <th className="sticky-col-2">Employee</th>
                                <th>Department</th>
                                <th>Basic Salary</th>
                                <th>Attendance (Day)</th>
                                <th>Extra Duty</th>
                                <th>Transportation Bill</th>
                                <th>Snacks Bill</th>
                                <th>Advance</th>
                                <th>Loan</th>
                                <th>Monthly Fine</th>
                                <th>Performance Bonus</th>
                                <th>Festival Bonus</th>
                                <th>Net Salary</th>
                                <th>Paid / Non-Paid</th>
                                <th>Payment Method</th>
                                <th>Payment Date</th>
                                <th>Pay Slip</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e, i) => (
                                <tr key={e.id} onClick={() => setEditing(e)} style={{ cursor: 'pointer' }}>
                                    <td className="sticky-col-1">{i + 1}</td>
                                    <td className="sticky-col-2">
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
                                            Leave: {e.attendance.leave} 
                                        </div>
                                    </td>
                                    <td style={{ color: e.extra_duty > 0 ? '#16A34A' : undefined }}>৳{e.extra_duty.toLocaleString()}</td>
                                    <td style={{ color: e.transportation_bill > 0 ? '#16A34A' : undefined }}>৳{e.transportation_bill.toLocaleString()}</td>
                                    <td style={{ color: e.snacks_bill > 0 ? '#16A34A' : undefined }}>৳{e.snacks_bill.toLocaleString()}</td>
                                    <td className="advance-cell" style={{ color: e.advance > 0 ? '#DC2626' : undefined }}>
                                        ৳{e.advance.toLocaleString()}
                                        {e.advance_records.length > 0 && (
                                            <div className="advance-tooltip">
                                                {e.advance_records.map((r, idx) => (
                                                    <div key={idx}>{formatDate(r.date)}: ৳{r.amount.toLocaleString()}</div>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ color: e.loan > 0 ? '#DC2626' : undefined }}>৳{e.loan.toLocaleString()}</td>
                                    <td style={{ color: e.fine > 0 ? '#DC2626' : undefined }}>৳{e.fine.toLocaleString()}</td>
                                    <td style={{ color: e.performance_bonus > 0 ? '#16A34A' : undefined }}>৳{e.performance_bonus.toLocaleString()}</td>
                                    <td style={{ color: e.festival_bonus > 0 ? '#16A34A' : undefined }}>৳{e.festival_bonus.toLocaleString()}</td>
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
                                    <td>
                                        <button className="btn btn-secondary btn-sm" onClick={(ev) => { ev.stopPropagation(); setPayslipEntry(e) }}>
                                            <IconPrinter size={14} /> Pay Slip
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {entries.length === 0 && (
                                <tr><td colSpan={18} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>No active employees found.</td></tr>
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

            <AnimatePresence>
                {payslipEntry && (
                    <PaySlipModal
                        entry={payslipEntry}
                        month={month}
                        totalDays={totalDays}
                        onClose={() => setPayslipEntry(null)}
                    />
                )}
            </AnimatePresence>

            {/* Excel/Sheets-style grid borders, scoped to this table only — the shared
                .table class elsewhere in the app keeps its row-only borders. SL and Employee
                stay pinned to the left edge while the rest of the (wide) table scrolls, so
                the row's owner is always visible. */}
            <style jsx>{`
                .payroll-grid-table {
                    border-collapse: collapse;
                }
                .payroll-grid-table th,
                .payroll-grid-table td {
                    border: 1px solid var(--color-border-light);
                }
                .payroll-grid-table .sticky-col-1,
                .payroll-grid-table .sticky-col-2 {
                    position: sticky;
                    background: var(--color-surface);
                    z-index: 1;
                }
                .payroll-grid-table .sticky-col-1 {
                    left: 0;
                    width: 48px;
                }
                .payroll-grid-table .sticky-col-2 {
                    left: 48px;
                    box-shadow: 2px 0 4px -2px rgba(0, 0, 0, 0.15);
                }
                .payroll-grid-table thead .sticky-col-1,
                .payroll-grid-table thead .sticky-col-2 {
                    z-index: 2;
                }
                .payroll-grid-table tbody tr:hover .sticky-col-1,
                .payroll-grid-table tbody tr:hover .sticky-col-2 {
                    background: var(--color-surface-hover);
                }
                .payroll-grid-table .advance-cell {
                    position: relative;
                }
                .payroll-grid-table .advance-tooltip {
                    display: none;
                    position: absolute;
                    top: 100%;
                    left: 0;
                    z-index: 5;
                    margin-top: 4px;
                    padding: 8px 10px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: 8px;
                    box-shadow: var(--shadow-md);
                    font-size: 0.75rem;
                    font-weight: 500;
                    white-space: nowrap;
                    color: var(--color-text-secondary);
                }
                .payroll-grid-table .advance-cell:hover .advance-tooltip {
                    display: block;
                }
            `}</style>
        </div>
    )
}

function EditEntryModal({ entry, onClose, onSaved }: { entry: SalaryEntry; onClose: () => void; onSaved: (e: SalaryEntry) => void }) {
    const { success: toastSuccess, error: toastError } = useToast()
    // Held as raw strings while editing (same pattern as the Requisition quantity field) so
    // deleting the "0" to type a fresh number leaves the field genuinely empty instead of
    // snapping back to "0" on every keystroke.
    const [amounts, setAmounts] = useState({
        basic_salary: String(entry.basic_salary),
        extra_duty: String(entry.extra_duty),
        transportation_bill: String(entry.transportation_bill),
        snacks_bill: String(entry.snacks_bill),
        loan: String(entry.loan),
        performance_bonus: String(entry.performance_bonus),
        festival_bonus: String(entry.festival_bonus),
        other_deduction: String(entry.other_deduction),
    })
    const [paymentStatus, setPaymentStatus] = useState(entry.payment_status)
    const [paymentMethod, setPaymentMethod] = useState(entry.payment_method || '')
    const [paymentDate, setPaymentDate] = useState(entry.payment_date || '')
    const [saving, setSaving] = useState(false)

    const numAmounts = {
        basic_salary: Math.max(0, Number(amounts.basic_salary) || 0),
        extra_duty: Math.max(0, Number(amounts.extra_duty) || 0),
        transportation_bill: Math.max(0, Number(amounts.transportation_bill) || 0),
        snacks_bill: Math.max(0, Number(amounts.snacks_bill) || 0),
        loan: Math.max(0, Number(amounts.loan) || 0),
        performance_bonus: Math.max(0, Number(amounts.performance_bonus) || 0),
        festival_bonus: Math.max(0, Number(amounts.festival_bonus) || 0),
        other_deduction: Math.max(0, Number(amounts.other_deduction) || 0),
    }

    const netPayable = numAmounts.basic_salary + numAmounts.extra_duty + numAmounts.transportation_bill + numAmounts.snacks_bill
        + numAmounts.performance_bonus + numAmounts.festival_bonus - entry.fine - entry.advance - numAmounts.loan - numAmounts.other_deduction

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/payroll/salary-entries', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: entry.id,
                    ...numAmounts,
                    payment_status: paymentStatus,
                    payment_method: paymentMethod || null,
                    payment_date: paymentDate || null,
                }),
            })
            if (res.ok) {
                onSaved({
                    ...entry, ...numAmounts, payment_status: paymentStatus,
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
                        <ReadOnlyField label="Advance" value={`৳${entry.advance.toLocaleString()}${entry.advance_records.length > 1 ? ` (${entry.advance_records.length} records)` : ''}`} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {EDITABLE_AMOUNT_FIELDS.map(f => (
                            <div key={f.key}>
                                <label className="form-label">{f.label}</label>
                                <input className="form-input" type="number" min={0} value={amounts[f.key]}
                                    onFocus={e => e.target.select()}
                                    onChange={e => setAmounts(prev => ({ ...prev, [f.key]: e.target.value }))} />
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
