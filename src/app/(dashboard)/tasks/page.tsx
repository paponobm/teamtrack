'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import RequireFeature from '@/components/common/RequireFeature'
import { usePermissions } from '@/lib/PermissionsContext'
import DailyWorkReport from '@/components/work-reports/DailyWorkReport'

interface TaskAssignment {
    id: string
    status: 'pending' | 'accepted' | 'rejected'
    assigned_at: string
    responded_at: string | null
    employee: { id: string; name: string; employee_id: string; avatar_url?: string | null } | null
}

interface Task {
    id: string
    title: string
    description: string | null
    due_date: string | null
    priority: 'low' | 'medium' | 'high' | 'urgent'
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'rejected'
    created_by: string
    creator: { id: string; name: string; employee_id: string } | null
    task_assignments: TaskAssignment[]
    task_no: string | null
    created_at: string
}

interface Employee {
    id: string
    name: string
    employee_id: string
    avatar_url?: string | null
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

const priorityConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: '#DC2626' },
    high: { label: 'High', color: '#F59E0B' },
    medium: { label: 'Medium', color: '#3B82F6' },
    low: { label: 'Low', color: '#6B7280' },
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    completed: { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
    cancelled: { label: 'Cancelled', color: '#6B7280', bg: 'rgba(107,114,128,0.08)' },
    rejected: { label: 'Rejected', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
}

const assignmentStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Awaiting', color: '#F59E0B' },
    accepted: { label: 'Accepted', color: '#10B981' },
    rejected: { label: 'Rejected', color: '#DC2626' },
}

const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'my_tasks', label: 'My Tasks' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'Active' },
    { key: 'completed', label: 'Completed' },
]

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#7C3AED', '#DC2626', '#10B981', '#F59E0B', '#EC4899', '#1E3A5F', '#6366F1']
    return colors[name.charCodeAt(0) % colors.length]
}

const dateRangeOptions = [
     { key: 'today', label: 'Today' },
    { key: 'all', label: 'All Time' },
   
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
]

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

const emptyForm = { titles: [{ id: 'init', val: '' }], description: '', due_date: '', priority: 'medium', assignee_ids: [] as string[] }

