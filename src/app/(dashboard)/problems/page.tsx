'use client'

import RequireFeature from '@/components/common/RequireFeature'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { usePermissions } from '@/lib/PermissionsContext'
import {
    IconClipboard, IconCircleDot, IconClock, IconCheckCircle, IconPlus, IconX,
    IconSearch, IconEye, IconWrench, IconAlertCircle, IconArrowUpCircle,
    IconTrash, IconEdit
} from '@/components/icons/Icons'

interface Problem {
    id: string
    problem_no: string
    entry_date: string
    customer_name: string | null
    customer_phone: string | null
    problem_details: string | null
    category: string | null
    priority: 'critical' | 'high' | 'medium' | 'low'
    status: 'open' | 'in_progress' | 'resolved' | 'escalated'
    solved_date: string | null
    notes: string | null
    resolution_note: string | null
    peek: { id: string; name: string } | null
    solver: { id: string; name: string } | null
    created_at: string
}

interface Employee {
    id: string
    name: string
    employee_id: string
}

interface ActivityLog {
    id: string
    actor: { id: string; name: string } | null
    action: string
    old_value: string | null
    new_value: string | null
    details: { actor_name?: string; points?: number; status_note?: string } | null
    created_at: string
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

// Actions the activity log renders with a tailored sentence; anything else uses a generic fallback.
const KNOWN_PROBLEM_ACTIONS = ['status_change', 'priority_change', 'pick', 'unpick', 'solve', 'created']
// Humanize any unhandled action so the log never shows a blank row (#8a).
const describeUnknownAction = (log: ActivityLog) => {
    const verb = log.action.replace(/_/g, ' ')
    if (log.old_value && log.new_value) return `${verb}: ${log.old_value} → ${log.new_value}`
    if (log.new_value) return `${verb}: ${log.new_value}`
    return verb
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    open: { label: 'Open', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.15)' },
    in_progress: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
    resolved: { label: 'Resolved', color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)' },
    escalated: { label: 'Escalated', color: '#7C3AED', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.15)' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
    critical: { label: 'Critical', color: '#DC2626' },
    high: { label: 'High', color: '#F59E0B' },
    medium: { label: 'Medium', color: '#3B82F6' },
    low: { label: 'Low', color: '#6B7280' },
}

const CATEGORY_OPTIONS = [
    'Wrong Product',
    'Product Missing',
    'Product Broken',
    'Product Wasted',
    'Product Expired',
    'Parcel Late',
    'Customer Support Behavior',
    'Custom',
]

const CATEGORY_COLORS: Record<string, string> = {
    'Wrong Product': '#EF4444',
    'Product Missing': '#F97316',
    'Product Broken': '#8B5CF6',
    'Product Wasted': '#EC4899',
    'Product Expired': '#6366F1',
    'Parcel Late': '#0EA5E9',
    'Customer Support Behavior': '#14B8A6',
}

const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'escalated', label: 'Escalated' },
]

const priorityFilterOptions = [
    { key: 'all', label: 'All Priorities' },
    { key: 'critical', label: 'Critical' },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
]

const dateRangeOptions = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
]

const emptyForm = {
    customer_name: '',
    customer_phone: '',
    problem_details: '',
    priority: 'medium' as Problem['priority'],
    business_name: '',
    category: '',
    custom_category: '',
}

