'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { getLocalDateString, getWeekRange, getMonthRange } from '@/lib/dateRange'
import { IconChevronLeft, IconChevronRight } from '@/components/icons/Icons'

type DateRangeMode = 'today' | 'week' | 'month' | 'custom'

interface TaskEntry {
    id: string
    title: string
    task_no: string | null
    status: string
    priority: string
    due_date: string | null
    description: string | null
    items: { text: string; points: number | null }[]
    totalPoints: number
}

interface WorkReportEntry {
    id: string
    date: string
    project: string
    description: string | null
    hours: number
    progress: number
    status: string
    attachment_url: string | null
    notes: string | null
    created_at: string
    existingPoints: number | null
}

interface EvaluationHistoryRow {
    id: string
    period_start: string
    period_end: string
    total_assigned_points: number
    total_earned_points: number
    note: string | null
    evaluated_at: string
    evaluator: { id: string; name: string } | null
}

const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const priorityConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: '#DC2626' },
    high: { label: 'High', color: '#F59E0B' },
    medium: { label: 'Medium', color: '#3B82F6' },
    low: { label: 'Low', color: '#6B7280' },
}

const taskStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    completed: { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
    cancelled: { label: 'Cancelled', color: '#6B7280', bg: 'rgba(107,114,128,0.08)' },
    rejected: { label: 'Rejected', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
}

const reportStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: 'Completed', color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
    in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
}

