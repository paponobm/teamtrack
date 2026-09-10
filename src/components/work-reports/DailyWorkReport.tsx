'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { getLocalDateString, getWeekRange, getMonthRange } from '@/lib/dateRange'
import { IconChevronLeft, IconChevronRight, IconSearch, IconX, IconDownload, IconPlus, IconEdit, IconTrash } from '@/components/icons/Icons'

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
    evaluation: { points: number; note: string | null; evaluated_at: string } | null
    // Management Check: a role-hierarchy verification chain (Manager verifies Member, Admin
    // verifies Manager/Member, Super Admin/Owner verifies anyone) — separate from the points
    // evaluation above. can_verify is computed server-side from the viewer's own role vs this
    // report's owner, so the UI never has to re-derive the hierarchy rule itself.
    management_check: 'yes' | 'no' | null
    checked_by: { id: string; name: string; designation: string | null } | null
    checked_at: string | null
    checked_note: string | null
    can_verify: boolean
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

// Small pill for the Management Check verification chain (see the work_reports comment in
// schema.prisma) — Pending until a superior records Yes/No, then names who decided. Shown on
// both the card and the detail modal so the two never show conflicting states.
function ManagementCheckBadge({ report }: { report: WorkReportEntry }) {
    if (report.management_check === 'yes') {
        return (
            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: '#16A34A', background: 'rgba(22,163,74,0.08)' }}>
                ✓ Checked{report.checked_by ? ` — ${report.checked_by.name}` : ''}
            </span>
        )
    }
    if (report.management_check === 'no') {
        return (
            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: '#DC2626', background: 'rgba(220,38,38,0.08)' }}>
                ✗ Not OK{report.checked_by ? ` — ${report.checked_by.name}` : ''}
            </span>
        )
    }
    return (
        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: '#6B7280', background: 'rgba(107,114,128,0.08)' }}>
            Check Pending
        </span>
    )
}

