'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import { getLocalDateString, getWeekRange, getMonthRange } from '@/lib/dateRange'
import { IconChevronLeft, IconChevronRight, IconSearch, IconX, IconDownload } from '@/components/icons/Icons'

type DateRangeMode = 'today' | 'week' | 'month' | 'custom'

interface ReportEntry {
    id: string
    date: string
    clock_in: string | null
    clock_out: string | null
    status: string
    employee: { id: string; name: string; employee_id: string; avatar_url: string | null; department: string | null }
    workingMs: number
    breakMs: number
    overtimeMs: number
}

interface Counts {
    present: number
    late: number
    absent: number
    leave: number
}

const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

// Mirrors attendance/page.tsx's statusConfig so badge colors match exactly across tabs.
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    present: { label: 'Present', color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
    late: { label: 'Late', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    absent: { label: 'Absent', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    half_day: { label: 'Half Day', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    leave: { label: 'On Leave', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
    on_duty: { label: 'On Duty', color: '#0891B2', bg: 'rgba(8,145,178,0.08)' },
}

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[name.charCodeAt(0) % colors.length]
}

function formatDuration(ms: number) {
    if (!ms || ms < 0) return '-'
    const hrs = Math.floor(ms / 3600000)
    const mins = Math.floor((ms % 3600000) / 60000)
    return `${hrs}h ${mins}m`
}

function formatClockTime(ts: string | null) {
    if (!ts) return '-'
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const LIMIT = 20

export default function AttendanceReport() {
    const { lang } = useLanguage()

    const [entries, setEntries] = useState<ReportEntry[]>([])
    const [counts, setCounts] = useState<Counts>({ present: 0, late: 0, absent: 0, leave: 0 })
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('today')
    const [refDate, setRefDate] = useState(() => getLocalDateString())
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    // Custom mode only refetches when "Search" is pressed, not on every keystroke.
    const [appliedCustomStart, setAppliedCustomStart] = useState('')
    const [appliedCustomEnd, setAppliedCustomEnd] = useState('')

    const [employees, setEmployees] = useState<{ id: string; name: string; employee_id: string }[]>([])
    const [filterEmployee, setFilterEmployee] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    const [page, setPage] = useState(1)

    const range = dateRangeMode === 'today' ? { start: refDate, end: refDate }
        : dateRangeMode === 'week' ? getWeekRange(new Date(`${refDate}T00:00:00`))
        : dateRangeMode === 'month' ? getMonthRange(new Date(`${refDate}T00:00:00`))
        : { start: appliedCustomStart, end: appliedCustomEnd }

    const rangeReady = dateRangeMode !== 'custom' || !!(appliedCustomStart && appliedCustomEnd)

    // Reset to page 1 whenever the underlying result set would change.
    useEffect(() => { setPage(1) }, [dateRangeMode, refDate, appliedCustomStart, appliedCustomEnd, filterEmployee, filterStatus, searchQuery])

    useEffect(() => {
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) }).catch(() => { })
    }, [])

    const fetchReport = useCallback(async () => {
        if (!rangeReady) return
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            params.set('start_date', range.start)
            params.set('end_date', range.end)
            if (filterEmployee) params.set('employee_id', filterEmployee)
            if (filterStatus !== 'all') params.set('status', filterStatus)
            if (searchQuery.trim()) params.set('search', searchQuery.trim())
            params.set('page', String(page))
            params.set('limit', String(LIMIT))

            const res = await fetch(`/api/attendance/report?${params}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to load report')
            setEntries(data.entries || [])
            setCounts(data.counts || { present: 0, late: 0, absent: 0, leave: 0 })
            setTotal(data.total || 0)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load report')
            setEntries([])
        } finally {
            setLoading(false)
        }
    }, [rangeReady, range.start, range.end, filterEmployee, filterStatus, searchQuery, page])

    useEffect(() => { fetchReport() }, [fetchReport])

    const changeRefDate = (deltaDays: number) => {
        const d = new Date(`${refDate}T00:00:00`)
        d.setDate(d.getDate() + deltaDays)
        setRefDate(getLocalDateString(d))
    }

    const handleExportCSV = () => {
        const params = new URLSearchParams()
        params.set('type', 'attendance')
        params.set('start_date', range.start)
        params.set('end_date', range.end)
        if (filterEmployee) params.set('employee_id', filterEmployee)
        if (filterStatus !== 'all') params.set('status', filterStatus)
        const link = document.createElement('a')
        link.href = `/api/export?${params}`
        link.download = `attendance-report-${range.start}-to-${range.end}.csv`
        link.click()
    }

    const totalPages = Math.max(1, Math.ceil(total / LIMIT))

    const summaryCards = [
        { key: 'present', label: 'Total Present', value: counts.present, color: statusConfig.present.color },
        { key: 'late', label: 'Total Late', value: counts.late, color: statusConfig.late.color },
        { key: 'absent', label: 'Total Absent', value: counts.absent, color: statusConfig.absent.color },
        { key: 'leave', label: 'Total Leave', value: counts.leave, color: statusConfig.leave.color },
    ]

    return (
        <div>
            {/* Date Range Selector */}
            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                                <motion.div layoutId="reportRangeTab" style={{
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
                        <button className="btn btn-ghost btn-icon" onClick={() => changeRefDate(-1)} style={{ borderRadius: '8px' }}>
                            <IconChevronLeft size={16} />
                        </button>
                        <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                        <button className="btn btn-ghost btn-icon" onClick={() => changeRefDate(1)} style={{ borderRadius: '8px' }}>
                            <IconChevronRight size={16} />
                        </button>
                    </div>
                )}

                {(dateRangeMode === 'week' || dateRangeMode === 'month') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => changeRefDate(dateRangeMode === 'week' ? -7 : -30)} style={{ borderRadius: '8px' }}>
                            <IconChevronLeft size={16} />
                        </button>
                        <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                        <button className="btn btn-ghost btn-icon" onClick={() => changeRefDate(dateRangeMode === 'week' ? 7 : 30)} style={{ borderRadius: '8px' }}>
                            <IconChevronRight size={16} />
                        </button>
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

                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                    {rangeReady ? (range.start === range.end ? range.start : `${range.start} → ${range.end}`) : 'Select a custom range'}
                </span>
            </motion.div>

            {/* Filters */}
            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} style={{ width: '180px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                    <option value="">All Members</option>
                    {employees.map(e => (<option key={e.id} value={e.id}>{e.name}</option>))}
                </select>
                <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '150px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                    <option value="all">All Status</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                </select>
                <div style={{ position: 'relative', minWidth: '200px' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', opacity: 0.5, pointerEvents: 'none' }}><IconSearch size={14} color="var(--color-text-tertiary)" /></span>
                    <input className="input" type="text" placeholder="Search employee name..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '32px', width: '100%', padding: '8px 12px 8px 32px', fontSize: '0.8125rem' }} />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: 'var(--color-text-tertiary)' }} title="Clear"><IconX size={14} /></button>
                    )}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }} title="Export CSV">
                    <IconDownload size={16} /> Export CSV
                </button>
            </motion.div>

            {/* Summary Cards */}
            <motion.div className="grid grid-4" variants={item} initial="hidden" animate="show" style={{ marginBottom: '24px' }}>
                {summaryCards.map(stat => (
                    <div key={stat.key} className="stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="stat-label">{stat.label}</span>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stat.color }} />
                            </div>
                        </div>
                        <span className="stat-value">{loading ? '-' : stat.value}</span>
                    </div>
                ))}
            </motion.div>

            {/* Error state */}
            {error && !loading && (
                <div className="card" style={{ marginBottom: '20px', padding: '16px 20px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: '0.875rem' }}>
                    {error}
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="card" style={{ padding: '0' }}>
                    <div style={{ padding: '16px 24px' }}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '14px 0', borderBottom: i < 5 ? '1px solid var(--color-border-light)' : 'none' }}>
                                <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                <div className="skeleton" style={{ width: '120px', height: '14px' }} />
                                <div className="skeleton" style={{ width: '80px', height: '14px', marginLeft: 'auto' }} />
                                <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '12px' }} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : !error && entries.length === 0 ? (
                <motion.div className="card" variants={item} initial="hidden" animate="show" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <svg width="48" height="48" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ marginBottom: '16px' }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text-secondary)' }}>No attendance records</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>No records match the selected range and filters.</p>
                </motion.div>
            ) : !error && (
                <>
                    <motion.div className="table-container" variants={item} initial="hidden" animate="show">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>SL</th>
                                    <th>Employee</th>
                                    <th>Employee ID</th>
                                    <th>Department</th>
                                    <th>Date</th>
                                    <th>Clock In</th>
                                    <th>Clock Out</th>
                                    <th>Working Time</th>
                                    <th>Break Time</th>
                                    <th>Overtime</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e, i) => {
                                    const sc = statusConfig[e.status] || statusConfig.present
                                    const dateStr = new Date(`${e.date}T00:00:00`).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                    return (
                                        <tr key={e.id}>
                                            <td style={{ color: 'var(--color-text-tertiary)' }}>{(page - 1) * LIMIT + i + 1}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="avatar avatar-sm" style={{ background: getAvatarColor(e.employee.name || '?'), overflow: 'hidden' }}>
                                                        {e.employee.avatar_url ? (
                                                            <img src={e.employee.avatar_url} alt="" onError={(ev) => { ev.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (e.employee.name || '?')[0]?.toUpperCase()}
                                                    </div>
                                                    <div style={{ fontWeight: 500 }}>{e.employee.name || '-'}</div>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{e.employee.employee_id || '-'}</td>
                                            <td style={{ color: 'var(--color-text-secondary)' }}>{e.employee.department || '-'}</td>
                                            <td>{dateStr}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{formatClockTime(e.clock_in)}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{formatClockTime(e.clock_out)}</td>
                                            <td style={{ fontSize: '0.8125rem' }}>{formatDuration(e.workingMs)}</td>
                                            <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDuration(e.breakMs)}</td>
                                            <td style={{ fontSize: '0.8125rem', color: e.overtimeMs > 0 ? '#16A34A' : 'var(--color-text-tertiary)' }}>{e.overtimeMs > 0 ? formatDuration(e.overtimeMs) : '-'}</td>
                                            <td>
                                                <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: `${sc.color}15` }}>{sc.label}</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </motion.div>

                    {/* Pagination */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                            <IconChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            Page {page} of {totalPages} · {total} record{total !== 1 ? 's' : ''}
                        </span>
                        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                            <IconChevronRight size={16} />
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
