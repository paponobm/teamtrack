'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { motion } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { IconX, IconEdit, IconCheckCircle, IconCalendar, IconAlertCircle, IconClock, IconTrendingUp } from '@/components/icons/Icons'

interface DayRecord {
    id: string
    date: string
    clock_in: string | null
    clock_out: string | null
    status: string
    notes: string | null
    breakMs: number
}

interface BreakEntry {
    id: string
    start_time: string
    end_time: string | null
}

interface Props {
    employeeId: string
    employeeName: string
    month: string // 'YYYY-MM'
    monthStart: string // 'YYYY-MM-DD'
    monthEnd: string // 'YYYY-MM-DD'
    onClose: () => void
}

const statusConfig: Record<string, { label: string; color: string }> = {
    present: { label: 'Present', color: '#16A34A' },
    late: { label: 'Late', color: '#F59E0B' },
    absent: { label: 'Absent', color: '#DC2626' },
    half_day: { label: 'Half Day', color: '#3B82F6' },
    leave: { label: 'On Leave', color: '#7C3AED' },
    on_duty: { label: 'On Duty', color: '#0891B2' },
}

function formatTime(ts: string | null) {
    if (!ts) return '-'
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDuration(ms: number) {
    if (!ms || ms <= 0) return '-'
    const hrs = Math.floor(ms / 3600000)
    const mins = Math.floor((ms % 3600000) / 60000)
    return `${hrs}h ${mins}m`
}

// Duration here is Clock Out - Clock In only, matching the Daily Attendance tab's own
// "Duration" column exactly (see getDuration in src/app/(dashboard)/attendance/page.tsx) —
// it deliberately does NOT subtract Break Time, which has its own separate column instead.
function getGrossDuration(clockIn: string | null, clockOut: string | null) {
    if (!clockIn || !clockOut) return '-'
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    if (diff <= 0) return '-'
    const hrs = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    return `${hrs}h ${mins}m`
}

function formatDateLabel(dateStr: string) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })
}

// Same "Xh Ym" shape as formatDuration above, but for a summed total rather than a single row —
// shows "0h 0m" instead of "-" when the sum is zero, since a zero total is a real answer here
// (e.g. no break time taken all month), not a missing value.
function formatTotalDuration(ms: number) {
    const safeMs = Math.max(0, ms)
    const hrs = Math.floor(safeMs / 3600000)
    const mins = Math.floor((safeMs % 3600000) / 60000)
    return `${hrs}h ${mins}m`
}

// Same icon-badge treatment (36px rounded square, 15%-tint background) as the main Attendance
// page's own stat cards (see the clickable stat-card grid in src/app/(dashboard)/attendance/
// page.tsx) — reused here so this modal's summary reads as the same visual language, not a
// one-off design.
function SummaryStat({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
            background: 'var(--color-surface)', border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)', flex: '1 1 170px', minWidth: '170px',
        }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
                {icon}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>{value}</div>
            </div>
        </div>
    )
}

// For populating <input type="time"> from a stored break start/end timestamp — same helper
// Daily Attendance's own edit modal uses (src/app/(dashboard)/attendance/page.tsx).
function toTimeInput(ts: string | null) {
    if (!ts) return ''
    return new Date(ts).toTimeString().slice(0, 5)
}

