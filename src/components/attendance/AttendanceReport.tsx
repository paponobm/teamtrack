'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getMonthRangeFromString } from '@/lib/dateRange'
import { IconChevronLeft, IconChevronRight, IconSearch, IconX, IconDownload } from '@/components/icons/Icons'

interface EmployeeSummary {
    id: string
    name: string
    employee_id: string | null
    avatar_url: string | null
    duty_start_time: string | null
    department: string | null
    total_attendance: number
    total_late: number
    total_absent: number
    total_leave: number
    total_working_ms: number
    total_break_ms: number
}

interface Counts {
    present: number
    late: number
    absent: number
    leave: number
}

const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const statColors = {
    present: '#16A34A',
    late: '#F59E0B',
    absent: '#DC2626',
    leave: '#7C3AED',
}

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || '?').charCodeAt(0) % colors.length]
}

function formatDuration(ms: number) {
    if (!ms || ms < 0) return '-'
    const hrs = Math.floor(ms / 3600000)
    const mins = Math.floor((ms % 3600000) / 60000)
    return `${hrs}h ${mins}m`
}

const defaultMonth = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AttendanceReport() {
    const [employeeRows, setEmployeeRows] = useState<EmployeeSummary[]>([])
    const [counts, setCounts] = useState<Counts>({ present: 0, late: 0, absent: 0, leave: 0 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [month, setMonth] = useState(defaultMonth)

    const [employees, setEmployees] = useState<{ id: string; name: string; employee_id: string }[]>([])
    const [filterEmployee, setFilterEmployee] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [zoomedPhoto, setZoomedPhoto] = useState<{ url: string; name: string } | null>(null)

    const range = getMonthRangeFromString(month)

    useEffect(() => {
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) }).catch(() => { })
    }, [])

    const fetchReport = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            params.set('start_date', range.start)
            params.set('end_date', range.end)
            params.set('group_by', 'employee')
            if (filterEmployee) params.set('employee_id', filterEmployee)
            if (filterStatus !== 'all') params.set('status', filterStatus)
            if (searchQuery.trim()) params.set('search', searchQuery.trim())

            const res = await fetch(`/api/attendance/report?${params}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to load report')
            setEmployeeRows(data.employees || [])
            setCounts(data.counts || { present: 0, late: 0, absent: 0, leave: 0 })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load report')
            setEmployeeRows([])
        } finally {
            setLoading(false)
        }
    }, [range.start, range.end, filterEmployee, filterStatus, searchQuery])

    useEffect(() => { fetchReport() }, [fetchReport])

    const changeMonth = (delta: number) => {
        const [y, m] = month.split('-').map(Number)
        const d = new Date(y, m - 1 + delta, 1)
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
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
        link.download = `attendance-report-${month}.csv`
        link.click()
    }

    const summaryCards = [
        { key: 'present', label: 'Total Present', value: counts.present, color: statColors.present },
        { key: 'late', label: 'Total Late', value: counts.late, color: statColors.late },
        { key: 'absent', label: 'Total Absent', value: counts.absent, color: statColors.absent },
        { key: 'leave', label: 'Total Leave', value: counts.leave, color: statColors.leave },
    ]

    return (
        <div>
            {/* Month Selector — this report is monthly-only, one row per employee */}
            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => changeMonth(-1)} style={{ borderRadius: '8px' }}>
                        <IconChevronLeft size={16} />
                    </button>
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                    <button className="btn btn-ghost btn-icon" onClick={() => changeMonth(1)} style={{ borderRadius: '8px' }}>
                        <IconChevronRight size={16} />
                    </button>
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                    {range.start} → {range.end}
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
            {/* <motion.div className="grid grid-4" variants={item} initial="hidden" animate="show" style={{ marginBottom: '24px' }}>
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
            </motion.div> */}

            {/* Error state */}
            {error && !loading && (
                <div className="card" style={{ marginBottom: '20px', padding: '16px 20px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: '0.875rem' }}>
                    {error}
                </div>
            )}

            {/* Table — one row per employee, totals for the selected month */}
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
            ) : !error && employeeRows.length === 0 ? (
                <motion.div className="card" variants={item} initial="hidden" animate="show" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <svg width="48" height="48" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ marginBottom: '16px' }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text-secondary)' }}>No members found</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>No members match the selected filters for this month.</p>
                </motion.div>
            ) : !error && (
                <motion.div className="table-container" variants={item} initial="hidden" animate="show">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>SL</th>
                                <th>Employee</th>
                                <th>Total Attendance</th>
                                <th>Leave &amp; Absence</th>
                                <th>Total Late</th>
                                <th>Total Working Time</th>
                                <th>Total Break Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employeeRows.map((emp, i) => (
                                <tr key={emp.id}>
                                    <td style={{ color: 'var(--color-text-tertiary)' }}>{i + 1}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="avatar avatar-sm" onClick={() => { if (emp.avatar_url) setZoomedPhoto({ url: emp.avatar_url, name: emp.name || '' }) }}
                                                style={{ background: getAvatarColor(emp.name || '?'), overflow: 'hidden', cursor: emp.avatar_url ? 'zoom-in' : 'default' }}>
                                                {emp.avatar_url ? (
                                                    <img src={emp.avatar_url} alt="" onError={(ev) => { ev.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (emp.name || '?')[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{emp.name || '-'}</div>
                                                {(emp.employee_id || emp.department) && (
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
                                                        {emp.employee_id}
                                                        {emp.employee_id && emp.department ? ' • ' : ''}
                                                        {emp.department}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600, color: statColors.present }}>{emp.total_attendance}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{emp.total_leave + emp.total_absent}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
                                            <span style={{ color: statColors.leave }}>Leave: {emp.total_leave}</span>
                                            {' '}
                                            <span style={{ color: statColors.absent }}>Absence: {emp.total_absent}</span>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600, color: statColors.late }}>{emp.total_late}</td>
                                    <td style={{ fontSize: '0.8125rem' }}>{formatDuration(emp.total_working_ms)}</td>
                                    <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDuration(emp.total_break_ms)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            )}

            {/* Photo zoom lightbox — click any employee avatar in the table to view it larger. */}
            <AnimatePresence>
                {zoomedPhoto && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setZoomedPhoto(null)}
                        style={{ zIndex: 1200, cursor: 'zoom-out' }}>
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            onClick={e => e.stopPropagation()}
                            style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <img src={zoomedPhoto.url} alt={zoomedPhoto.name}
                                style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', objectFit: 'contain' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9375rem' }}>{zoomedPhoto.name}</span>
                                <button className="btn btn-secondary btn-sm" onClick={() => setZoomedPhoto(null)}>Close</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
