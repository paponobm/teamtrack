'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { getLocalDateString, getWeekRange, getMonthRange } from '@/lib/dateRange'
import { IconChevronLeft, IconChevronRight, IconSearch, IconX, IconDownload, IconPlus } from '@/components/icons/Icons'

type DateRangeMode = 'today' | 'week' | 'month' | 'custom'

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
    employee: { id: string; name: string; employee_id: string; avatar_url: string | null; department: string | null }
}

const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: 'Completed', color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
    in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
}

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || '?').charCodeAt(0) % colors.length]
}

function formatSubmittedAt(ts: string) {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const LIMIT = 20
const emptyReportForm = { date: '', project: '', description: '', hours: '', progress: '0', status: 'in_progress', attachment_url: '', notes: '' }

export default function DailyWorkReport() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const isAdmin = !!(perms.is_super || perms.is_admin)

    const [entries, setEntries] = useState<WorkReportEntry[]>([])
    const [summary, setSummary] = useState<Record<string, number>>({})
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('today')
    const [refDate, setRefDate] = useState(() => getLocalDateString())
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [appliedCustomStart, setAppliedCustomStart] = useState('')
    const [appliedCustomEnd, setAppliedCustomEnd] = useState('')

    const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
    const [filterEmployeeId, setFilterEmployeeId] = useState('')
    const [filterDepartmentId, setFilterDepartmentId] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(1)

    const [showModal, setShowModal] = useState(false)
    const [editingReport, setEditingReport] = useState<WorkReportEntry | null>(null)
    const [form, setForm] = useState(emptyReportForm)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [viewingReport, setViewingReport] = useState<WorkReportEntry | null>(null)

    const range = dateRangeMode === 'today' ? { start: refDate, end: refDate }
        : dateRangeMode === 'week' ? getWeekRange(new Date(`${refDate}T00:00:00`))
        : dateRangeMode === 'month' ? getMonthRange(new Date(`${refDate}T00:00:00`))
        : { start: appliedCustomStart, end: appliedCustomEnd }

    const rangeReady = dateRangeMode !== 'custom' || !!(appliedCustomStart && appliedCustomEnd)

    useEffect(() => {
        setPage(1)
    }, [dateRangeMode, refDate, appliedCustomStart, appliedCustomEnd, filterEmployeeId, filterDepartmentId, filterStatus, searchQuery])

    useEffect(() => {
        if (!isAdmin) return
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) }).catch(() => { })
        fetch('/api/departments').then(r => r.json()).then(d => { if (Array.isArray(d)) setDepartments(d) }).catch(() => { })
    }, [isAdmin])

    const fetchReports = useCallback(async () => {
        if (!rangeReady) return
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            params.set('start_date', range.start)
            params.set('end_date', range.end)
            if (isAdmin && filterEmployeeId) params.set('employee_id', filterEmployeeId)
            if (isAdmin && filterDepartmentId) params.set('department_id', filterDepartmentId)
            if (filterStatus !== 'all') params.set('status', filterStatus)
            if (searchQuery.trim()) params.set('search', searchQuery.trim())
            params.set('page', String(page))
            params.set('limit', String(LIMIT))

            const res = await fetch(`/api/work-reports?${params}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to load reports')
            setEntries(data.entries || [])
            setSummary(data.summary || {})
            setTotal(data.total || 0)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load reports')
            setEntries([])
        } finally {
            setLoading(false)
        }
    }, [rangeReady, range.start, range.end, isAdmin, filterEmployeeId, filterDepartmentId, filterStatus, searchQuery, page])

    useEffect(() => { fetchReports() }, [fetchReports])

    const changeRefDate = (deltaDays: number) => {
        const d = new Date(`${refDate}T00:00:00`)
        d.setDate(d.getDate() + deltaDays)
        setRefDate(getLocalDateString(d))
    }

    const openCreateModal = () => {
        setEditingReport(null)
        setForm({ ...emptyReportForm, date: getLocalDateString() })
        setShowModal(true)
    }

    const canEdit = (report: WorkReportEntry) => isAdmin || report.date === getLocalDateString()

    const openEditModal = (report: WorkReportEntry) => {
        setEditingReport(report)
        setForm({
            date: report.date,
            project: report.project,
            description: report.description || '',
            hours: String(report.hours),
            progress: String(report.progress),
            status: report.status,
            attachment_url: report.attachment_url || '',
            notes: report.notes || '',
        })
        setViewingReport(null)
        setShowModal(true)
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const MAX_BYTES = 50 * 1024 * 1024
        if (file.size > MAX_BYTES) { toast.error('File is too large (max 50MB)'); return }
        setUploading(true)
        try {
            const res = await fetch('/api/upload/r2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
            })
            const data = await res.json()
            if (!res.ok || !data.presignedUrl || !data.publicUrl) {
                toast.error(data.error || 'Upload failed')
                return
            }
            const putRes = await fetch(data.presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
            if (putRes.ok) setForm(prev => ({ ...prev, attachment_url: data.publicUrl }))
            else toast.error('Upload failed')
        } catch {
            toast.error('Upload failed')
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async () => {
        if (!form.project.trim()) { toast.error('Project/Task is required'); return }
        setSaving(true)
        try {
            const payload = {
                date: form.date,
                project: form.project.trim(),
                description: form.description || null,
                hours: parseFloat(form.hours) || 0,
                progress: Math.max(0, Math.min(100, parseInt(form.progress) || 0)),
                status: form.status,
                attachment_url: form.attachment_url || null,
                notes: form.notes || null,
            }
            const res = editingReport
                ? await fetch(`/api/work-reports/${editingReport.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                : await fetch('/api/work-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to save report')
                return
            }
            toast.success(editingReport ? 'Report updated' : 'Report submitted')
            setShowModal(false)
            fetchReports()
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this report permanently? This cannot be undone.')) return
        const res = await fetch(`/api/work-reports/${id}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success('Report deleted')
            setViewingReport(null)
            fetchReports()
        } else {
            const e = await res.json().catch(() => ({}))
            toast.error(e.error || 'Failed to delete report')
        }
    }

    const handleExportCSV = () => {
        const params = new URLSearchParams()
        params.set('type', 'work-reports')
        params.set('start_date', range.start)
        params.set('end_date', range.end)
        if (filterEmployeeId) params.set('employee_id', filterEmployeeId)
        if (filterStatus !== 'all') params.set('status', filterStatus)
        const link = document.createElement('a')
        link.href = `/api/export?${params}`
        link.download = `work-reports-${range.start}-to-${range.end}.csv`
        link.click()
    }

    const totalPages = Math.max(1, Math.ceil(total / LIMIT))

    const summaryCards = isAdmin ? [
        { key: 'total', label: 'Total Reports', value: summary.totalReports ?? 0, color: '#2563EB' },
        { key: 'today', label: 'Reports Today', value: summary.reportsToday ?? 0, color: '#16A34A' },
        { key: 'submitted', label: 'Employees Submitted', value: summary.employeesSubmitted ?? 0, color: '#7C3AED' },
        { key: 'pending', label: 'Pending Employees', value: summary.pendingEmployees ?? 0, color: '#F59E0B' },
    ] : [
        { key: 'today', label: "Today's Reports", value: summary.todayReports ?? 0, color: '#16A34A' },
        { key: 'week', label: 'This Week', value: summary.weekReports ?? 0, color: '#3B82F6' },
        { key: 'month', label: 'This Month', value: summary.monthReports ?? 0, color: '#7C3AED' },
        { key: 'total', label: 'Total Reports', value: summary.totalReports ?? 0, color: '#2563EB' },
    ]

    return (
        <div>
            {/* Date Range + Create */}
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
                                <motion.div layoutId="workReportRangeTab" style={{
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

                <button className="btn btn-primary" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={openCreateModal}>
                    <IconPlus size={16} /> Create Daily Report
                </button>
            </motion.div>

            {/* Filters */}
            <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                {isAdmin && (
                    <select className="input" value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)} style={{ width: '170px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                        <option value="">All Employees</option>
                        {employees.map(e => (<option key={e.id} value={e.id}>{e.name}</option>))}
                    </select>
                )}
                {isAdmin && (
                    <select className="input" value={filterDepartmentId} onChange={(e) => setFilterDepartmentId(e.target.value)} style={{ width: '160px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                        <option value="">All Departments</option>
                        {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                    </select>
                )}
                <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '150px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending">Pending</option>
                </select>
                <div style={{ position: 'relative', minWidth: '200px' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', opacity: 0.5, pointerEvents: 'none' }}><IconSearch size={14} color="var(--color-text-tertiary)" /></span>
                    <input className="input" type="text" placeholder={isAdmin ? 'Search employee or project...' : 'Search project...'}
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '32px', width: '100%', padding: '8px 12px 8px 32px', fontSize: '0.8125rem' }} />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: 'var(--color-text-tertiary)' }} title="Clear"><IconX size={14} /></button>
                    )}
                </div>
                {isAdmin && (
                    <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }} title="Export CSV">
                        <IconDownload size={16} /> Export CSV
                    </button>
                )}
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
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text-secondary)' }}>No reports</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', marginBottom: '20px' }}>No daily work reports match the selected range and filters.</p>
                    <button className="btn btn-primary" onClick={openCreateModal}>Create Daily Report</button>
                </motion.div>
            ) : !error && (
                <>
                    <motion.div className="table-container" variants={item} initial="hidden" animate="show">
                        <table className="table">
                            <thead>
                                <tr>
                                    {isAdmin && <th>Employee</th>}
                                    {isAdmin && <th>Department</th>}
                                    <th>Date</th>
                                    <th>Project</th>
                                    <th>Hours</th>
                                    <th>Progress</th>
                                    <th>Status</th>
                                    <th>Submitted At</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(r => {
                                    const sc = statusConfig[r.status] || statusConfig.pending
                                    return (
                                        <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setViewingReport(r)}>
                                            {isAdmin && (
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div className="avatar avatar-sm" style={{ background: getAvatarColor(r.employee.name), overflow: 'hidden' }}>
                                                            {r.employee.avatar_url ? (
                                                                <img src={r.employee.avatar_url} alt="" onError={(ev) => { ev.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (r.employee.name || '?')[0]?.toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 500 }}>{r.employee.name}</div>
                                                            {r.employee.employee_id && <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{r.employee.employee_id}</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                            )}
                                            {isAdmin && <td style={{ color: 'var(--color-text-secondary)' }}>{r.employee.department || '-'}</td>}
                                            <td>{new Date(`${r.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                            <td style={{ fontWeight: 500 }}>{r.project}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{r.hours}h</td>
                                            <td style={{ fontSize: '0.8125rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '48px', height: '6px', borderRadius: '3px', background: 'rgba(118,118,128,0.15)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${r.progress}%`, height: '100%', background: '#2563EB' }} />
                                                    </div>
                                                    {r.progress}%
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: sc.bg }}>{sc.label}</span>
                                            </td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{formatSubmittedAt(r.created_at)}</td>
                                            <td onClick={e => e.stopPropagation()}>
                                                {canEdit(r) && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(r)} style={{ fontSize: '0.6875rem', padding: '3px 8px' }}>Edit</button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </motion.div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}><IconChevronLeft size={16} /></button>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Page {page} of {totalPages} · {total} report{total !== 1 ? 's' : ''}</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><IconChevronRight size={16} /></button>
                    </div>
                </>
            )}

            {/* Report Detail Modal */}
            <AnimatePresence>
                {viewingReport && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingReport(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{viewingReport.project}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setViewingReport(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {isAdmin && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div className="avatar avatar-sm" style={{ background: getAvatarColor(viewingReport.employee.name), overflow: 'hidden' }}>
                                            {viewingReport.employee.avatar_url ? (
                                                <img src={viewingReport.employee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (viewingReport.employee.name || '?')[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{viewingReport.employee.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{viewingReport.employee.department || '-'}</div>
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8125rem' }}>
                                    <div><span style={{ color: 'var(--color-text-tertiary)' }}>Date:</span> {viewingReport.date}</div>
                                    <div><span style={{ color: 'var(--color-text-tertiary)' }}>Hours:</span> {viewingReport.hours}h</div>
                                    <div><span style={{ color: 'var(--color-text-tertiary)' }}>Progress:</span> {viewingReport.progress}%</div>
                                    <div>
                                        <span style={{ color: 'var(--color-text-tertiary)' }}>Status:</span>{' '}
                                        <span style={{ color: (statusConfig[viewingReport.status] || statusConfig.pending).color, fontWeight: 600 }}>
                                            {(statusConfig[viewingReport.status] || statusConfig.pending).label}
                                        </span>
                                    </div>
                                </div>
                                {viewingReport.description && (
                                    <div>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Work Description</div>
                                        <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{viewingReport.description}</p>
                                    </div>
                                )}
                                {viewingReport.notes && (
                                    <div>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
                                        <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{viewingReport.notes}</p>
                                    </div>
                                )}
                                {viewingReport.attachment_url && (
                                    <a href={viewingReport.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: '#2563EB' }}>
                                        View Attachment
                                    </a>
                                )}
                            </div>
                            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                                <div>
                                    {isAdmin && (
                                        <button className="btn btn-sm" onClick={() => handleDelete(viewingReport.id)} style={{ background: '#DC2626', color: '#fff', border: 'none' }}>Delete</button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setViewingReport(null)}>Close</button>
                                    {canEdit(viewingReport) && (
                                        <button className="btn btn-primary btn-sm" onClick={() => openEditModal(viewingReport)}>Edit</button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{editingReport ? 'Edit Daily Report' : 'Create Daily Report'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="input-group">
                                        <label className="input-label">Date</label>
                                        <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} disabled={!isAdmin && !!editingReport} />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Hours Worked</label>
                                        <input type="number" step="0.5" min="0" className="input" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="e.g. 6.5" />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Task / Project</label>
                                    <input type="text" className="input" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} placeholder="e.g. Website Redesign" />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Work Description</label>
                                    <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What did you work on?" rows={3} style={{ resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="input-group">
                                        <label className="input-label">Progress %</label>
                                        <input type="number" min="0" max="100" className="input" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Status</label>
                                        <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Attachment (optional)</label>
                                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={handleFileChange} disabled={uploading} />
                                    {uploading && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Uploading...</div>}
                                    {form.attachment_url && !uploading && (
                                        <div style={{ fontSize: '0.75rem', color: '#16A34A', marginTop: '4px' }}>Attached ✓</div>
                                    )}
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Notes</label>
                                    <input type="text" className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything else to add..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || uploading}>
                                    {saving ? 'Saving...' : editingReport ? 'Save Changes' : 'Submit Report'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