// Grows a Work Description row's textarea to fit its content (instead of scrolling
// horizontally inside a fixed single line) so a long line is fully visible while typing.
function autoGrowTextarea(el: HTMLTextAreaElement | null) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
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
    const [viewingReport, setViewingReport] = useState<WorkReportEntry | null>(null)
    const [verifyNote, setVerifyNote] = useState('')

    // Work Description on the Create form: numbered rows, same pattern as the Task
    // creation modal's Description section. form.description stays a single string
    // (joined "1. ...\n2. ...") so the rest of the save/edit flow is untouched.
    const [descRows, setDescRows] = useState<{ id: string; val: string }[]>([{ id: 'desc-init', val: '' }])

    // Common Report picker — an employee's own saved snippets, shown in their own modal with a
    // checkbox per snippet plus edit/delete icons and an "Add Common Report" button, so the
    // whole library is managed right there instead of a separate page section. Checking several
    // and pressing Add inserts each checked one as its own Work Description row, in the order
    // they're listed, so a multi-line report can be assembled from a few clicks instead of
    // retyping the same lines every day.
    const [commonReports, setCommonReports] = useState<{ id: string; text: string }[]>([])
    const [loadingCommonReports, setLoadingCommonReports] = useState(false)
    const [showCommonPicker, setShowCommonPicker] = useState(false)
    const [selectedCommonIds, setSelectedCommonIds] = useState<Set<string>>(new Set())
    // Nested "Add/Edit Common Report" sub-modal, opened from inside the picker above.
    const [showCommonEditModal, setShowCommonEditModal] = useState(false)
    const [editingCommonId, setEditingCommonId] = useState<string | null>(null)
    const [commonText, setCommonText] = useState('')
    const [savingCommon, setSavingCommon] = useState(false)

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

    // Re-measures every Work Description row's height whenever its text changes programmatically
    // (a Common Report pick reusing/filling a row, opening the edit modal with existing lines,
    // adding/removing a row) — the row's own onChange already grows it instantly while typing,
    // but that handler never fires for these other paths.
    useEffect(() => {
        if (!showModal) return
        document.querySelectorAll<HTMLTextAreaElement>('.daily-report-desc-textarea').forEach(autoGrowTextarea)
    }, [descRows, showModal])

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
        setDescRows([{ id: Math.random().toString(), val: '' }])
        setShowCommonPicker(false)
        setShowModal(true)
    }


    const syncDescription = (rows: { id: string; val: string }[]) => {
        const joined = rows.filter(r => r.val.trim()).map((r, i) => `${i + 1}. ${r.val.trim()}`).join('\n')
        setForm(prev => ({ ...prev, description: joined }))
    }

    const handleDescRowChange = (id: string, val: string) => {
        setDescRows(prev => {
            const next = prev.map(r => r.id === id ? { ...r, val } : r)
            syncDescription(next)
            return next
        })
    }

    const handleAddDescRow = () => {
        setDescRows(prev => [...prev, { id: Math.random().toString(), val: '' }])
    }

    // Always fetches fresh (rather than caching) so a snippet just added/edited elsewhere
    // shows up right away.
    const fetchCommonReportsList = async () => {
        setLoadingCommonReports(true)
        try {
            const res = await fetch('/api/common-reports')
            const data = await res.json()
            if (Array.isArray(data)) setCommonReports(data)
        } finally {
            setLoadingCommonReports(false)
        }
    }

    const openCommonPicker = () => {
        setSelectedCommonIds(new Set())
        setShowCommonPicker(true)
        fetchCommonReportsList()
    }

    const toggleCommonSelection = (id: string) => {
        setSelectedCommonIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const openAddCommonModal = () => {
        setEditingCommonId(null)
        setCommonText('')
        setShowCommonEditModal(true)
    }

    const openEditCommonModal = (cr: { id: string; text: string }) => {
        setEditingCommonId(cr.id)
        setCommonText(cr.text)
        setShowCommonEditModal(true)
    }

    const handleSaveCommon = async () => {
        if (!commonText.trim()) { toast.error('Text is required'); return }
        setSavingCommon(true)
        try {
            const res = editingCommonId
                ? await fetch('/api/common-reports', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingCommonId, text: commonText }),
                })
                : await fetch('/api/common-reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: commonText }),
                })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to save')
                return
            }
            toast.success(editingCommonId ? 'Common report updated' : 'Common report added')
            setShowCommonEditModal(false)
            fetchCommonReportsList()
        } finally {
            setSavingCommon(false)
        }
    }

    const handleDeleteCommon = async (id: string) => {
        if (!confirm('Delete this common report? This cannot be undone.')) return
        const res = await fetch(`/api/common-reports?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success('Common report deleted')
            setCommonReports(prev => prev.filter(r => r.id !== id))
            setSelectedCommonIds(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        } else {
            toast.error('Failed to delete')
        }
    }

    // Adds every checked Common Report snippet as its own Work Description row, in the order
    // they're listed — the first one fills the last row if it's still empty, everything after
    // that adds a new row underneath, same shape as typing them in manually one at a time.
    const handleAddSelectedCommonReports = () => {
        const textsToAdd = commonReports.filter(cr => selectedCommonIds.has(cr.id)).map(cr => cr.text)
        if (textsToAdd.length > 0) {
            // Opened standalone from the toolbar (no report form open yet) — start a fresh one
            // so there's somewhere for the picked lines to land. openCreateModal's setDescRows
            // reset runs first in this same batch, so the functional update below always builds
            // on top of that fresh single empty row rather than a stale form's leftovers.
            if (!showModal) openCreateModal()
            setDescRows(prev => {
                let rows = prev
                for (const text of textsToAdd) {
                    const last = rows[rows.length - 1]
                    rows = last && !last.val.trim()
                        ? rows.map(r => r.id === last.id ? { ...r, val: text } : r)
                        : [...rows, { id: Math.random().toString(), val: text }]
                }
                syncDescription(rows)
                return rows
            })
        }
        setShowCommonPicker(false)
        setSelectedCommonIds(new Set())
    }

    const handleRemoveDescRow = (id: string) => {
        setDescRows(prev => {
            const next = prev.filter(r => r.id !== id)
            const finalRows = next.length === 0 ? [{ id: Math.random().toString(), val: '' }] : next
            syncDescription(finalRows)
            return finalRows
        })
    }

    // Once an admin has accepted/scored a report via Work Comparison, it's locked from
    // further edits (by anyone) so the evaluation stays tied to what was actually reviewed.
    // Editing someone else's report is Super Admin/Owner-only (matches this app's established
    // pattern of reserving cross-employee actions for Super Admin+); Admin/Manager can only edit
    // their own report, and only on the day it was submitted, same as everyone else.
    const canEdit = (report: WorkReportEntry) => {
        if (report.evaluation) return false
        if (report.employee.id === perms.employee_id) return report.date === getLocalDateString()
        return !!perms.is_super
    }

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
        // Parse the stored "1. ...\n2. ..." description back into rows for the editor.
        // report.id (already a unique UUID) seeds the row keys instead of Math.random(),
        // so this stays a pure function of its argument.
        const lines = (report.description || '').split('\n').map(l => l.replace(/^\d+\.\s*/, '')).filter(l => l.trim())
        setDescRows(lines.length > 0 ? lines.map((val, i) => ({ id: `${report.id}-${i}`, val })) : [{ id: report.id, val: '' }])
        setShowCommonPicker(false)
        setViewingReport(null)
        setShowModal(true)
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

    // Management Check: records a superior's Yes/No decision on a subordinate's report (see
    // can_verify in the API — the button that calls this is only ever shown when the backend
    // would actually accept the request). Updates both the list and an open detail modal
    // in-place from the response so the badge/verifier name appear immediately.
    const handleVerify = async (id: string, decision: 'yes' | 'no') => {
        const res = await fetch(`/api/work-reports/${id}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ management_check: decision, note: verifyNote }),
        })
        if (res.ok) {
            const data = await res.json()
            // can_verify flips to false immediately (the decision is now final — see the 409 the
            // backend returns if a second attempt is made) so the Yes/No controls disappear
            // without waiting on a refetch.
            const patch = { management_check: data.management_check, checked_by: data.checked_by, checked_at: data.checked_at, checked_note: data.checked_note, can_verify: false }
            setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
            setViewingReport(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev))
            setVerifyNote('')
            toast.success(decision === 'yes' ? 'Marked as checked — Yes' : 'Marked as checked — No')
        } else {
            const e = await res.json().catch(() => ({}))
            toast.error(e.error || 'Failed to update management check')
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

                <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={openCommonPicker}>
                    Common Report
                </button>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={openCreateModal}>
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
                    <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                        {entries.map(r => {
                            const sc = statusConfig[r.status] || statusConfig.pending
                            return (
                                <motion.div key={r.id} className="card"
                                    style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden', height: '280px', display: 'flex', flexDirection: 'column' }}
                                    whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                                    onClick={() => { setViewingReport(r); setVerifyNote('') }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: sc.color }} />
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                                        <div style={{ flex: 1, minWidth: 0, minHeight: 0, alignSelf: 'stretch', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{r.project}</h3>
                                                {/* <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: sc.bg }}>{sc.label}</span> */}
                                                {r.evaluation && (
                                                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: '#16A34A', background: 'rgba(22,163,74,0.08)' }}>
                                                        ✓ Accepted
                                                    </span>
                                                )}
                                                <ManagementCheckBadge report={r} />
                                            </div>
                                            {(isAdmin || r.employee.id !== perms.employee_id) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexShrink: 0 }}>
                                                    <div className="avatar avatar-sm" style={{ background: getAvatarColor(r.employee.name), overflow: 'hidden' }}>
                                                        {r.employee.avatar_url ? (
                                                            <img src={r.employee.avatar_url} alt="" onError={(ev) => { ev.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (r.employee.name || '?')[0]?.toUpperCase()}
                                                    </div>
                                                    <div style={{ fontSize: '0.8125rem' }}>
                                                        <span style={{ fontWeight: 500 }}>{r.employee.name}</span>
                                                        {r.employee.department && <span style={{ color: 'var(--color-text-tertiary)' }}> · {r.employee.department}</span>}
                                                    </div>
                                                </div>
                                            )}
                                            {r.description && (
                                                <p style={{
                                                    fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0 0 8px', lineHeight: 1.5,
                                                    whiteSpace: 'pre-line', overflowWrap: 'anywhere', wordBreak: 'break-word',
                                                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                                }}>{r.description}</p>
                                            )}
                                            {r.evaluation && (
                                                <div style={{ padding: '8px 10px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: '8px', marginBottom: '8px', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', marginBottom: r.evaluation.note ? '4px' : 0 }}>
                                                        ⭐ {r.evaluation.points} pts awarded
                                                    </div>
                                                    {r.evaluation.note && (
                                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', overflowWrap: 'anywhere' }}>{r.evaluation.note}</div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Note + date grouped into one footer box at the bottom of the card, matching the
                                                boxed "Note:" style used on PR Management cards. */}
                                            <div style={{
                                                marginTop: 'auto', flexShrink: 0, padding: '6px 10px', borderRadius: '8px',
                                                background: 'rgba(118,118,128,0.05)', display: 'flex', flexDirection: 'column', gap: '4px',
                                            }}>
                                                {r.checked_note && (
                                                    <div style={{
                                                        fontSize: '0.75rem', color: '#DC2626',
                                                        overflowWrap: 'anywhere', wordBreak: 'break-word',
                                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                                    }}><strong>Note:</strong> {r.checked_note}</div>
                                                )}
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{formatSubmittedAt(r.created_at)}</span>
                                            </div>
                                        </div>
                                        {canEdit(r) && (
                                            <button onClick={e => { e.stopPropagation(); openEditModal(r) }} className="btn btn-ghost btn-sm" style={{ fontSize: '0.6875rem', padding: '3px 8px', flexShrink: 0 }}>Edit</button>
                                        )}
                                    </div>
                                </motion.div>
                            )
                        })}
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
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{viewingReport.project}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setViewingReport(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {(isAdmin || viewingReport.employee.id !== perms.employee_id) && (
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
                                    {/* <div><span style={{ color: 'var(--color-text-tertiary)' }}>Hours:</span> {viewingReport.hours}h</div> */}
                                    {/* <div><span style={{ color: 'var(--color-text-tertiary)' }}>Progress:</span> {viewingReport.progress}%</div> */}
                                    {/* <div>
                                        <span style={{ color: 'var(--color-text-tertiary)' }}>Status:</span>{' '}
                                        <span style={{ color: (statusConfig[viewingReport.status] || statusConfig.pending).color, fontWeight: 600 }}>
                                            {(statusConfig[viewingReport.status] || statusConfig.pending).label}
                                        </span>
                                    </div> */}
                                </div>
                                {viewingReport.description && (
                                    <div>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Work Description</div>
                                        <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{viewingReport.description}</p>
                                    </div>
                                )}
                                {viewingReport.evaluation && (
                                    <div style={{ padding: '10px 12px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', marginBottom: '4px' }}>
                                            ✓ Accepted — {viewingReport.evaluation.points} pts awarded
                                        </div>
                                        {viewingReport.evaluation.note && (
                                            <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-line', margin: 0 }}>{viewingReport.evaluation.note}</p>
                                        )}
                                    </div>
                                )}
                                <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '6px' }}>Management Check</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                        <ManagementCheckBadge report={viewingReport} />
                                        {viewingReport.checked_by && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                                {viewingReport.checked_by.name}{viewingReport.checked_by.designation ? ` (${viewingReport.checked_by.designation})` : ''}
                                            </span>
                                        )}
                                    </div>
                                    {viewingReport.checked_note && (
                                        <p style={{ fontSize: '0.8125rem', color: '#DC2626', marginTop: '8px', marginBottom: 0, whiteSpace: 'pre-line' }}>
                                            {viewingReport.checked_note}
                                        </p>
                                    )}
                                    {viewingReport.can_verify && (
                                        <>
                                            <textarea value={verifyNote} onChange={e => setVerifyNote(e.target.value)} placeholder="Add a verification note (optional)"
                                                className="form-input" rows={2}
                                                style={{ width: '100%', marginTop: '10px', fontSize: '0.8125rem', resize: 'vertical' }} />
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                <button className="btn btn-sm" onClick={() => handleVerify(viewingReport.id, 'yes')}
                                                    style={{ flex: 1, background: 'rgba(22,163,74,0.1)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.25)' }}>
                                                    Yes
                                                </button>
                                                <button className="btn btn-sm" onClick={() => handleVerify(viewingReport.id, 'no')}
                                                    style={{ flex: 1, background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)' }}>
                                                    No
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
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
                                    {/* Deleting someone else's report is Super Admin/Owner-only, same as editing above —
                                        Admin/Manager can still delete their own. */}
                                    {(perms.is_super || viewingReport.employee.id === perms.employee_id) && (
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
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '860px', width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{editingReport ? 'Edit Daily Report' : 'Create Daily Report'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="input-group">
                                    <label className="input-label">Date</label>
                                    <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} disabled={!isAdmin && !!editingReport} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Task / Project Name</label>
                                    <input type="text" className="input" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} placeholder="e.g. Website Redesign" />
                                </div>
                                <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label className="input-label" style={{ marginBottom: 0 }}>Work Description</label>
                                        <button type="button" onClick={openCommonPicker}
                                            style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid var(--color-border-light)', background: 'transparent', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                                            Common Report
                                        </button>
                                    </div>
                                    <AnimatePresence initial={false}>
                                        {descRows.map((row, i) => (
                                            <motion.div
                                                key={row.id}
                                                initial={{ opacity: 0, height: 0, y: -10 }}
                                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                                transition={{ duration: 0.2 }}
                                                style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
                                            >
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0, marginTop: '3px' }}>
                                                    {i + 1}
                                                </div>
                                                <textarea
                                                    className="input daily-report-desc-textarea"
                                                    rows={1}
                                                    placeholder="What did you work on?"
                                                    value={row.val}
                                                    ref={autoGrowTextarea}
                                                    onChange={e => { handleDescRowChange(row.id, e.target.value); autoGrowTextarea(e.target) }}
                                                    style={{ flex: 1, resize: 'none', overflow: 'hidden', lineHeight: 1.5, minHeight: '40px' }}
                                                    disabled={saving}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey && row.val.trim()) {
                                                            e.preventDefault()
                                                            if (i === descRows.length - 1) handleAddDescRow()
                                                        }
                                                    }}
                                                />
                                                {descRows.length > 1 && (
                                                    <button onClick={() => handleRemoveDescRow(row.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, padding: '6px', marginTop: '2px' }}>
                                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                    </button>
                                                )}
                                                {i === descRows.length - 1 && (
                                                    <button onClick={handleAddDescRow} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)', flexShrink: 0, padding: '6px', marginTop: '2px' }}>
                                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                                    </button>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving...' : editingReport ? 'Save Changes' : 'Submit Report'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Common Report Picker — the whole library lives here: check any number of saved
                snippets and press Add to insert each one as its own Work Description row above
                (in the order listed), or use the edit/delete icons and "Add Common Report" to
                manage the library itself, all from the same popup. */}
            <AnimatePresence>
                {showCommonPicker && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCommonPicker(false)} style={{ zIndex: 1100 }}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Common Report</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowCommonPicker(false)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {loadingCommonReports ? (
                                    [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '38px', borderRadius: '8px' }} />)
                                ) : commonReports.length === 0 ? (
                                    <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
                                        No common reports yet. Add one below.
                                    </div>
                                ) : (
                                    commonReports.map(cr => {
                                        const checked = selectedCommonIds.has(cr.id)
                                        return (
                                            <div key={cr.id}
                                                style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', borderRadius: '8px', border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border-light)'}`, background: checked ? 'var(--color-primary-light)' : 'transparent' }}>
                                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={checked} onChange={() => toggleCommonSelection(cr.id)} style={{ marginTop: '3px', flexShrink: 0 }} />
                                                    <span style={{ fontSize: '0.8125rem', whiteSpace: 'pre-line', overflowWrap: 'anywhere', flex: 1, minWidth: 0 }}>{cr.text}</span>
                                                </label>
                                                <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                                    <button onClick={() => openEditCommonModal(cr)} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-text-tertiary)', padding: '4px' }} title="Edit">
                                                        <IconEdit size={14} />
                                                    </button>
                                                    <button onClick={() => handleDeleteCommon(cr.id)} className="btn btn-ghost btn-icon" style={{ color: '#DC2626', padding: '4px' }} title="Delete">
                                                        <IconTrash size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-primary btn-sm" style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={openAddCommonModal}>
                                    <IconPlus size={14} /> Add Common Report
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowCommonPicker(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleAddSelectedCommonReports} disabled={selectedCommonIds.size === 0}>
                                    Add{selectedCommonIds.size > 0 ? ` (${selectedCommonIds.size})` : ''}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Nested Add/Edit Common Report sub-modal, stacked on top of the picker above. */}
            <AnimatePresence>
                {showCommonEditModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCommonEditModal(false)} style={{ zIndex: 1200 }}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{editingCommonId ? 'Edit Common Report' : 'Add Common Report'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowCommonEditModal(false)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div className="input-group">
                                    <label className="input-label">Report Text</label>
                                    <textarea className="input" rows={4} value={commonText} onChange={e => setCommonText(e.target.value)}
                                        placeholder="e.g. Followed up with pending customer orders" autoFocus />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowCommonEditModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSaveCommon} disabled={savingCommon}>{savingCommon ? 'Saving...' : 'Save'}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