const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function getDateRange(key: string): { start: string; end: string } | null {
    const now = new Date()
    const today = fmtLocalDate(now)
    if (key === 'today') return { start: today, end: today }
    if (key === 'week') {
        const d = new Date(now)
        d.setDate(d.getDate() - d.getDay())
        return { start: fmtLocalDate(d), end: today }
    }
    if (key === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1)
        return { start: fmtLocalDate(d), end: today }
    }
    return null
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function ProblemsPage() {
    const { data: perms } = usePermissions()
    const [problems, setProblems] = useState<Problem[]>([])
    const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, escalated: 0, categories: {} as Record<string, number> })
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [currentEmployee, setCurrentEmployee] = useState<{ id: string; name: string } | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [activeFilter, setActiveFilter] = useState('all')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
    const [detailForm, setDetailForm] = useState<{ priority: string; status: string; resolution_note: string }>({ priority: '', status: '', resolution_note: '' })
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
    const [logsLoading, setLogsLoading] = useState(false)
    // Date filtering (#7)
    const [dateRange, setDateRange] = useState('all')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    // Mandatory status change note
    const [pendingStatus, setPendingStatus] = useState<string | null>(null)
    const [statusChangeNote, setStatusChangeNote] = useState('')
    const toast = useToast()

    const fetchProblems = useCallback(async () => {
        try {
            let url = '/api/problems'
            const params = new URLSearchParams()
            const range = dateRange === 'custom' ? (customStart && customEnd ? { start: customStart, end: customEnd } : null) : getDateRange(dateRange)
            if (range) {
                params.set('start_date', range.start)
                params.set('end_date', range.end)
            }
            if (params.toString()) url += `?${params.toString()}`
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                // Sort by newest first (#8)
                const sorted = [...(data.problems || [])].sort((a: Problem, b: Problem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                setProblems(sorted)
                setStats(data.stats)
            }
        } catch { console.error('Failed to fetch problems') }
        finally { setLoading(false) }
    }, [dateRange, customStart, customEnd])

    useEffect(() => {
        fetchProblems()
        fetch('/api/members').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setEmployees(d)
        }).catch(() => { })
    }, [fetchProblems])

    useEffect(() => {
        if (perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin') setIsAdmin(true)
        if (perms.is_super || perms.role === 'Owner' || perms.role === 'Super Admin') setIsSuperAdmin(true)
        if (perms.employee_id) {
            fetch(`/api/members/${perms.employee_id}`).then(r => r.json()).then(emp => {
                setCurrentEmployee({ id: perms.employee_id!, name: emp?.name || 'You' })
            }).catch(() => {})
        }
    }, [perms])

    const fetchLogs = async (problemId: string) => {
        if (!isAdmin) return
        setLogsLoading(true)
        try {
            const res = await fetch(`/api/activity-log?module=problems&target_id=${problemId}`)
            if (res.ok) {
                const data = await res.json()
                setActivityLogs(data)
            }
        } catch { /* ignore */ }
        finally { setLogsLoading(false) }
    }

    const openAddModal = () => { setForm(emptyForm); setShowAddModal(true) }

    const openDetailModal = (p: Problem) => {
        setSelectedProblem(p)
        setDetailForm({ priority: p.priority, status: p.status, resolution_note: p.resolution_note || '' })
        fetchLogs(p.id)
    }

    const isFormValid = form.customer_name.trim() && form.customer_phone.trim() && form.problem_details.trim() && form.priority && form.business_name.trim() && (form.category && (form.category !== 'Custom' || form.custom_category.trim()))

    const handleSave = async () => {
        if (!isFormValid) return
        setSaving(true)
        try {
            const payload = { ...form, category: form.category === 'Custom' ? form.custom_category : form.category }
            const res = await fetch('/api/problems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            if (res.ok) { 
                const data = await res.json()
                if (data.awardedPoints && data.awardedPoints > 0) {
                    toast.success(`Awesome! You earned ${data.awardedPoints} points! 🌟`)
                }
                await fetchProblems(); 
                setShowAddModal(false) 
            }
        } catch { console.error('Save failed') }
        finally { setSaving(false) }
    }

    const handleDetailUpdate = async (updates: Record<string, unknown>) => {
        if (!selectedProblem) return
        try {
            const resUpdate = await fetch('/api/problems', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedProblem.id, ...updates }),
            })
            if (resUpdate.ok) {
                const dataUpdate = await resUpdate.json()
                if (dataUpdate.awardedPoints && dataUpdate.awardedPoints > 0) {
                    toast.success(`Awesome! You earned ${dataUpdate.awardedPoints} points! 🌟`)
                }
            } else {
                const errData = await resUpdate.json().catch(() => ({}))
                toast.error(`Update failed: ${errData.error || 'Unknown error'}`)
                return
            }
        } catch (e) {
            console.error('Update failed', e)
            toast.error("Failed to update problem details")
            return
        }
        await fetchProblems()
        const res = await fetch('/api/problems')
        if (res.ok) {
            const data = await res.json()
            const updated = data.problems.find((p: Problem) => p.id === selectedProblem.id)
            if (updated) {
                setSelectedProblem(updated)
                setDetailForm({ priority: updated.priority, status: updated.status, resolution_note: updated.resolution_note || '' })
            }
        }
        fetchLogs(selectedProblem.id)
    }

    const handleStatusChangeStart = (newStatus: string) => {
        if (newStatus === detailForm.status) return
        if (newStatus === 'resolved') {
            setDetailForm({ ...detailForm, status: 'resolved' })
            setPendingStatus(null)
            setStatusChangeNote('')
            return
        }
        setPendingStatus(newStatus)
        setStatusChangeNote('')
    }

    const handleConfirmStatusChange = async () => {
        if (!pendingStatus || !statusChangeNote.trim()) return
        setDetailForm({ ...detailForm, status: pendingStatus })
        const updates: Record<string, unknown> = { status: pendingStatus, status_note: statusChangeNote.trim() }
        if (pendingStatus === 'resolved' && detailForm.resolution_note.trim()) {
            updates.resolution_note = detailForm.resolution_note
        }
        setPendingStatus(null)
        setStatusChangeNote('')
        await handleDetailUpdate(updates)
    }

    const handleCancelStatusChange = () => {
        setPendingStatus(null)
        setStatusChangeNote('')
    }

    const handleSaveResolutionNote = async () => {
        if (!selectedProblem) return
        setSaving(true)
        await handleDetailUpdate({ resolution_note: detailForm.resolution_note, status: 'resolved' })
        setSaving(false)
        toast.success("Resolution note saved")
    }

    const handlePick = async () => {
        if (!selectedProblem || !currentEmployee) return
        const isPicked = selectedProblem.peek && (
            Array.isArray(selectedProblem.peek) ? (selectedProblem.peek as unknown as Employee[])[0]?.id === currentEmployee.id : selectedProblem.peek.id === currentEmployee.id
        )
        // Optimistic update - instantly toggle the button
        if (isPicked) {
            setSelectedProblem({ ...selectedProblem, peek: null })
            await handleDetailUpdate({ problem_peek: null })
        } else {
            setSelectedProblem({ ...selectedProblem, peek: currentEmployee as unknown as Employee, status: selectedProblem.status === 'open' ? 'in_progress' : selectedProblem.status })
            await handleDetailUpdate({ problem_peek: currentEmployee.id, status: selectedProblem.status === 'open' ? 'in_progress' : selectedProblem.status })
        }
    }

    const handleAssignSolver = async (solverId: string) => {
        if (!selectedProblem || !solverId) return
        await handleDetailUpdate({ problem_solver: solverId, status: 'in_progress' })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this problem?')) return
        const res = await fetch(`/api/problems?id=${id}`, { method: 'DELETE' })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to delete problem'); return }
        toast.success('Problem deleted')
        setSelectedProblem(null)
        await fetchProblems()
    }

    const filtered = problems.filter(p => {
        if (activeFilter === 'assigned') {
            if (!currentEmployee) return false
            const peekId = p.peek ? (Array.isArray(p.peek) ? (p.peek as unknown as Employee[])[0]?.id : p.peek.id) : null
            const solverId = p.solver ? (Array.isArray(p.solver) ? (p.solver as unknown as Employee[])[0]?.id : p.solver.id) : null
            if (peekId !== currentEmployee.id && solverId !== currentEmployee.id) return false
        } else if (activeFilter === 'all') {
            // ALL tab should show all problems (removing previous logic that hid resolved ones)
            return true
        } else if (p.status !== activeFilter) return false
        if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            const numericSearch = q.replace(/[^0-9]/g, '')
            if (!(p.problem_no || '').toLowerCase().includes(q) &&
                !(p.customer_name || '').toLowerCase().includes(q) &&
                !(p.problem_details || '').toLowerCase().includes(q) &&
                !(p.customer_phone || '').includes(q) &&
                !(numericSearch && (p.problem_no || '').includes(numericSearch))) return false
        }
        return true
    })

    const statCards = [
        { label: 'Total', value: stats.total, color: '#1E3A5F', icon: <IconClipboard size={20} color="#1E3A5F" /> },
        { label: 'Open', value: stats.open, color: '#DC2626', icon: <IconCircleDot size={20} color="#DC2626" /> },
        { label: 'In Progress', value: stats.inProgress, color: '#F59E0B', icon: <IconClock size={20} color="#F59E0B" /> },
        { label: 'Resolved', value: stats.resolved, color: '#10B981', icon: <IconCheckCircle size={20} color="#10B981" /> },
    ]

    void IconAlertCircle
    void IconArrowUpCircle

    return (
        <RequireFeature slugs={['problem-box']}>
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Problem Box</h1>
                    <p className="page-subtitle">Report, track, and resolve customer issues.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                    <IconPlus size={16} /> Report Problem
                </button>
            </motion.div>

            {/* Stats Section */}
            <motion.div variants={item} className="grid grid-4" style={{ gap: '12px', marginBottom: '24px' }}>
                {statCards.map(s => (
                    <div key={s.label} className="card" 
                        style={{ 
                            padding: '14px 16px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            justifyContent: 'space-between',
                            borderLeft: `4px solid ${s.color}`,
                            background: 'var(--color-surface)',
                            minHeight: '84px'
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{s.label}</span>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '6px', background: `${s.color}10` }}>
                                {s.icon}
                            </span>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '8px', lineHeight: 1 }}>
                            {s.value}
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* Main Content Area: 2-Column Responsive Layout */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Left Column: Filters + Problems List */}
                <div style={{ flex: '1 1 600px', minWidth: 0 }}>
                    {/* Date Range Filter (#7) */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {dateRangeOptions.map(opt => (
                        <button key={opt.key} onClick={() => setDateRange(opt.key)}
                            style={{ position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', color: dateRange === opt.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', transition: 'color 0.2s', zIndex: 1 }}>
                            {dateRange === opt.key && (
                                <motion.div layoutId="dateRangeTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
                        </button>
                    ))}
                </div>
                {dateRange === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="date" className="form-input" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ fontSize: '0.75rem', padding: '5px 8px', height: 'auto' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>to</span>
                        <input type="date" className="form-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ fontSize: '0.75rem', padding: '5px 8px', height: 'auto' }} />
                    </div>
                )}
            </motion.div>

            {/* Status + Priority + Search Filters */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {filterTabs.map(tab => (
                        <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                            style={{ position: 'relative', padding: '7px 14px', borderRadius: '8px', border: 'none', fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '-0.01em', background: 'transparent', color: activeFilter === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', transition: 'color 0.2s', zIndex: 1 }}>
                            {activeFilter === tab.key && (
                                <motion.div layoutId="problemTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>
                <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                    style={{ padding: '7px 12px', fontSize: '0.8125rem', border: '1px solid var(--color-border-light)', borderRadius: '8px', background: 'var(--color-surface)', cursor: 'pointer' }}>
                    {priorityFilterOptions.map(opt => (<option key={opt.key} value={opt.key}>{opt.label}</option>))}
                </select>
                <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                    <input className="form-input" type="text" placeholder="Search by ID, name, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '34px', height: '36px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px' }} />
                </div>
            </motion.div>

            {/* Problems List */}
            {loading ? (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0 }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div className="skeleton" style={{ width: '65%', height: 14 }} />
                                <div className="skeleton" style={{ width: '45%', height: 10 }} />
                            </div>
                            <div className="skeleton" style={{ width: 60, height: 24, borderRadius: '12px' }} />
                        </div>
                    ))}
                </motion.div>
            ) : filtered.length === 0 ? (
                <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <IconCheckCircle size={48} color="var(--color-text-tertiary)" />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>
                        {searchQuery ? 'No matching problems' : 'No problems reported'}
                    </h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                        {searchQuery ? `Nothing matching "${searchQuery}"` : 'Click "Report Problem" to log an issue.'}
                    </p>
                </motion.div>
            ) : (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filtered.map(p => {
                        // Badge fix: if solver is assigned but status is 'open', display as 'in_progress'
                        const displayStatus = (p.status === 'open' && p.solver) ? 'in_progress' : p.status
                        const sc = statusConfig[displayStatus] || statusConfig.open
                        const pc = priorityConfig[p.priority] || priorityConfig.medium
                        const peekName = p.peek ? (Array.isArray(p.peek) ? (p.peek as unknown as Employee[])[0]?.name : p.peek.name) : null
                        const solverName = p.solver ? (Array.isArray(p.solver) ? (p.solver as unknown as Employee[])[0]?.name : p.solver.name) : null
                        const isOverdue48h = p.status === 'in_progress' && (Date.now() - new Date(p.created_at).getTime()) > 48 * 3600000
                        return (
                            <motion.div key={p.id} className="card"
                                style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', background: isOverdue48h ? 'rgba(220,38,38,0.05)' : sc.bg, border: isOverdue48h ? '2px solid rgba(220,38,38,0.5)' : `1px solid ${sc.border}` }}
                                whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                                transition={{ duration: 0.2 }}
                                onClick={() => openDetailModal(p)}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: pc.color }} />
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{p.problem_no}</span>
                                            <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: `${sc.color}15` }}>{sc.label}</span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 500, color: pc.color, background: `${pc.color}15` }}>
                                                <IconCircleDot size={10} color={pc.color} /> {pc.label}
                                            </span>
                                            {p.category && (
                                                <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 500, color: CATEGORY_COLORS[p.category] || '#6B7280', background: `${CATEGORY_COLORS[p.category] || '#6B7280'}15` }}>
                                                    {p.category}
                                                </span>
                                            )}
                                            {isOverdue48h && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
                                                    ⚠ 48h+ In Progress
                                                </span>
                                            )}
                                        </div>
                                        {p.customer_name && (
                                            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>{p.customer_name}
                                                {p.customer_phone && <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)', marginLeft: '8px', fontSize: '0.8125rem' }}>{p.customer_phone}</span>}
                                            </div>
                                        )}
                                        {p.problem_details && (
                                            <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', margin: '4px 0 8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.problem_details}</p>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', flexWrap: 'wrap' }}>
                                            {/* #9: Show exact date instead of time ago */}
                                            <span>{formatDate(p.created_at)}</span>
                                            {peekName && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#F59E0B', fontWeight: 500 }}>
                                                    <IconEye size={12} color="#F59E0B" /> {peekName}
                                                </span>
                                            )}
                                            {solverName && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10B981', fontWeight: 500 }}>
                                                    <IconWrench size={12} color="#10B981" /> {solverName}
                                                </span>
                                            )}
                                            {p.solved_date && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                    <IconCheckCircle size={12} /> {new Date(p.solved_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* #10: Edit icon on right side */}
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={(e) => { e.stopPropagation(); openDetailModal(p) }}
                                        title="Edit problem"
                                        style={{ padding: '8px', color: 'var(--color-text-tertiary)', flexShrink: 0, marginTop: '4px' }}
                                    >
                                        <IconEdit size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}
                </div>

                {/* Right Column: Category Breakdown Sidebar */}
                <div style={{ flex: '0 0 300px', minWidth: '300px', position: 'sticky', top: '20px' }}>
                    <div className="card" style={{ padding: '16px 20px', background: 'var(--color-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="var(--color-text-secondary)"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            Category Breakdown
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                            {Object.entries(stats.categories || {}).filter(([key]) => key !== 'uncategorized').map(([cat, count]) => {
                                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                                const color = CATEGORY_COLORS[cat] || '#6B7280';
                                return (
                                    <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                            <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '70%' }}>{cat}</span>
                                            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{count} ({pct}%)</span>
                                        </div>
                                        <div style={{ width: '100%', height: '5px', background: 'var(--color-bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px' }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.keys(stats.categories || {}).filter(k => k !== 'uncategorized').length === 0 && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '16px 0' }}>No categorized problems</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Problem Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Report Problem</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}><IconX size={20} /></button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group"><label className="form-label">Customer Name *</label><input className="form-input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} placeholder="Name..." required /></div>
                                    <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="01XXXXXXXXX" required /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Problem Details *</label><textarea className="form-input" value={form.problem_details} onChange={e => setForm({ ...form, problem_details: e.target.value })} placeholder="Describe the issue..." rows={3} style={{ resize: 'vertical', minHeight: '80px' }} required /></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group"><label className="form-label">Priority *</label><select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Problem['priority'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
                                    <div className="form-group"><label className="form-label">Business / Page Name *</label><select className="form-input" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}><option value="">Select business</option><option value="OBM BN">OBM BN</option><option value="OBM EN">OBM EN</option><option value="Adishad">Adishad</option><option value="PGM">PGM</option><option value="Premium Shukti">Premium Shukti</option><option value="Premium Achar">Premium Achar</option></select></div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category *</label>
                                    <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value, custom_category: e.target.value !== 'Custom' ? '' : form.custom_category })}>
                                        <option value="">Select category...</option>
                                        {CATEGORY_OPTIONS.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    {form.category === 'Custom' && (
                                        <input className="form-input" value={form.custom_category} onChange={e => setForm({ ...form, custom_category: e.target.value })} placeholder="Enter custom category..." style={{ marginTop: '8px' }} required />
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !isFormValid}>{saving ? 'Saving...' : 'Report Problem'}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Problem Detail Popup */}
            <AnimatePresence>
                {selectedProblem && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProblem(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h2 className="modal-title" style={{ fontSize: '1.125rem' }}>
                                    <span style={{ fontFamily: 'monospace', color: 'var(--color-text-tertiary)', marginRight: '8px' }}>{selectedProblem.problem_no}</span>
                                    Problem Details
                                </h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedProblem(null)}><IconX size={20} /></button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Status + Priority + Pick row */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <select value={pendingStatus || detailForm.status} onChange={e => handleStatusChangeStart(e.target.value)}
                                        style={{ padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, border: `1px solid ${statusConfig[pendingStatus || detailForm.status]?.color || '#ccc'}40`, borderRadius: '8px', color: statusConfig[pendingStatus || detailForm.status]?.color, background: `${statusConfig[pendingStatus || detailForm.status]?.color || '#ccc'}10`, cursor: 'pointer' }}>
                                        <option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="escalated">Escalated</option>
                                    </select>
                                    <select value={detailForm.priority} onChange={e => { setDetailForm({ ...detailForm, priority: e.target.value }); handleDetailUpdate({ priority: e.target.value }) }}
                                        style={{ padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, border: `1px solid ${priorityConfig[detailForm.priority]?.color || '#ccc'}40`, borderRadius: '8px', color: priorityConfig[detailForm.priority]?.color, background: `${priorityConfig[detailForm.priority]?.color || '#ccc'}10`, cursor: 'pointer' }}>
                                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                                    </select>
                                    {currentEmployee && (
                                        <button className="btn btn-sm" onClick={handlePick}
                                            style={{
                                                background: selectedProblem.peek && (Array.isArray(selectedProblem.peek) ? (selectedProblem.peek as unknown as Employee[])[0]?.id === currentEmployee.id : selectedProblem.peek.id === currentEmployee.id) ? '#F59E0B' : 'var(--color-surface)',
                                                color: selectedProblem.peek && (Array.isArray(selectedProblem.peek) ? (selectedProblem.peek as unknown as Employee[])[0]?.id === currentEmployee.id : selectedProblem.peek.id === currentEmployee.id) ? 'white' : 'var(--color-text-primary)',
                                                border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '4px',
                                            }}>
                                            <IconEye size={14} />
                                            {selectedProblem.peek && (Array.isArray(selectedProblem.peek) ? (selectedProblem.peek as unknown as Employee[])[0]?.id === currentEmployee.id : selectedProblem.peek.id === currentEmployee.id) ? 'Unpick' : 'Pick'}
                                        </button>
                                    )}
                                    {/* Delete only for super admin - members cannot see this */}
                                    {isSuperAdmin && (
                                        <button className="btn btn-sm" style={{ color: '#DC2626', border: '1px solid #DC262620', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleDelete(selectedProblem.id)}>
                                            <IconTrash size={14} color="#DC2626" /> Delete
                                        </button>
                                    )}
                                </div>

                                {/* Mandatory note when changing status */}
                                {pendingStatus && (
                                    <div style={{ padding: '12px 16px', background: `${statusConfig[pendingStatus]?.color || '#3B82F6'}08`, borderRadius: '10px', border: `1px solid ${statusConfig[pendingStatus]?.color || '#3B82F6'}20`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: statusConfig[pendingStatus]?.color || 'var(--color-text-primary)' }}>
                                            Changing status to: {statusConfig[pendingStatus]?.label || pendingStatus}
                                        </div>
                                        <textarea
                                            className="form-input"
                                            value={statusChangeNote}
                                            onChange={e => setStatusChangeNote(e.target.value)}
                                            placeholder={`Why are you changing to ${statusConfig[pendingStatus]?.label}? (required)`}
                                            rows={2}
                                            style={{ resize: 'vertical', minHeight: '50px', fontSize: '0.8125rem' }}
                                            autoFocus
                                        />
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={handleCancelStatusChange} style={{ fontSize: '0.75rem' }}>Cancel</button>
                                            <button className="btn btn-primary btn-sm" onClick={handleConfirmStatusChange} disabled={!statusChangeNote.trim()} style={{ fontSize: '0.75rem' }}>Confirm Change</button>
                                        </div>
                                    </div>
                                )}

                                {/* #11: Resolution Note - shown when resolving or already resolved */}
                                {(detailForm.status === 'resolved' || selectedProblem.status === 'resolved') && (
                                    <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.04)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.15)' }}>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#10B981', textTransform: 'uppercase', marginBottom: '6px' }}>Resolution Note</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <textarea
                                                className="form-input"
                                                value={detailForm.resolution_note}
                                                onChange={e => setDetailForm({ ...detailForm, resolution_note: e.target.value })}
                                                placeholder="Add a resolution note (optional)..."
                                                rows={3}
                                                style={{ resize: 'vertical', minHeight: '60px', fontSize: '0.8125rem' }}
                                            />
                                            {detailForm.resolution_note !== (selectedProblem.resolution_note || '') && (
                                                <button className="btn btn-primary btn-sm" onClick={handleSaveResolutionNote} disabled={saving} style={{ alignSelf: 'flex-end' }}>
                                                    {saving ? 'Saving...' : 'Save & Resolve'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Customer Info */}
                                {(selectedProblem.customer_name || selectedProblem.customer_phone) && (
                                    <div style={{ padding: '12px 16px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Customer</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedProblem.customer_name || '-'}</div>
                                        {selectedProblem.customer_phone && <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{selectedProblem.customer_phone}</div>}
                                    </div>
                                )}

                                {/* Problem Details */}
                                {selectedProblem.problem_details && (
                                    <div style={{ padding: '12px 16px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Problem Details</div>
                                        <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedProblem.problem_details}</p>
                                    </div>
                                )}

                                {/* Category */}
                                {selectedProblem.category && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', background: `${CATEGORY_COLORS[selectedProblem.category] || '#6B7280'}10`, border: `1px solid ${CATEGORY_COLORS[selectedProblem.category] || '#6B7280'}20` }}>
                                        <svg width="14" height="14" viewBox="0 0 20 20" fill={CATEGORY_COLORS[selectedProblem.category] || '#6B7280'}><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: CATEGORY_COLORS[selectedProblem.category] || '#6B7280' }}>Category: {selectedProblem.category}</span>
                                    </div>
                                )}


                                {/* Assign Solver */}
                                {isAdmin && selectedProblem.status !== 'resolved' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Assign Solver:</label>
                                        <select className="form-input" style={{ fontSize: '0.8125rem', padding: '6px 10px', height: 'auto', width: '200px' }}
                                            value={(selectedProblem.solver && !Array.isArray(selectedProblem.solver)) ? selectedProblem.solver.id : ''}
                                            onChange={e => handleAssignSolver(e.target.value)}>
                                            <option value="">Select solver</option>
                                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {/* People Info */}
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    {selectedProblem.peek && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#F59E0B10', borderRadius: '8px', border: '1px solid #F59E0B20' }}>
                                            <IconEye size={14} color="#F59E0B" />
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#F59E0B' }}>Picked by: {Array.isArray(selectedProblem.peek) ? (selectedProblem.peek as unknown as Employee[])[0]?.name : selectedProblem.peek.name}</span>
                                        </div>
                                    )}
                                    {selectedProblem.solver && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#10B98110', borderRadius: '8px', border: '1px solid #10B98120' }}>
                                            <IconWrench size={14} color="#10B981" />
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#10B981' }}>Solver: {Array.isArray(selectedProblem.solver) ? (selectedProblem.solver as unknown as Employee[])[0]?.name : selectedProblem.solver.name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Admin Activity Log */}
                                {isAdmin && (
                                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '16px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Activity Log</div>
                                        {logsLoading ? (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>Loading...</div>
                                        ) : activityLogs.length === 0 ? (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>No activity recorded yet</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflow: 'auto' }}>
                                                {activityLogs.map(log => (
                                                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--color-surface)', borderRadius: '6px', fontSize: '0.75rem' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{log.details?.actor_name || log.actor?.name || '?'}</span>
                                                        <span style={{ color: 'var(--color-text-secondary)', flex: 1 }}>
                                                            {log.action === 'status_change' && (
                                                                <>
                                                                    {`changed status: ${log.old_value} → ${log.new_value}`}
                                                                    {log.details?.status_note && (
                                                                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic', marginTop: '2px' }}>
                                                                            &quot;{log.details?.status_note}&quot;
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                            {log.action === 'priority_change' && `changed priority: ${log.old_value} → ${log.new_value}`}
                                                            {log.action === 'pick' && `picked this problem`}
                                                            {log.action === 'unpick' && `unpicked this problem`}
                                                            {log.action === 'solve' && `solved this problem (+10 pts)`}
                                                            {log.action === 'created' && `reported this problem (+5 pts)`}
                                                            {!KNOWN_PROBLEM_ACTIONS.includes(log.action) && describeUnknownAction(log)}
                                                        </span>
                                                        <span style={{ marginLeft: 'auto', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{formatDate(log.created_at)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
        </RequireFeature>
    )
}