function formatSubmittedAt(ts: string) {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function WorkComparison() {
    const toast = useToast()

    const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('today')
    const [refDate, setRefDate] = useState(() => getLocalDateString())
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [appliedCustomStart, setAppliedCustomStart] = useState('')
    const [appliedCustomEnd, setAppliedCustomEnd] = useState('')

    const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

    const [tasks, setTasks] = useState<TaskEntry[]>([])
    const [totalAssignedPoints, setTotalAssignedPoints] = useState(0)
    const [workReports, setWorkReports] = useState<WorkReportEntry[]>([])
    const [scores, setScores] = useState<Record<string, string>>({})
    const [note, setNote] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const [history, setHistory] = useState<EvaluationHistoryRow[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    const range = dateRangeMode === 'today' ? { start: refDate, end: refDate }
        : dateRangeMode === 'week' ? getWeekRange(new Date(`${refDate}T00:00:00`))
        : dateRangeMode === 'month' ? getMonthRange(new Date(`${refDate}T00:00:00`))
        : { start: appliedCustomStart, end: appliedCustomEnd }

    const rangeReady = dateRangeMode !== 'custom' || !!(appliedCustomStart && appliedCustomEnd)

    useEffect(() => {
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) }).catch(() => { })
    }, [])

    const fetchComparison = useCallback(async () => {
        if (!selectedEmployeeId || !rangeReady) return
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            params.set('employee_id', selectedEmployeeId)
            params.set('start_date', range.start)
            params.set('end_date', range.end)
            const res = await fetch(`/api/work-comparison?${params}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to load comparison data')
            setTasks(data.tasks || [])
            setTotalAssignedPoints(data.totalAssignedPoints || 0)
            setWorkReports(data.workReports || [])
            const initialScores: Record<string, string> = {}
            ;(data.workReports || []).forEach((r: WorkReportEntry) => {
                initialScores[r.id] = r.existingPoints !== null ? String(r.existingPoints) : ''
            })
            setScores(initialScores)
            setNote('')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load comparison data')
            setTasks([])
            setWorkReports([])
        } finally {
            setLoading(false)
        }
    }, [selectedEmployeeId, rangeReady, range.start, range.end])

    useEffect(() => { fetchComparison() }, [fetchComparison])

    const fetchHistory = useCallback(async () => {
        if (!selectedEmployeeId) { setHistory([]); return }
        setHistoryLoading(true)
        try {
            const res = await fetch(`/api/work-comparison/evaluations?employee_id=${selectedEmployeeId}`)
            const data = await res.json()
            if (Array.isArray(data)) setHistory(data)
        } catch { /* ignore */ }
        finally { setHistoryLoading(false) }
    }, [selectedEmployeeId])

    useEffect(() => { fetchHistory() }, [fetchHistory])

    const changeRefDate = (deltaDays: number) => {
        const d = new Date(`${refDate}T00:00:00`)
        d.setDate(d.getDate() + deltaDays)
        setRefDate(getLocalDateString(d))
    }

    const totalEarnedPoints = Object.values(scores).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
    const performancePercent = totalAssignedPoints > 0 ? Math.round((totalEarnedPoints / totalAssignedPoints) * 100) : 0

    const handleSaveEvaluation = async () => {
        if (!selectedEmployeeId) return
        setSaving(true)
        try {
            const items = workReports
                .filter(r => (scores[r.id] || '').trim() !== '')
                .map(r => ({ work_report_id: r.id, points: parseInt(scores[r.id], 10) || 0 }))

            const res = await fetch('/api/work-comparison/evaluations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: selectedEmployeeId,
                    period_start: range.start,
                    period_end: range.end,
                    total_assigned_points: totalAssignedPoints,
                    note: note || null,
                    items,
                }),
            })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to save evaluation')
                return
            }
            toast.success('Evaluation saved and points awarded')
            fetchHistory()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            {/* Date Range + Employee */}
            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {([
                        { key: 'today', label: 'Daily' },
                        { key: 'week', label: 'Weekly' },
                        { key: 'month', label: 'Monthly' },
                        { key: 'custom', label: 'Custom' },
                    ] as const).map(tab => (
                        <button key={tab.key} onClick={() => setDateRangeMode(tab.key)}
                            style={{
                                position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                color: dateRangeMode === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                            }}>
                            {dateRangeMode === tab.key && (
                                <motion.div layoutId="comparisonRangeTab" style={{
                                    position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                    borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {dateRangeMode === 'today' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => changeRefDate(-1)} style={{ borderRadius: '8px' }}><IconChevronLeft size={16} /></button>
                        <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                        <button className="btn btn-ghost btn-icon" onClick={() => changeRefDate(1)} style={{ borderRadius: '8px' }}><IconChevronRight size={16} /></button>
                    </div>
                )}

                {(dateRangeMode === 'week' || dateRangeMode === 'month') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => changeRefDate(dateRangeMode === 'week' ? -7 : -30)} style={{ borderRadius: '8px' }}><IconChevronLeft size={16} /></button>
                        <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                        <button className="btn btn-ghost btn-icon" onClick={() => changeRefDate(dateRangeMode === 'week' ? 7 : 30)} style={{ borderRadius: '8px' }}><IconChevronRight size={16} /></button>
                    </div>
                )}

                {dateRangeMode === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input" style={{ padding: '6px 8px', fontSize: '0.8125rem', width: '150px', border: '1px solid var(--color-border-light)', borderRadius: '8px' }} />
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>to</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input" style={{ padding: '6px 8px', fontSize: '0.8125rem', width: '150px', border: '1px solid var(--color-border-light)', borderRadius: '8px' }} min={customStart} />
                        <button className="btn btn-primary btn-sm" disabled={!customStart || !customEnd}
                            onClick={() => { setAppliedCustomStart(customStart); setAppliedCustomEnd(customEnd) }}>
                            Search
                        </button>
                    </div>
                )}

                <select className="input" value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} style={{ width: '200px', padding: '8px 12px', fontSize: '0.8125rem', marginLeft: 'auto' }}>
                    <option value="">Select Employee...</option>
                    {employees.map(e => (<option key={e.id} value={e.id}>{e.name}</option>))}
                </select>
            </motion.div>

            {!selectedEmployeeId ? (
                <motion.div className="card" variants={item} initial="hidden" animate="show" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text-secondary)' }}>Select an employee</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Choose an employee and a period to compare their assigned tasks against their submitted work reports.</p>
                </motion.div>
            ) : error ? (
                <div className="card" style={{ padding: '16px 20px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: '0.875rem' }}>
                    {error}
                </div>
            ) : loading ? (
                <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading comparison...</div>
            ) : (
                <>
                    {/* Side-by-side comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        {/* Left: Assigned Tasks */}
                        <motion.div className="card" variants={item} initial="hidden" animate="show" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Assigned Tasks</h3>
                            {tasks.length === 0 ? (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', padding: '12px 0' }}>No tasks assigned in this period.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {tasks.map(t => {
                                        const sc = taskStatusConfig[t.status] || taskStatusConfig.pending
                                        const pc = priorityConfig[t.priority] || priorityConfig.medium
                                        return (
                                            <div key={t.id} style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.title}</span>
                                                    <span style={{ padding: '1px 7px', borderRadius: '6px', fontSize: '0.625rem', fontWeight: 600, color: sc.color, background: sc.bg }}>{sc.label}</span>
                                                    <span style={{ padding: '1px 7px', borderRadius: '6px', fontSize: '0.625rem', fontWeight: 600, color: pc.color, background: `${pc.color}15` }}>{pc.label}</span>
                                                </div>
                                                {t.due_date && (
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                                                        Due: {new Date(`${t.due_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </div>
                                                )}
                                                {t.items.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        {t.items.map((it, i) => (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                                                <span style={{ flex: 1 }}>• {it.text}</span>
                                                                {it.points !== null && (
                                                                    <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '0.6875rem', fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', flexShrink: 0 }}>{it.points} pts</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 700 }}>
                                <span>Total Assigned Points</span>
                                <span style={{ color: '#2563EB' }}>{totalAssignedPoints} pts</span>
                            </div>
                        </motion.div>

                        {/* Right: Daily Work Report */}
                        <motion.div className="card" variants={item} initial="hidden" animate="show" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Daily Work Report</h3>
                            {workReports.length === 0 ? (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', padding: '12px 0' }}>No work reports submitted in this period.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {workReports.map(r => {
                                        const sc = reportStatusConfig[r.status] || reportStatusConfig.pending
                                        return (
                                            <div key={r.id} style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{r.project}</span>
                                                    <span style={{ padding: '1px 7px', borderRadius: '6px', fontSize: '0.625rem', fontWeight: 600, color: sc.color, background: sc.bg, flexShrink: 0 }}>{sc.label}</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="input"
                                                        placeholder="pts"
                                                        value={scores[r.id] ?? ''}
                                                        onChange={e => setScores(prev => ({ ...prev, [r.id]: e.target.value }))}
                                                        style={{ width: '64px', flexShrink: 0, textAlign: 'center', padding: '4px 6px', fontSize: '0.8125rem' }}
                                                    />
                                                </div>
                                                {r.description && (
                                                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0 0 4px', whiteSpace: 'pre-line' }}>{r.description}</p>
                                                )}
                                                {r.attachment_url && (
                                                    <a href={r.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#2563EB', display: 'inline-block', marginBottom: '4px' }}>View Attachment</a>
                                                )}
                                                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
                                                    {r.hours}h · {r.progress}% · Submitted {formatSubmittedAt(r.created_at)}
                                                    {r.existingPoints !== null && ` · Previously scored: ${r.existingPoints} pts`}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 700 }}>
                                <span>Total Earned Points</span>
                                <span style={{ color: '#16A34A' }}>{totalEarnedPoints} pts</span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Evaluation */}
                    <motion.div className="card" variants={item} initial="hidden" animate="show" style={{ padding: '20px', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 14px' }}>Overall Evaluation</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
                            <div className="stat-card">
                                <span className="stat-label">Assigned</span>
                                <span className="stat-value">{totalAssignedPoints} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>pts</span></span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-label">Earned</span>
                                <span className="stat-value">{totalEarnedPoints} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>pts</span></span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-label">Performance</span>
                                <span className="stat-value">{performancePercent}%</span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Evaluation Note</label>
                            <textarea className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Good progress. API completed successfully. Dashboard needs improvement." rows={3} style={{ resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                            <button className="btn btn-primary" onClick={handleSaveEvaluation} disabled={saving || workReports.length === 0}>
                                {saving ? 'Saving...' : 'Save Evaluation'}
                            </button>
                        </div>
                    </motion.div>

                    {/* History */}
                    <motion.div variants={item} initial="hidden" animate="show">
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Evaluation History</h3>
                        {historyLoading ? (
                            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading history...</div>
                        ) : history.length === 0 ? (
                            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>No previous evaluations for this employee.</div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Evaluated By</th>
                                            <th>Assigned</th>
                                            <th>Earned</th>
                                            <th>Performance</th>
                                            <th>Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map(h => {
                                            const pct = h.total_assigned_points > 0 ? Math.round((h.total_earned_points / h.total_assigned_points) * 100) : 0
                                            return (
                                                <tr key={h.id}>
                                                    <td>{h.period_start === h.period_end ? h.period_start : `${h.period_start} → ${h.period_end}`}</td>
                                                    <td>{h.evaluator?.name || '-'}</td>
                                                    <td>{h.total_assigned_points} pts</td>
                                                    <td>{h.total_earned_points} pts</td>
                                                    <td>{pct}%</td>
                                                    <td style={{ maxWidth: '220px' }}>
                                                        <span className="truncate" style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{h.note || '-'}</span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </div>
    )
}
