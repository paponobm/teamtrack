'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { getLocalDateString } from '@/lib/dateRange'
import {
    IconUsers, IconPlus, IconX, IconBanknote, IconCheckCircle, IconClock, IconTrendingUp,
    IconSearch, IconEdit, IconTrash, IconChevronLeft, IconChevronRight,
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
    paid_months: string[]
}

interface EmployeeOption {
    id: string
    name: string
    employee_id: string | null
    avatar_url: string | null
}

// Extendable on purpose — the API doesn't restrict duration_months to this list, so a new
// option can be added here alone whenever a longer/shorter term is needed.
const DURATION_OPTIONS = [6, 12] as const

// Security Insurance interest is a fixed company policy, not something set per record — always
// 100%, never user-editable. Kept as a named constant (rather than inlining the literal) since
// it's used both for the payload sent to the API and the maturity-amount math below.
const PROVIDENT_FUND_INTEREST_RATE = 100

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || 'U').charCodeAt(0) % colors.length]
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function currentMonthString(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKeyToIndex(month: string): number {
    const [y, m] = month.split('-').map(Number)
    return y * 12 + (m - 1)
}

// A fund "needs" an installment in a given month when that month falls anywhere inside its
// start_date → start_date+duration window — regardless of whether that installment has
// actually been paid yet (Paid/Due is still tracked cumulatively, see getProvidentFundPaidSummaries).
function fundCoversMonth(f: { start_date: string; duration_months: number }, monthIndex: number): boolean {
    const startIndex = monthKeyToIndex(f.start_date.slice(0, 7))
    return monthIndex >= startIndex && monthIndex < startIndex + f.duration_months
}

// start_date + duration, minus a day — the last day the fund's term actually covers (not the
// first day of the month after it ends).
function endDateOf(startDate: string, durationMonths: number): string {
    const [y, m, d] = startDate.slice(0, 10).split('-').map(Number)
    const full = new Date(y, m - 1 + durationMonths, d)
    full.setDate(full.getDate() - 1)
    return getLocalDateString(full)
}

function formatMonthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Security Insurance (displayed name; internally still "Provident Fund" throughout the code —
// component/table/column names, etc. — only the user-facing label changed), embedded as a
// Finance Hub tab alongside Salary Advance & EMI. Architecturally identical to EMI
// (src/lib/providentFunds.ts) — flat interest over a fixed duration, feeding the Salary Sheet's
// Provident Fund deduction live. No linked Expense record (it's a payroll
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
    // Every record is fetched once (no date filter — see fetchFunds); which rows the table
    // shows is purely a client-side slice by "does this fund's term cover this month"
    // (fundCoversMonth), not by when the fund started.
    const [selectedMonth, setSelectedMonth] = useState(() => currentMonthString())
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<ProvidentFund | null>(null)
    const [zoomedAvatar, setZoomedAvatar] = useState<{ url: string; name: string } | null>(null)

    const fetchFunds = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/provident-funds')
            if (res.ok) {
                const json = await res.json()
                setFunds(json.provident_funds || [])
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchFunds() }, [fetchFunds])

    useEffect(() => {
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) })
    }, [])

    const matchesSearch = useCallback((f: ProvidentFund) => {
        if (employeeFilter && f.employee_id !== employeeFilter) return false
        if (!search) return true
        const q = search.toLowerCase()
        return (f.employee?.name || '').toLowerCase().includes(q) || (f.employee?.employee_id || '').toLowerCase().includes(q)
    }, [employeeFilter, search])

    const monthIndex = monthKeyToIndex(selectedMonth)

    // The table — only the employees who actually need a Security Insurance installment in
    // the selected month.
    const filtered = funds.filter(f => matchesSearch(f) && fundCoversMonth(f, monthIndex))

    // Computed from the same filtered set the table shows, so Total Paid/Total Due/Total
    // Employees always match whichever month + employee/search filter is active.
    // Total Paid/Total Due are scoped to the selected month's own installment specifically
    // (via paid_months), not the fund's lifetime-cumulative paid/due — otherwise every month a
    // record is active in would show the exact same lifetime figures regardless of which
    // month was actually paid.
    const summary = filtered.reduce((acc, f) => {
        const paidThisMonth = f.paid_months.includes(selectedMonth)
        if (paidThisMonth) {
            acc.totalPaid += f.monthly_installment
            acc.paidEmployeeIds.add(f.employee_id)
        } else {
            acc.totalDue += f.monthly_installment
            acc.dueEmployeeIds.add(f.employee_id)
        }
        acc.employeeIds.add(f.employee_id)
        return acc
    }, { totalPaid: 0, totalDue: 0, employeeIds: new Set<string>(), paidEmployeeIds: new Set<string>(), dueEmployeeIds: new Set<string>() })

    // Total Security Insurance is the one lifetime figure on this page — total collected
    // across every record (still honoring the employee/search filter), not just the ones due
    // in the selected month — so it doesn't reset to a smaller number every time you browse to
    // a different month.
    const totalCollected = funds.filter(matchesSearch).reduce((sum, f) => sum + f.paid, 0)

    // How many records use each interest rate — e.g. "10% — 2, 8% — 1" — so a mix of rates
    // across employees is visible at a glance instead of collapsing to a single misleading number.
    const interestRateBreakdown = Object.entries(
        filtered.reduce((acc, f) => {
            acc[f.interest_rate] = (acc[f.interest_rate] || 0) + 1
            return acc
        }, {} as Record<number, number>)
    ).sort((a, b) => Number(b[0]) - Number(a[0]))

    const handleDelete = async (f: ProvidentFund) => {
        if (!confirm(`Delete this Security Insurance record for ${f.employee?.name || 'this employee'}? This also removes its remaining Salary Sheet deductions.`)) return
        const res = await fetch(`/api/provident-funds/${f.id}`, { method: 'DELETE' })
        if (res.ok) {
            setFunds(prev => prev.filter(x => x.id !== f.id))
            toastSuccess('Security Insurance record deleted')
        } else {
            const err = await res.json()
            toastError(err.error || 'Failed to delete')
        }
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Security Insurance</h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>Manage employee security insurance contributions, installments, and returns.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
                    <IconPlus size={16} /> Add Security Insurance
                </button>
            </div>

            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconBanknote size={14} color="var(--color-text-tertiary)" /> Total Security Insurance</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>৳{totalCollected.toLocaleString()}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Paid in so far, across every record</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconUsers size={14} color="var(--color-text-tertiary)" /> Total Employees</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{summary.employeeIds.size}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Due an installment in {formatMonthLabel(selectedMonth)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="var(--color-text-tertiary)" /> Total Paid</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>৳{summary.totalPaid.toLocaleString()}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{summary.paidEmployeeIds.size} employee{summary.paidEmployeeIds.size === 1 ? '' : 's'}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="var(--color-text-tertiary)" /> Total Due</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>৳{summary.totalDue.toLocaleString()}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{summary.dueEmployeeIds.size} employee{summary.dueEmployeeIds.size === 1 ? '' : 's'}</span>
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
                {/* Only a month view is needed — this table is always "who owes a Security
                    Insurance installment this month", so Today/Week/Custom/All were dropped. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => {
                        const [y, m] = selectedMonth.split('-').map(Number)
                        const d = new Date(y, m - 2, 1)
                        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                    }} style={{ borderRadius: '8px' }}>
                        <IconChevronLeft size={16} />
                    </button>
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input"
                        style={{ border: 'none', background: 'transparent', padding: '0 4px', fontSize: '0.8125rem', width: '150px', textAlign: 'center' }} />
                    <button className="btn btn-ghost btn-icon" onClick={() => {
                        const [y, m] = selectedMonth.split('-').map(Number)
                        const d = new Date(y, m, 1)
                        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                    }} style={{ borderRadius: '8px' }}>
                        <IconChevronRight size={16} />
                    </button>
                </div>
            </motion.div>

            <motion.div variants={item} initial="hidden" animate="show" className="card" style={{ overflowX: 'auto', padding: 0 }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>SL</th>
                            <th>Employee</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Insurance Amount</th>
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
                                        <div className="avatar avatar-sm" style={{ background: getAvatarColor(f.employee?.name || 'U'), overflow: 'hidden', flexShrink: 0, width: 28, height: 28, fontSize: '0.75rem', cursor: f.employee?.avatar_url ? 'zoom-in' : undefined }}
                                            onClick={() => { if (f.employee?.avatar_url) setZoomedAvatar({ url: f.employee.avatar_url, name: f.employee.name }) }}>
                                            {f.employee?.avatar_url ? (
                                                <img src={f.employee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (f.employee?.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{f.employee?.name || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{f.employee?.employee_id || '—'}</div>
                                            {f.employee?.department?.name && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{f.employee.department.name}</div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td>{formatDate(f.start_date)}</td>
                                <td>{formatDate(endDateOf(f.start_date, f.duration_months))}</td>
                                <td>
                                    <div style={{ fontWeight: 700 }}>৳{f.principal_amount.toLocaleString()}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>{f.duration_months} Months</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>{f.interest_rate}% interest</div>
                                </td>
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
                                <td style={{ fontWeight: 700, color: '#16A34A' }}>৳{f.paid.toLocaleString()}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => { setEditing(f); setShowModal(true) }} title="Edit"><IconEdit size={15} /></button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(f)} title="Delete" style={{ color: '#DC2626' }}><IconTrash size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>No one needs a Security Insurance installment in {formatMonthLabel(selectedMonth)}.</td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>Loading...</td></tr>
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

            <AnimatePresence>
                {zoomedAvatar && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoomedAvatar(null)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                            <img src={zoomedAvatar.url} alt={zoomedAvatar.name}
                                style={{ display: 'block', maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }} />
                            <button onClick={() => setZoomedAvatar(null)} title="Close"
                                style={{ position: 'absolute', top: '-14px', right: '-14px', width: '32px', height: '32px', borderRadius: '50%', background: '#111827', border: '2px solid #fff', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <IconX size={16} />
                            </button>
                        </motion.div>
                    </motion.div>
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
    // The form field is what the admin actually knows and types: the amount deducted from
    // salary each month (e.g. ৳1,000/month), not the total. Seeded from the record's own
    // monthly_installment when editing (already the exact per-month figure — see
    // src/lib/providentFunds.ts) rather than back-deriving it from principal_amount, which
    // avoids reintroducing rounding drift. principalAmount (the total contributed over the
    // whole duration — e.g. ৳1,000 × 12 = ৳12,000) is derived from it below, never typed in
    // directly, and is what's actually sent to the API as principal_amount.
    // Held as a raw string while editing (same pattern as the Salary Sheet's Edit Entry amount
    // fields) rather than a number — a plain number-bound input leaves a stuck leading zero when
    // the field already shows "0" and the user types into it without the whole thing getting
    // replaced first (e.g. "0" + "1" typed in sequence becomes the literal text "01" instead of
    // "1") — onChange below strips any such leading zero immediately as it's typed.
    const [monthlyAmount, setMonthlyAmount] = useState(String(fund?.monthly_installment ?? 0))
    const [durationMonths, setDurationMonths] = useState<number>(fund?.duration_months || 12)
    const interestRate = PROVIDENT_FUND_INTEREST_RATE
    const [startDate, setStartDate] = useState(fund?.start_date || getLocalDateString())
    const [note, setNote] = useState(fund?.note || '')
    const [saving, setSaving] = useState(false)

    const isEdit = !!fund
    const monthlyAmountNum = Math.max(0, Number(monthlyAmount) || 0)

    // Unlike EMI, the employee only ever pays back their own principal — the monthly
    // deduction (and Paid/Due) is principal ÷ duration, never inflated by interest (see
    // src/lib/providentFunds.ts computeMonthlyInstallment) — so principalAmount here is just
    // monthlyAmountNum × durationMonths, the exact inverse of that same division. Total Amount is
    // a separate, informational figure: the principal plus a single flat interest add-on at the
    // fund's (fixed, 100%) rate — mirrors src/lib/providentFunds.ts computeMaturityAmount
    // exactly; duplicated here rather than imported since that module pulls in the server-only
    // admin Supabase client — what the employee receives back from the company at maturity. It
    // has no bearing on what's deducted or on Due.
    const principalAmount = monthlyAmountNum * durationMonths
    const totalPayable = principalAmount
    const monthlyInstallment = monthlyAmountNum
    const totalAmount = principalAmount * (1 + interestRate / 100)

    const handleSave = async () => {
        if (!employeeId) { toastError('Please select an employee'); return }
        if (!Number.isFinite(monthlyAmountNum) || monthlyAmountNum <= 0) { toastError('Security Insurance Amount must be greater than 0'); return }

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
                    toastSuccess('Security Insurance updated')
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
                    toastSuccess('Security Insurance added')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to add Security Insurance')
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
                    <div className="modal-title">{isEdit ? 'Edit Security Insurance' : 'Add Security Insurance'}</div>
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
                        <label className="form-label">Security Insurance Amount (৳ / month) *</label>
                        <input className="form-input" type="number" min={1} value={monthlyAmount}
                            onFocus={e => e.target.select()}
                            onChange={e => setMonthlyAmount(e.target.value.replace(/^0+(?=\d)/, ''))} />
                    </div>

                    <div>
                        <label className="form-label">Duration *</label>
                        <select className="form-input" value={durationMonths} onChange={e => setDurationMonths(Number(e.target.value))}>
                            {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} Months</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="form-label">Start Date *</label>
                        <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>

                    <div>
                        <label className="form-label">Note</label>
                        <textarea className="form-input" rows={3} placeholder="Security insurance note..." value={note} onChange={e => setNote(e.target.value)} />
                    </div>

                    {principalAmount > 0 && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', background: 'rgba(37,99,235,0.08)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>Principal Amount ({durationMonths} × ৳{monthlyAmountNum.toLocaleString()}): <strong style={{ color: 'var(--color-text-primary)' }}>৳{principalAmount.toLocaleString()}</strong></div>
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