// Full-month, per-day attendance detail for one employee — opened from a row in the (monthly,
// per-employee) Attendance Report tab, since that report only shows totals, not individual days.
// Reuses the existing legacy per-record shape of GET /api/attendance/report (group_by=employee
// is a separate branch of the same endpoint, added for the report's own summary rows — this
// modal is the first caller of the older per-record shape since that redesign, not a new route).
// Editing reuses PATCH /api/attendance/[id] and the /api/attendance/[id]/breaks(/[breakId])
// endpoints, the same ones the Daily Attendance tab's own edit modal calls — that existing
// modal is left untouched; this is its own focused editor scoped to this per-employee view.
export default function EmployeeMonthDetailModal({ employeeId, employeeName, month, monthStart, monthEnd, onClose }: Props) {
    const { data: perms } = usePermissions()
    const isAdmin = !!(perms.is_super || perms.is_admin)
    const toast = useToast()

    const [records, setRecords] = useState<DayRecord[]>([])
    // This employee's own configured Monthly Leave Allowance (Members → Edit Member → Duty
    // Schedule) — same figure Payroll's Leave Surplus Bonus is computed against. Read off any
    // returned row's employee object (same employee on every row, since employee_id is filtered
    // server-side) rather than a separate request.
    const [monthlyLeaveAllowance, setMonthlyLeaveAllowance] = useState(0)
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ status: '', clock_in: '', clock_out: '', notes: '' })
    const [saving, setSaving] = useState(false)

    // Break Time management for whichever row is currently being edited — fetched fresh each
    // time editing starts, same "per-record, on demand" pattern Daily Attendance's edit modal uses.
    const [editBreaks, setEditBreaks] = useState<BreakEntry[]>([])
    const [breaksLoading, setBreaksLoading] = useState(false)
    const [addingBreak, setAddingBreak] = useState(false)

    const fetchMonth = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                start_date: monthStart, end_date: monthEnd, employee_id: employeeId, limit: '31',
            })
            const res = await fetch(`/api/attendance/report?${params}`)
            const data = await res.json()
            if (Array.isArray(data.entries)) {
                setRecords(data.entries.map((e: { id: string; date: string; clock_in: string | null; clock_out: string | null; status: string; notes: string | null; breakMs: number }) => ({
                    id: e.id, date: e.date, clock_in: e.clock_in, clock_out: e.clock_out,
                    status: e.status, notes: e.notes, breakMs: e.breakMs,
                })).sort((a: DayRecord, b: DayRecord) => a.date.localeCompare(b.date)))
                setMonthlyLeaveAllowance(Number(data.entries[0]?.employee?.monthly_leave_allowance) || 0)
            }
        } catch {
            toast.error('Failed to load attendance')
        } finally {
            setLoading(false)
        }
    }, [employeeId, monthStart, monthEnd, toast])

    useEffect(() => { fetchMonth() }, [fetchMonth])

    const startEdit = (r: DayRecord) => {
        setEditingId(r.id)
        setEditForm({
            status: r.status,
            clock_in: r.clock_in ? new Date(r.clock_in).toTimeString().slice(0, 5) : '',
            clock_out: r.clock_out ? new Date(r.clock_out).toTimeString().slice(0, 5) : '',
            notes: r.notes || '',
        })
        setEditBreaks([])
        setBreaksLoading(true)
        fetch(`/api/attendance/${r.id}/breaks`)
            .then(res => res.json())
            .then(d => { if (Array.isArray(d)) setEditBreaks(d) })
            .catch(() => { })
            .finally(() => setBreaksLoading(false))
    }

    const handleSave = async (record: DayRecord) => {
        setSaving(true)
        try {
            const updates: Record<string, unknown> = { status: editForm.status, notes: editForm.notes || null }
            updates.clock_in = editForm.clock_in ? `${record.date}T${editForm.clock_in}:00+06:00` : null
            updates.clock_out = editForm.clock_out ? `${record.date}T${editForm.clock_out}:00+06:00` : null

            const res = await fetch(`/api/attendance/${record.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to update')
                return
            }
            toast.success('Attendance updated')
            setEditingId(null)
            fetchMonth()
        } finally {
            setSaving(false)
        }
    }

    const handleAddBreak = async (attendanceId: string) => {
        setAddingBreak(true)
        try {
            const res = await fetch(`/api/attendance/${attendanceId}/breaks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_time: new Date().toISOString() }),
            })
            if (res.ok) {
                const newBreak = await res.json()
                setEditBreaks(prev => [...prev, newBreak])
            } else {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to add break')
            }
        } finally {
            setAddingBreak(false)
        }
    }

    const handleUpdateBreak = async (attendanceId: string, breakId: string, date: string, field: 'start_time' | 'end_time', timeValue: string) => {
        const iso = timeValue ? `${date}T${timeValue}:00+06:00` : null
        const res = await fetch(`/api/attendance/${attendanceId}/breaks/${breakId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: iso }),
        })
        if (res.ok) {
            const updated = await res.json()
            setEditBreaks(prev => prev.map(b => b.id === breakId ? updated : b))
        } else {
            const e = await res.json().catch(() => ({}))
            toast.error(e.error || 'Failed to update break')
        }
    }

    const handleDeleteBreak = async (attendanceId: string, breakId: string) => {
        const res = await fetch(`/api/attendance/${attendanceId}/breaks/${breakId}`, { method: 'DELETE' })
        if (res.ok) {
            setEditBreaks(prev => prev.filter(b => b.id !== breakId))
        } else {
            const e = await res.json().catch(() => ({}))
            toast.error(e.error || 'Failed to delete break')
        }
    }

    const closeEdit = () => {
        setEditingId(null)
        // Break add/edit/delete above save immediately (no separate "Save" step, matching Daily
        // Attendance's own break management) — refresh so Break Time / Duration reflect them.
        fetchMonth()
    }

    // Month-at-a-glance totals shown above the per-day table — "late" counts toward "present" too
    // (they showed up for the day), same convention the Daily Attendance/Attendance Report stat
    // cards already use elsewhere in this app. Working hours is net (gross Clock Out − Clock In,
    // minus Break Time), unlike the table's own "Duration" column which is deliberately gross —
    // a month total should reflect actual hours worked, not include break time in it.
    const summary = useMemo(() => {
        let present = 0, leave = 0, absence = 0, late = 0, workingMs = 0, breakMs = 0
        for (const r of records) {
            if (r.status === 'present' || r.status === 'late') present++
            if (r.status === 'leave') leave++
            if (r.status === 'absent') absence++
            if (r.status === 'late') late++
            breakMs += r.breakMs || 0
            if (r.clock_in && r.clock_out) {
                const gross = new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()
                if (gross > 0) workingMs += Math.max(0, gross - (r.breakMs || 0))
            }
        }
        // Same "unused leave" surplus Payroll's Leave Surplus Bonus already pays out for (see
        // computeLeaveSurplusBonus in src/lib/payroll.ts) — days of this employee's Monthly
        // Leave Allowance they didn't end up using, shown here as Extra Duty days. Clamped to 0
        // rather than going negative once Leave + Absence exceeds the allowance.
        const extraDuty = Math.max(0, monthlyLeaveAllowance - (leave + absence))
        return { present, leave, absence, late, workingMs, breakMs, extraDuty }
    }, [records, monthlyLeaveAllowance])

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ zIndex: 1100 }}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                onClick={e => e.stopPropagation()} style={{ maxWidth: '1120px', width: '95vw', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2 className="modal-title">{employeeName} — {month}</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={18} /></button>
                </div>
                {!loading && records.length > 0 && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '16px 24px', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-bg-secondary)', flexShrink: 0 }}>
                        <SummaryStat label="Present" value={summary.present} color="#16A34A" icon={<IconCheckCircle size={18} />} />
                        <SummaryStat label="Leave" value={summary.leave} color="#7C3AED" icon={<IconCalendar size={18} />} />
                        <SummaryStat label="Absence" value={summary.absence} color="#DC2626" icon={<IconCalendar size={18} />} />
                        <SummaryStat label="Late" value={summary.late} color="#F59E0B" icon={<IconAlertCircle size={18} />} />
                        <SummaryStat label="Extra Duty" value={summary.extraDuty} color="#0891B2" icon={<IconTrendingUp size={18} />} />
                        <SummaryStat label="Working Hours" value={formatTotalDuration(summary.workingMs)} color="#2563EB" icon={<IconClock size={18} />} />
                        <SummaryStat label="Break Hours" value={formatTotalDuration(summary.breakMs)} color="#7C3AED" icon={<IconClock size={18} />} />
                    </div>
                )}
                <div className="modal-body employee-month-detail-body" style={{ overflow: 'auto', padding: 0 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}><span className="spinner" style={{ margin: '0 auto', display: 'block', width: '24px', height: '24px' }} /></div>
                    ) : records.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No attendance records for this month</div>
                    ) : (
                        <table className="table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Clock In</th>
                                    <th>Clock Out</th>
                                    <th>Duration</th>
                                    <th>Break Time</th>
                                    <th>Notes</th>
                                    {isAdmin && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {records.map(r => {
                                    const sc = statusConfig[r.status] || statusConfig.present
                                    const isEditing = editingId === r.id
                                    return (
                                        <Fragment key={r.id}>
                                            <tr>
                                                <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDateLabel(r.date)}</td>
                                                {isEditing ? (
                                                    <>
                                                        <td>
                                                            <select className="input" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                                                value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                                                <option value="present">Present</option>
                                                                <option value="late">Late</option>
                                                                <option value="absent">Absent</option>
                                                                <option value="half_day">Half Day</option>
                                                                <option value="leave">On Leave</option>
                                                                <option value="on_duty">On Duty</option>
                                                            </select>
                                                        </td>
                                                        <td><input type="time" className="input" style={{ padding: '4px 8px', fontSize: '0.75rem' }} value={editForm.clock_in} onChange={e => setEditForm({ ...editForm, clock_in: e.target.value })} /></td>
                                                        <td><input type="time" className="input" style={{ padding: '4px 8px', fontSize: '0.75rem' }} value={editForm.clock_out} onChange={e => setEditForm({ ...editForm, clock_out: e.target.value })} /></td>
                                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>-</td>
                                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{formatDuration(r.breakMs)}</td>
                                                        <td><input type="text" className="input" style={{ padding: '4px 8px', fontSize: '0.75rem', width: '100%' }} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></td>
                                                        <td style={{ whiteSpace: 'nowrap' }}>
                                                            <button className="btn btn-primary btn-sm" style={{ padding: '3px 8px', fontSize: '0.6875rem', marginRight: '4px' }} disabled={saving} onClick={() => handleSave(r)}>
                                                                {saving ? '...' : 'Save'}
                                                            </button>
                                                            <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '0.6875rem' }} onClick={closeEdit}>Close</button>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td>
                                                            <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: `${sc.color}15` }}>{sc.label}</span>
                                                        </td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{formatTime(r.clock_in)}</td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{formatTime(r.clock_out)}</td>
                                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{getGrossDuration(r.clock_in, r.clock_out)}</td>
                                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDuration(r.breakMs)}</td>
                                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', maxWidth: '150px' }}>
                                                            <span className="truncate" style={{ display: 'block' }}>{r.notes || '-'}</span>
                                                        </td>
                                                        {isAdmin && (
                                                            <td>
                                                                <button className="btn btn-ghost btn-sm" title="Edit record" style={{ padding: '3px 8px' }} onClick={() => startEdit(r)}>
                                                                    <IconEdit size={14} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </>
                                                )}
                                            </tr>
                                            {isEditing && (
                                                <tr>
                                                    <td colSpan={isAdmin ? 8 : 7} style={{ background: 'var(--color-bg-secondary)', padding: '12px 16px' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Break Time</div>
                                                        {breaksLoading ? (
                                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>Loading...</div>
                                                        ) : (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {editBreaks.map((b, i) => (
                                                                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', width: '52px', flexShrink: 0 }}>Break {i + 1}</span>
                                                                        <input type="time" className="input" style={{ padding: '4px 8px', fontSize: '0.75rem', width: '130px' }}
                                                                            value={toTimeInput(b.start_time)}
                                                                            onChange={e => handleUpdateBreak(r.id, b.id, r.date, 'start_time', e.target.value)} />
                                                                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>to</span>
                                                                        <input type="time" className="input" style={{ padding: '4px 8px', fontSize: '0.75rem', width: '130px' }}
                                                                            value={toTimeInput(b.end_time)}
                                                                            onChange={e => handleUpdateBreak(r.id, b.id, r.date, 'end_time', e.target.value)} />
                                                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteBreak(r.id, b.id)} title="Remove break" style={{ color: '#DC2626', padding: '4px 6px' }}>✕</button>
                                                                    </div>
                                                                ))}
                                                                {editBreaks.length === 0 && (
                                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>No breaks recorded</div>
                                                                )}
                                                                <button className="btn btn-secondary btn-sm" onClick={() => handleAddBreak(r.id)} disabled={addingBreak} style={{ alignSelf: 'flex-start' }}>
                                                                    {addingBreak ? 'Adding...' : '+ Add Break'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </motion.div>
            {/* Table header stays visible while the rows beneath it scroll — the summary cards
                above are already outside this scrolling body, so they stay fixed too. */}
            <style jsx>{`
                .employee-month-detail-body thead th {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    background: var(--color-bg-secondary);
                }
            `}</style>
        </motion.div>
    )
}