export default function TasksPage() {
    const { data: perms } = usePermissions()
    const [activeMainTab, setActiveMainTab] = useState<'tasks' | 'reports'>('tasks')
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [activeFilter, setActiveFilter] = useState('all')
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [descRows, setDescRows] = useState<{ id: string; val: string }[]>([{ id: 'desc-init', val: '' }])
    const [saving, setSaving] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [assigneeSearch, setAssigneeSearch] = useState('')
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
    const [logsLoading, setLogsLoading] = useState(false)
    const toast = useToast()

    const [searchQuery, setSearchQuery] = useState('')
    const [filterEmployeeId, setFilterEmployeeId] = useState('')
    const [dateRange, setDateRange] = useState('today')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    const fetchTasks = useCallback(async () => {
        try {
            let url = '/api/tasks'
            const params = new URLSearchParams()
            const range = dateRange === 'custom' ? (customStart && customEnd ? { start: customStart, end: customEnd } : null) : getDateRange(dateRange)
            if (range) {
                params.append('start_date', range.start)
                params.append('end_date', range.end)
            }
            if (params.toString()) url += `?${params.toString()}`

            const res = await fetch(url)
            if (res.ok) {
                const fresh = await res.json()
                setTasks(fresh)
                window.dispatchEvent(new CustomEvent('tasks-updated'))
                return fresh as Task[]
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
        return null
    }, [dateRange, customStart, customEnd])

    useEffect(() => {
        fetchTasks()
        fetch('/api/members').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setEmployees(d)
        }).catch(() => { })
    }, [fetchTasks])

    useEffect(() => {
        if (perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin') setIsAdmin(true)
        if (perms.is_super || perms.role === 'Owner' || perms.role === 'Super Admin') setIsSuperAdmin(true)
        if (perms.employee_id) setCurrentEmployeeId(perms.employee_id)
    }, [perms])

    const fetchLogs = async (taskId: string) => {
        if (!isAdmin) return
        setLogsLoading(true)
        try {
            const res = await fetch(`/api/activity-log?module=tasks&target_id=${taskId}`)
            if (res.ok) setActivityLogs(await res.json())
        } catch { /* ignore */ }
        finally { setLogsLoading(false) }
    }

    const handleTitleChange = (id: string, val: string) => {
        setForm(prev => ({ ...prev, titles: prev.titles.map(t => t.id === id ? { ...t, val } : t) }))
    }

    const handleAddTitleRow = () => {
        setForm(prev => ({ ...prev, titles: [...prev.titles, { id: Math.random().toString(), val: '' }] }))
    }

    const handleRemoveTitleRow = (id: string) => {
        setForm(prev => {
            const next = prev.titles.filter(t => t.id !== id)
            return { ...prev, titles: next.length === 0 ? [{ id: Math.random().toString(), val: '' }] : next }
        })
    }

    // Description rows: numbered list of single-line inputs, same pattern as the Tasks
    // rows above it. form.description itself stays a single string (unchanged shape for
    // the API/backend) — these rows just get joined as "1. ...\n2. ..." into it.
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

    const handleRemoveDescRow = (id: string) => {
        setDescRows(prev => {
            const next = prev.filter(r => r.id !== id)
            const finalRows = next.length === 0 ? [{ id: Math.random().toString(), val: '' }] : next
            syncDescription(finalRows)
            return finalRows
        })
    }

    const handleSave = async () => {
        const validTitles = form.titles.filter(t => t.val.trim().length > 0)
        if (validTitles.length === 0) return
        setSaving(true)
        try {
            for (const t of validTitles) {
                const res = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, title: t.val.trim() }),
                })
                if (!res.ok) {
                    const data = await res.json()
                    alert(data.error || `Failed to create task: ${t.val}`)
                }
            }
            await fetchTasks()
            setShowModal(false)
            setForm(emptyForm)
            setDescRows([{ id: Math.random().toString(), val: '' }])
        } catch { alert('Failed to create tasks') }
        finally { setSaving(false) }
    }

    const handleStatusChange = async (taskId: string, status: string) => {
        const res = await fetch('/api/tasks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: taskId, status }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            toast.error(err.error || 'Failed to update task')
            return
        }
        const data = await res.json()
        if (data.awardedPoints && data.awardedPoints > 0) {
            toast.success(`Awesome! You earned ${data.awardedPoints} points! 🌟`)
        }
        const fresh = await fetchTasks()
        if (selectedTask?.id === taskId) {
            // Re-derive the modal task from the freshly-fetched list (not the stale closure)
            const updated = (fresh || []).find(t => t.id === taskId)
            if (updated) setSelectedTask(updated)
            fetchLogs(taskId)
        }
    }

    const handleAssignmentResponse = async (taskId: string, response: 'accepted' | 'rejected') => {
        const res = await fetch('/api/tasks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: taskId, assignment_response: response }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            toast.error(err.error || 'Failed to respond to task')
            return
        }
        toast.success(response === 'accepted' ? 'Task accepted' : 'Task declined')
        await fetchTasks()
        setSelectedTask(null)
    }

    const handleDelete = async (taskId: string) => {
        if (!confirm('Delete this task?')) return
        const res = await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' })
        if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || 'Failed to delete task'); return }
        toast.success('Task deleted')
        setSelectedTask(null)
        await fetchTasks()
    }

    const toggleAssignee = (empId: string) => {
        setForm(prev => ({
            ...prev,
            assignee_ids: prev.assignee_ids.includes(empId)
                ? prev.assignee_ids.filter(id => id !== empId)
                : [...prev.assignee_ids, empId],
        }))
    }

    const filtered = tasks.filter(t => {
        // Members only see their own tasks; admins see all (except when 'my_tasks' selected)
        if (activeFilter === 'my_tasks' && currentEmployeeId) {
            const isAssigned = t.task_assignments.some(a => {
                const empId = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.id : a.employee.id) : null
                return empId === currentEmployeeId
            })
            if (!isAssigned) return false
        } else if (!isAdmin && currentEmployeeId) {
            const isAssigned = t.task_assignments.some(a => {
                const empId = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.id : a.employee.id) : null
                return empId === currentEmployeeId
            })
            if (!isAssigned) return false
        }
        if (activeFilter !== 'all' && activeFilter !== 'my_tasks' && t.status !== activeFilter) return false

        // Employee filter (admin-only UI, but harmless to apply regardless)
        if (filterEmployeeId) {
            const isAssignedToFilter = t.task_assignments.some(a => {
                const empId = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.id : a.employee.id) : null
                return empId === filterEmployeeId
            })
            if (!isAssignedToFilter) return false
        }

        // Search query filter (title, description, task_no)
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            const taskNo = t.task_no ? t.task_no.toLowerCase() : ''
            const title = t.title.toLowerCase()
            const desc = (t.description || '').toLowerCase()
            if (!title.includes(q) && !desc.includes(q) && !taskNo.includes(q)) return false
        }

        return true
    })

    const myPendingTasks = tasks.filter(t =>
        t.task_assignments.some(a =>
            a.employee && (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.id : a.employee.id) === currentEmployeeId && a.status === 'pending'
        )
    )

    // Base list respecting member scope (before status filter)
    const scopedTasks = tasks.filter(t => {
        if (!isAdmin && currentEmployeeId) {
            return t.task_assignments.some(a => {
                const empId = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.id : a.employee.id) : null
                return empId === currentEmployeeId
            })
        }
        return true
    })

    const stats = {
        total: scopedTasks.length,
        pending: scopedTasks.filter(t => t.status === 'pending').length,
        active: scopedTasks.filter(t => t.status === 'in_progress').length,
        completed: scopedTasks.filter(t => t.status === 'completed').length,
    }

    return (
        <RequireFeature slugs={['tasks']}>
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Task Manager
                        {myPendingTasks.length > 0 && (
                            <span style={{ background: '#DC2626', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                                {myPendingTasks.length} pending
                            </span>
                        )}
                    </h1>
                    <p className="page-subtitle">Manage and track team assignments.</p>
                </div>
                {isAdmin && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyForm); setDescRows([{ id: Math.random().toString(), val: '' }]); setShowModal(true) }}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Create Task
                    </button>
                )}
            </motion.div>

            {/* Tabs */}
            <motion.div variants={item} style={{ marginBottom: '24px' }}>
                <div className="tabs" style={{ display: 'inline-flex', background: 'var(--color-bg-primary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                    <button
                        className={`tab-btn ${activeMainTab === 'tasks' ? 'active' : ''}`}
                        onClick={() => setActiveMainTab('tasks')}
                        style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeMainTab === 'tasks' ? '#fff' : 'var(--color-text-secondary)', background: activeMainTab === 'tasks' ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Task Management
                    </button>
                    <button
                        className={`tab-btn ${activeMainTab === 'reports' ? 'active' : ''}`}
                        onClick={() => setActiveMainTab('reports')}
                        style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeMainTab === 'reports' ? '#fff' : 'var(--color-text-secondary)', background: activeMainTab === 'reports' ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Daily Work Report
                    </button>
                </div>
            </motion.div>

            {activeMainTab === 'reports' ? (
                <DailyWorkReport />
            ) : (
            <>
            {/* Stats */}
            <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                    { label: 'Total', value: stats.total, color: '#1E3A5F' },
                    { label: 'Pending', value: stats.pending, color: '#F59E0B' },
                    { label: 'Active', value: stats.active, color: '#3B82F6' },
                    { label: 'Completed', value: stats.completed, color: '#10B981' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.label}</div>
                    </div>
                ))}
            </motion.div>

            {/* Date Range Filter */}
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

            {/* Filter and Search Bar */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ display: 'inline-flex', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px', flexShrink: 0 }}>
                    {filterTabs.map(tab => (
                        <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                            style={{ position: 'relative', padding: '7px 16px', borderRadius: '8px', border: 'none', fontSize: '0.8125rem', fontWeight: 500, background: 'transparent', color: activeFilter === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', zIndex: 1 }}>
                            {activeFilter === tab.key && (
                                <motion.div layoutId="taskTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Employee filter — see one employee's task updates across the list */}
                {isAdmin && (
                    <select
                        className="form-input"
                        value={filterEmployeeId}
                        onChange={e => setFilterEmployeeId(e.target.value)}
                        style={{ width: '170px', height: '36px', fontSize: '0.8125rem', flexShrink: 0 }}
                    >
                        <option value="">All Employees</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                    </select>
                )}

                {/* Text Search */}
                <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                    <div style={{ position: 'relative' }}>
                        <svg width="15" height="15" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                paddingLeft: '34px',
                                height: '36px',
                                fontSize: '0.8125rem',
                                background: 'rgba(118, 118, 128, 0.08)',
                                border: 'none',
                                borderRadius: '10px',
                                outline: 'none',
                                transition: 'box-shadow 0.2s ease',
                                width: '100%',
                            }}
                            onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)'}
                            onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Tasks List */}
            {loading ? (
                <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="skeleton" style={{ width: '60%', height: 16 }} />
                            <div className="skeleton" style={{ width: '40%', height: 12 }} />
                        </div>
                    ))}
                </motion.div>
            ) : filtered.length === 0 ? (
                <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <svg width="48" height="48" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ margin: '0 auto 16px', display: 'block' }}>
                        <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
                    </svg>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>No tasks</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                        {isAdmin ? 'Click "Create Task" to get started.' : 'No tasks assigned yet.'}
                    </p>
                </motion.div>
            ) : (
                <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                    {filtered.map(task => {
                        const sc = statusConfig[task.status] || statusConfig.pending
                        const pc = priorityConfig[task.priority] || priorityConfig.medium
                        const isOverdue = task.due_date && new Date(task.due_date + 'T23:59:59') < new Date() && task.status !== 'completed'
                        const myAssignment = task.task_assignments.find(a => {
                            const aEmp = a.employee
                            return aEmp && (Array.isArray(aEmp) ? (aEmp as unknown as Employee[])[0]?.id : aEmp.id) === currentEmployeeId
                        })

                        return (
                            <motion.div key={task.id} className="card"
                                style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden', border: isOverdue ? '1px solid rgba(220,38,38,0.3)' : undefined, background: isOverdue ? 'rgba(220,38,38,0.03)' : undefined }}
                                whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                                onClick={() => { setSelectedTask(task); fetchLogs(task.id) }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: pc.color }} />
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                                                {task.task_no && (
                                                    <span style={{ color: '#2563EB', marginRight: '6px', fontFamily: 'monospace', fontWeight: 700 }}>
                                                        {task.task_no}
                                                    </span>
                                                )}
                                                {task.title}
                                            </h3>
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: sc.bg }}>{sc.label}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 500, color: pc.color, background: `${pc.color}15` }}>{pc.label}</span>
                                            {isOverdue && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#DC2626' }}>OVERDUE</span>}
                                            {myAssignment?.status === 'pending' && (
                                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: '#fff', background: '#F59E0B' }}>Action Required</span>
                                            )}
                                        </div>
                                        {task.description && (
                                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0 0 8px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{task.description}</p>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                            {task.due_date && (
                                                <span style={{ color: isOverdue ? '#DC2626' : undefined, fontWeight: isOverdue ? 600 : undefined }}>
                                                    Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                            <span>{new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                                                {task.task_assignments.length} assigned
                                            </span>
                                        </div>
                                    </div>
                                    {/* Assignee avatars */}
                                    <div style={{ display: 'flex', gap: '-8px' }}>
                                        {task.task_assignments.slice(0, 3).map((a, i) => {
                                            const empName = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.name : a.employee.name) : '?'
                                            const asc = assignmentStatusConfig[a.status]
                                            return (
                                                <div key={a.id} style={{
                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                    background: getAvatarColor(empName || '?'),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontSize: '0.5625rem', fontWeight: 600,
                                                    border: `2px solid ${asc?.color || '#ccc'}`,
                                                    marginLeft: i > 0 ? '-8px' : '0',
                                                    position: 'relative', zIndex: 3 - i, overflow: 'hidden',
                                                }} title={`${empName} - ${asc?.label || 'Unknown'}`}>
                                                    {(() => { const empAvatar = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.avatar_url : (a.employee as any)?.avatar_url) : null; return empAvatar ? <img src={empAvatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (empName || '?')[0]; })()}
                                                </div>
                                            )
                                        })}
                                        {task.task_assignments.length > 3 && (
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5625rem', fontWeight: 600, border: '2px solid var(--color-border-light)', marginLeft: '-8px', zIndex: 0, color: 'var(--color-text-tertiary)' }}>
                                                +{task.task_assignments.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}
            </>
            )}

            {/* Task Detail Modal */}
            <AnimatePresence>
                {selectedTask && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTask(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {selectedTask.task_no && (
                                        <span style={{ color: '#2563EB', fontFamily: 'monospace', fontWeight: 700 }}>
                                            {selectedTask.task_no}
                                        </span>
                                    )}
                                    {selectedTask.title}
                                </h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTask(null)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Status + Priority */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {isAdmin ? (
                                        <select value={selectedTask.status} onChange={e => handleStatusChange(selectedTask.id, e.target.value)}
                                            style={{ padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, border: `1px solid ${statusConfig[selectedTask.status]?.color || '#ccc'}40`, borderRadius: '8px', color: statusConfig[selectedTask.status]?.color, background: statusConfig[selectedTask.status]?.bg, cursor: 'pointer' }}>
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    ) : (
                                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, color: statusConfig[selectedTask.status]?.color, background: statusConfig[selectedTask.status]?.bg }}>
                                            {statusConfig[selectedTask.status]?.label}
                                        </span>
                                    )}
                                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, color: priorityConfig[selectedTask.priority]?.color, background: `${priorityConfig[selectedTask.priority]?.color}15` }}>
                                        {priorityConfig[selectedTask.priority]?.label}
                                    </span>
                                    {selectedTask.due_date && (
                                        <span style={{ fontSize: '0.8125rem', color: new Date(selectedTask.due_date + 'T23:59:59') < new Date() && selectedTask.status !== 'completed' ? '#DC2626' : 'var(--color-text-tertiary)' }}>
                                            Due: {new Date(selectedTask.due_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </span>
                                    )}
                                    {/* Member Complete button - only for accepted assignees */}
                                    {!isAdmin && selectedTask.status !== 'completed' && currentEmployeeId && selectedTask.task_assignments.some(a => {
                                        const empId = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.id : a.employee.id) : null
                                        return empId === currentEmployeeId && a.status === 'accepted'
                                    }) && (
                                        <button className="btn btn-sm" onClick={() => handleStatusChange(selectedTask.id, 'completed')}
                                            style={{ background: '#10B981', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            Mark Complete
                                        </button>
                                    )}
                                    {isSuperAdmin && (
                                        <button className="btn btn-sm" style={{ color: '#DC2626', border: '1px solid #DC262620', marginLeft: 'auto' }} onClick={() => handleDelete(selectedTask.id)}>
                                            Delete
                                        </button>
                                    )}
                                </div>

                                {/* Description */}
                                {selectedTask.description && (
                                    <div style={{ padding: '12px 16px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Description</div>
                                        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedTask.description}</p>
                                    </div>
                                )}

                                {/* Assignees */}
                                <div>
                                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                        Assignments ({selectedTask.task_assignments.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {selectedTask.task_assignments.map(a => {
                                            const empName = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.name : a.employee.name) : 'Unknown'
                                            const empId = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.id : a.employee.id) : null
                                            const asc = assignmentStatusConfig[a.status]
                                            const isMe = empId === currentEmployeeId
                                            return (
                                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: isMe ? 'rgba(37,99,235,0.04)' : 'var(--color-surface)', borderRadius: '8px', border: isMe ? '1px solid rgba(37,99,235,0.2)' : '1px solid var(--color-border-light)' }}>
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: getAvatarColor(empName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.625rem', fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
                                                        {(() => { const empAvatar = a.employee ? (Array.isArray(a.employee) ? (a.employee as unknown as Employee[])[0]?.avatar_url : (a.employee as any)?.avatar_url) : null; return empAvatar ? <img src={empAvatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : empName[0]; })()}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{empName} {isMe && <span style={{ fontSize: '0.6875rem', color: '#2563EB' }}>(You)</span>}</div>
                                                    </div>
                                                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: asc?.color, background: `${asc?.color}15` }}>
                                                        {asc?.label}
                                                    </span>
                                                    {/* Accept/Reject buttons for my pending assignment */}
                                                    {isMe && a.status === 'pending' && (
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button className="btn btn-sm" style={{ background: '#10B981', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '0.6875rem' }} onClick={(e) => { e.stopPropagation(); handleAssignmentResponse(selectedTask.id, 'accepted') }}>
                                                                Accept
                                                            </button>
                                                            <button className="btn btn-sm" style={{ background: '#DC2626', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '0.6875rem' }} onClick={(e) => { e.stopPropagation(); handleAssignmentResponse(selectedTask.id, 'rejected') }}>
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Meta */}
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                                    Created by {selectedTask.creator ? (Array.isArray(selectedTask.creator) ? (selectedTask.creator as unknown as Employee[])[0]?.name : selectedTask.creator.name) : 'Unknown'} on {new Date(selectedTask.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
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
                                                    <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 10px', background: 'var(--color-surface)', borderRadius: '6px', fontSize: '0.75rem' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', flexShrink: 0 }}>{log.details?.actor_name || log.actor?.name || '?'}</span>
                                                        <span style={{ color: 'var(--color-text-secondary)', flex: 1 }}>
                                                            {log.action === 'task_created' && 'created this task'}
                                                            {log.action === 'task_accepted' && <><span style={{ color: '#10B981', fontWeight: 500 }}>accepted</span> this task (+5 pts)</>}
                                                            {log.action === 'task_rejected' && <><span style={{ color: '#DC2626', fontWeight: 500 }}>rejected</span> this task</>}
                                                            {log.action === 'task_completed' && <><span style={{ color: '#10B981', fontWeight: 500 }}>completed</span> this task (+5 pts)</>}
                                                            {log.action === 'status_change' && `changed status: ${log.old_value} → ${log.new_value}`}
                                                        </span>
                                                        <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                                                            {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </span>
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

            {/* Create Task Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Create Task</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label className="form-label" style={{ marginBottom: 0 }}>Tasks *</label>
                                    <AnimatePresence initial={false}>
                                        {form.titles.map((item, i) => (
                                            <motion.div 
                                                key={item.id} 
                                                initial={{ opacity: 0, height: 0, y: -10 }}
                                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                                transition={{ duration: 0.2 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                            >
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0 }}>
                                                    {i + 1}
                                                </div>
                                                <input 
                                                    type="text" 
                                                    className="form-input" 
                                                    placeholder="Task title..."
                                                    value={item.val}
                                                    onChange={e => handleTitleChange(item.id, e.target.value)}
                                                    style={{ flex: 1 }}
                                                    disabled={saving}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && item.val.trim()) {
                                                            e.preventDefault()
                                                            if (i === form.titles.length - 1) handleAddTitleRow()
                                                        }
                                                    }}
                                                />
                                                {form.titles.length > 1 && (
                                                    <button onClick={() => handleRemoveTitleRow(item.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, padding: '6px' }}>
                                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                    </button>
                                                )}
                                                {i === form.titles.length - 1 && (
                                                    <button onClick={handleAddTitleRow} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)', flexShrink: 0, padding: '6px' }}>
                                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                                    </button>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label className="form-label" style={{ marginBottom: 0 }}>Description</label>
                                    <AnimatePresence initial={false}>
                                        {descRows.map((row, i) => (
                                            <motion.div
                                                key={row.id}
                                                initial={{ opacity: 0, height: 0, y: -10 }}
                                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                                transition={{ duration: 0.2 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                            >
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0 }}>
                                                    {i + 1}
                                                </div>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Details..."
                                                    value={row.val}
                                                    onChange={e => handleDescRowChange(row.id, e.target.value)}
                                                    style={{ flex: 1 }}
                                                    disabled={saving}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && row.val.trim()) {
                                                            e.preventDefault()
                                                            if (i === descRows.length - 1) handleAddDescRow()
                                                        }
                                                    }}
                                                />
                                                {descRows.length > 1 && (
                                                    <button onClick={() => handleRemoveDescRow(row.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, padding: '6px' }}>
                                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                    </button>
                                                )}
                                                {i === descRows.length - 1 && (
                                                    <button onClick={handleAddDescRow} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)', flexShrink: 0, padding: '6px' }}>
                                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                                    </button>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Due Date</label>
                                        <input className="form-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Assign To</label>
                                    {/* Selected members as chips */}
                                    {form.assignee_ids.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                                            {form.assignee_ids.map(id => {
                                                const emp = employees.find(e => e.id === id)
                                                return emp ? (
                                                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 6px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500, background: '#2563EB15', color: '#2563EB', border: '1px solid #2563EB25' }}>
                                                        <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: getAvatarColor(emp.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 700, flexShrink: 0 }}>{emp.name[0]}</span>
                                                        {emp.name}
                                                        <button onClick={() => toggleAssignee(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', lineHeight: 1 }}>
                                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="#2563EB"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                        </button>
                                                    </span>
                                                ) : null
                                            })}
                                        </div>
                                    )}
                                    {/* Search input */}
                                    <input
                                        className="form-input"
                                        type="text"
                                        placeholder="Search members..."
                                        value={assigneeSearch}
                                        onChange={e => setAssigneeSearch(e.target.value)}
                                        style={{ fontSize: '0.8125rem', marginBottom: '6px' }}
                                    />
                                    {/* Select All / Deselect All */}
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                                        <button type="button" onClick={() => setForm({ ...form, assignee_ids: employees.map(e => e.id) })}
                                            style={{ padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 500, border: '1px solid var(--color-border-light)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                            Select All
                                        </button>
                                        {form.assignee_ids.length > 0 && (
                                            <button type="button" onClick={() => setForm({ ...form, assignee_ids: [] })}
                                                style={{ padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 500, border: '1px solid var(--color-border-light)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>
                                                Deselect All
                                            </button>
                                        )}
                                    </div>
                                    {/* Member list */}
                                    <div style={{ maxHeight: '180px', overflow: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '8px', background: 'var(--color-surface)' }}>
                                        {employees
                                            .filter(emp => !assigneeSearch || emp.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                                            .map(emp => {
                                                const isSelected = form.assignee_ids.includes(emp.id)
                                                return (
                                                    <div key={emp.id}
                                                        onClick={() => toggleAssignee(emp.id)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                                                            cursor: 'pointer', transition: 'background 0.15s',
                                                            background: isSelected ? 'rgba(37,99,235,0.06)' : 'transparent',
                                                            borderBottom: '1px solid var(--color-border-light)',
                                                        }}
                                                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.02)' }}
                                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'rgba(37,99,235,0.06)' : 'transparent' }}
                                                    >
                                                        <div style={{
                                                            width: '16px', height: '16px', borderRadius: '4px', border: isSelected ? '2px solid #2563EB' : '2px solid var(--color-border-light)',
                                                            background: isSelected ? '#2563EB' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s',
                                                        }}>
                                                            {isSelected && <svg width="10" height="10" viewBox="0 0 20 20" fill="#fff"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                                        </div>
                                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: getAvatarColor(emp.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5625rem', fontWeight: 600, flexShrink: 0 }}>
                                                            {emp.name[0]}
                                                        </div>
                                                        <span style={{ fontSize: '0.8125rem', fontWeight: isSelected ? 600 : 400, color: isSelected ? '#2563EB' : 'var(--color-text-primary)' }}>{emp.name}</span>
                                                    </div>
                                                )
                                            })}
                                        {employees.filter(emp => !assigneeSearch || emp.name.toLowerCase().includes(assigneeSearch.toLowerCase())).length === 0 && (
                                            <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>No members found</div>
                                        )}
                                    </div>
                                    {form.assignee_ids.length > 0 && (
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                                            {form.assignee_ids.length} member(s) selected
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.titles.some(t => t.val.trim().length > 0)}>
                                    {saving ? 'Creating...' : 'Create Tasks'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
        </RequireFeature>
    )
}
