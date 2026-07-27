'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AttendanceModal from '@/components/attendance/AttendanceModal'
import AdminLeaves from '@/components/attendance/AdminLeaves'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { formatLongDate } from '@/lib/format'

interface AttendanceRecord {
    id: string
    employee_id: string
    date: string
    clock_in: string | null
    clock_out: string | null
    status: string
    notes: string | null
    employee: {
        id: string
        name: string
        employee_id: string
        designation: string
        avatar_url: string | null
        department: { id: string; name: string } | null
    }
}

interface ActivityLog {
    id: string
    actor_id: string
    action: string
    old_value: string | null
    new_value: string | null
    details: { actor_name?: string; changes?: string[] } | null
    created_at: string
}

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const item = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

function formatTime(ts: string | null) {
    if (!ts) return '-'
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function getDuration(clockIn: string | null, clockOut: string | null) {
    if (!clockIn || !clockOut) return '-'
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    if (diff <= 0) return '-'
    const hrs = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    return `${hrs}h ${mins}m`
}

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

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Local (not UTC) YYYY-MM-DD — avoids showing "yesterday" in the evening for UTC+ users.
const getLocalDateString = (d: Date = new Date()) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export default function AttendancePage() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [date, setDate] = useState(() => getLocalDateString())
    const [showModal, setShowModal] = useState(false)
    const [clockingOutId, setClockingOutId] = useState<string | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [markingLeaveId, setMarkingLeaveId] = useState<string | null>(null)
    const [leaveReason, setLeaveReason] = useState('')
    const [showLeaveModal, setShowLeaveModal] = useState(false)
    const [leaveTargetRecord, setLeaveTargetRecord] = useState<AttendanceRecord | null>(null)
    const [activeTab, setActiveTab] = useState<'attendance' | 'leaves'>('attendance')

    // Standalone leave modal
    const [showStandaloneLeave, setShowStandaloneLeave] = useState(false)
    const [allMembers, setAllMembers] = useState<{ id: string; name: string; employee_id: string; designation: string; avatar_url: string | null }[]>([])
    const [slMemberId, setSlMemberId] = useState('')
    const [slDate, setSlDate] = useState('')
    const [slEndDate, setSlEndDate] = useState('')
    const [slLeaveMode, setSlLeaveMode] = useState<'one_day' | 'range'>('one_day')
    const [slReason, setSlReason] = useState('')
    const [slSaving, setSlSaving] = useState(false)
    const [slSearch, setSlSearch] = useState('')

    // Manual Point Modal
    const [pointModalRecord, setPointModalRecord] = useState<AttendanceRecord | null>(null)
    const [pointAmount, setPointAmount] = useState(5)
    const [pointReason, setPointReason] = useState('')
    const [pointSaving, setPointSaving] = useState(false)

    // Edit modal
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)
    const [editForm, setEditForm] = useState({ clock_in: '', clock_out: '', status: '', notes: '' })
    const [editSaving, setEditSaving] = useState(false)
    const [editLogs, setEditLogs] = useState<ActivityLog[]>([])
    const [editLogsLoading, setEditLogsLoading] = useState(false)
    const [deletingAttId, setDeletingAttId] = useState<string | null>(null)

    // Stat card detail view
    const [viewingStatus, setViewingStatus] = useState<string | null>(null)

    const fetchAttendance = useCallback(async () => {
        setLoading(true)
        const res = await fetch(`/api/attendance?date=${date}`)
        const data = await res.json()
        if (Array.isArray(data)) setRecords(data)
        setLoading(false)
    }, [date])

    useEffect(() => { fetchAttendance() }, [fetchAttendance])

    useEffect(() => {
        // Fetch all members for standalone leave
        fetch('/api/members').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setAllMembers(d.map((m: { id: string; name: string; employee_id: string; designation: string; avatar_url: string | null }) => ({ id: m.id, name: m.name, employee_id: m.employee_id, designation: m.designation, avatar_url: m.avatar_url || null })))
        }).catch(() => { })
    }, [])

    useEffect(() => {
        if (perms.is_super || perms.is_admin) setIsAdmin(true)
        if (perms.is_super) setIsSuperAdmin(true)
    }, [perms])

    const navigateDate = (dir: number) => {
        const d = new Date(date + 'T00:00:00')
        d.setDate(d.getDate() + dir)
        setDate(d.toISOString().split('T')[0])
    }

    const isToday = date === getLocalDateString()

    const handleClockOut = async (record: AttendanceRecord) => {
        setClockingOutId(record.id)
        const now = new Date().toISOString()
        const res = await fetch(`/api/attendance/${record.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clock_out: now }),
        })
        setClockingOutId(null)
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to clock out'); return }
        fetchAttendance()
    }

    // On Leave toggle (#15)
    const openLeaveModal = (record: AttendanceRecord) => {
        setLeaveTargetRecord(record)
        setLeaveReason('')
        setShowLeaveModal(true)
    }

    const handleMarkLeave = async () => {
        if (!leaveTargetRecord) return
        setMarkingLeaveId(leaveTargetRecord.id)
        try {
            // Update attendance status to leave
            const res1 = await fetch(`/api/attendance/${leaveTargetRecord.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'leave', notes: leaveReason || 'On Leave', clock_in: null, clock_out: null }),
            })
            // Auto-create leave record + notice (#16)
            const res2 = await fetch('/api/leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: leaveTargetRecord.employee_id,
                    date: date,
                    reason: leaveReason || 'Personal',
                    auto_notice: true,
                }),
            })
            if (!res1.ok || !res2.ok) {
                toast.error('Failed to mark leave. Please try again.')
                setMarkingLeaveId(null)
                return // keep the modal open so the admin knows it didn't save
            }
            toast.success('Leave marked')
        } catch {
            toast.error('Failed to mark leave. Please try again.')
            setMarkingLeaveId(null)
            return
        }
        setMarkingLeaveId(null)
        setShowLeaveModal(false)
        setLeaveTargetRecord(null)
        fetchAttendance()
    }

    // Standalone leave handler
    const handleStandaloneLeave = async () => {
        if (!slMemberId || !slDate) return
        setSlSaving(true)
        try {
            // Build list of dates
            const dates: string[] = []
            if (slLeaveMode === 'range' && slEndDate && slEndDate >= slDate) {
                const start = new Date(slDate + 'T00:00:00')
                const end = new Date(slEndDate + 'T00:00:00')
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    dates.push(d.toISOString().split('T')[0])
                }
            } else {
                dates.push(slDate)
            }

            let anyFailed = false
            for (const leaveDate of dates) {
                // Upsert attendance as leave
                const r1 = await fetch('/api/attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: slMemberId, date: leaveDate, status: 'leave', notes: slReason || 'On Leave' }),
                })
                // Create leave record + auto-notice
                const r2 = await fetch('/api/leave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: slMemberId, date: leaveDate, reason: slReason || 'Personal', auto_notice: true }),
                })
                if (!r1.ok || !r2.ok) anyFailed = true
            }
            if (anyFailed) {
                toast.error('Some leave days could not be saved. Please review and try again.')
                setSlSaving(false)
                return // keep the modal open
            }
            toast.success('Leave recorded')
        } catch {
            toast.error('Failed to record leave. Please try again.')
            setSlSaving(false)
            return
        }
        {
            setSlSaving(false)
            setShowStandaloneLeave(false)
            setSlMemberId('')
            setSlDate('')
            setSlEndDate('')
            setSlLeaveMode('one_day')
            setSlReason('')
            setSlSearch('')
            fetchAttendance()
        }
    }

    const openEditModal = (record: AttendanceRecord) => {
        setEditingRecord(record)
        setEditForm({
            clock_in: record.clock_in ? new Date(record.clock_in).toTimeString().slice(0, 5) : '',
            clock_out: record.clock_out ? new Date(record.clock_out).toTimeString().slice(0, 5) : '',
            status: record.status,
            notes: record.notes || '',
        })
        // Fetch activity logs for this record
        if (isAdmin) {
            setEditLogsLoading(true)
            fetch(`/api/activity-log?module=attendance&target_id=${record.id}`)
                .then(r => r.json())
                .then(d => { if (Array.isArray(d)) setEditLogs(d) })
                .catch(() => { })
                .finally(() => setEditLogsLoading(false))
        }
    }

    const handleEditSave = async () => {
        if (!editingRecord) return
        setEditSaving(true)

        const updates: Record<string, unknown> = {}
        if (editForm.status !== editingRecord.status) updates.status = editForm.status
        if (editForm.notes !== (editingRecord.notes || '')) updates.notes = editForm.notes || null

        // Convert time to timestamp
        if (editForm.clock_in) {
            const newCi = `${date}T${editForm.clock_in}:00+06:00`
            updates.clock_in = newCi
        }
        if (editForm.clock_out) {
            const newCo = `${date}T${editForm.clock_out}:00+06:00`
            updates.clock_out = newCo
        } else if (!editForm.clock_out && editingRecord.clock_out) {
            updates.clock_out = null
        }

        await fetch(`/api/attendance/${editingRecord.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        })
        setEditSaving(false)
        setEditingRecord(null)
        fetchAttendance()
    }

    const handleDeleteAttendance = async (id: string) => {
        if (!confirm('Delete this attendance record permanently? This cannot be undone.')) return
        setDeletingAttId(id)
        const res = await fetch(`/api/attendance/${id}`, { method: 'DELETE' })
        setDeletingAttId(null)
        if (res.ok) {
            setEditingRecord(null)
            fetchAttendance()
        } else {
            const d = await res.json()
            alert(d.error || 'Delete failed')
        }
    }

    const handleAwardPoint = async () => {
        if (!pointModalRecord) return
        setPointSaving(true)
        try {
            await fetch('/api/points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: pointModalRecord.employee_id,
                    points: pointAmount,
                    source: 'manual',
                    source_id: pointModalRecord.id,
                    description: pointReason || `Manual points based on daily performance/behavior`,
                }),
            })
        } catch { /* ignore */ }
        finally {
            setPointSaving(false)
            setPointModalRecord(null)
        }
    }

    // Stats
    const statCounts = {
        present: records.filter(r => r.status === 'present').length,
        absent: records.filter(r => r.status === 'absent').length,
        late: records.filter(r => r.status === 'late').length,
        leave: records.filter(r => r.status === 'leave' || r.status === 'half_day' || r.status === 'on_duty').length,
    }

    const stats = [
        { key: 'present', label: 'Present', value: statCounts.present, color: '#16A34A' },
        { key: 'absent', label: 'Absent', value: statCounts.absent, color: '#DC2626' },
        { key: 'late', label: 'Late', value: statCounts.late, color: '#F59E0B' },
        { key: 'leave', label: 'On Leave', value: statCounts.leave, color: '#7C3AED' },
    ]

    const statusFilterMap: Record<string, string[]> = {
        present: ['present'],
        absent: ['absent'],
        late: ['late'],
        leave: ['leave', 'half_day', 'on_duty'],
    }

    const filteredByStatus = viewingStatus
        ? records.filter(r => statusFilterMap[viewingStatus]?.includes(r.status))
        : null

    const displayDate = formatLongDate(date)

    return (
        <motion.div variants={container} animate="show">
            {/* Page Header */}
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Leave</h1>
                    <p className="page-subtitle">{records.length} record{records.length !== 1 ? 's' : ''} for today</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm"
                        onClick={() => { const link = document.createElement('a'); link.href = `/api/export?type=attendance&date=${date}`; link.download = `attendance-${date}.csv`; link.click() }}
                        title="Export CSV">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export
                    </button>
                    {isAdmin && (
                        <button className="btn btn-sm" onClick={() => { setSlDate(date); setShowStandaloneLeave(true) }}
                            style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.2)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                            Mark Leave
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => setShowModal(true)} id="mark-attendance-btn">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Mark Attendance
                    </button>
                </div>
            </motion.div>

            {/* Tabs for Admin View */}
            <motion.div variants={item} style={{ marginBottom: '24px' }}>
                <div className="tabs" style={{ display: 'inline-flex', background: 'var(--color-bg-primary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                    <button 
                        className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('attendance')}
                        style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeTab === 'attendance' ? '#fff' : 'var(--color-text-secondary)', background: activeTab === 'attendance' ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Daily Attendance
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'leaves' ? 'active' : ''}`}
                        onClick={() => setActiveTab('leaves')}
                        style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeTab === 'leaves' ? '#fff' : 'var(--color-text-secondary)', background: activeTab === 'leaves' ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Pending Leaves
                    </button>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {activeTab === 'attendance' ? (
                    <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

            {/* Date Navigator */}
            <motion.div className="attendance-date-nav" variants={item}>
                <button className="btn btn-ghost btn-icon" onClick={() => navigateDate(-1)} id="date-prev">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
                <div className="attendance-date-display">
                    <span className="attendance-date-text">{displayDate}</span>
                    {isToday && <span className="badge badge-success" style={{ fontSize: '0.625rem', padding: '2px 8px' }}>Today</span>}
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => navigateDate(1)} disabled={isToday} id="date-next">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
                <input type="date" className="input attendance-date-picker" value={date} onChange={(e) => setDate(e.target.value)} max={getLocalDateString()} id="date-picker" />
            </motion.div>

            {/* Clickable Stat Cards */}
            <motion.div className="grid grid-4" variants={item} style={{ marginBottom: '24px' }}>
                {stats.map((stat) => (
                    <motion.div key={stat.label} className="stat-card"
                        whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setViewingStatus(viewingStatus === stat.key ? null : stat.key)}
                        style={{ cursor: 'pointer', border: viewingStatus === stat.key ? `2px solid ${stat.color}` : undefined }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="stat-label">{stat.label}</span>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stat.color }} />
                            </div>
                        </div>
                        <span className="stat-value">{loading ? '-' : stat.value}</span>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Click to view</div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Filtered Status Detail Panel */}
            <AnimatePresence>
                {viewingStatus && filteredByStatus && (
                    <motion.div className="card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        style={{ marginBottom: '24px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: stats.find(s => s.key === viewingStatus)?.color }} />
                                {stats.find(s => s.key === viewingStatus)?.label} - {filteredByStatus.length} member{filteredByStatus.length !== 1 ? 's' : ''}
                            </h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setViewingStatus(null)} style={{ fontSize: '0.75rem' }}>✕ Close</button>
                        </div>
                        {filteredByStatus.length === 0 ? (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', padding: '12px 0' }}>No members in this category</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {filteredByStatus.map(r => {
                                    const sc = statusConfig[r.status] || statusConfig.present
                                    return (
                                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: sc.bg, borderRadius: '10px', border: `1px solid ${sc.color}15` }}>
                                            <div style={{ background: getAvatarColor(r.employee.name), width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '0.875rem', flexShrink: 0, overflow: 'hidden' }}>
                                                {r.employee.avatar_url ? (
                                                    <img src={r.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : r.employee.name[0]?.toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.employee.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                                    {r.employee.designation || r.employee.department?.name || '-'}
                                                    {r.employee.employee_id && ` • #${r.employee.employee_id}`}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                                {r.status === 'leave' ? (
                                                    <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontFamily: 'inherit' }}>N/A</span>
                                                ) : (
                                                    <>
                                                        {formatTime(r.clock_in)}
                                                        {r.clock_out && ` - ${formatTime(r.clock_out)}`}
                                                    </>
                                                )}
                                            </div>
                                            <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: `${sc.color}15`, flexShrink: 0 }}>{sc.label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Attendance Table */}
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
            ) : records.length === 0 ? (
                <motion.div className="card" variants={item} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <svg width="48" height="48" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ marginBottom: '16px' }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text-secondary)' }}>No attendance records</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', marginBottom: '20px' }}>No attendance has been marked for this date yet.</p>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>Mark Attendance</button>
                </motion.div>
            ) : (
                <motion.div className="table-container" variants={item}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th>Clock In</th>
                                <th>Clock Out</th>
                                <th>Duration</th>
                                <th>Notes</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record) => {
                                const sc = statusConfig[record.status] || statusConfig.present
                                return (
                                    <motion.tr key={record.id}
                                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className="avatar avatar-sm" style={{ background: getAvatarColor(record.employee.name), overflow: 'hidden' }}>
                                                    {record.employee.avatar_url ? (
                                                        <img src={record.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : record.employee.name[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{record.employee.name}</div>
                                                    {record.employee.employee_id && <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{record.employee.employee_id}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{record.employee.department?.name || '-'}</td>
                                        <td>
                                            <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: `${sc.color}15` }}>{sc.label}</span>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                            {record.status === 'leave' ? <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontFamily: 'inherit' }}>N/A</span> : formatTime(record.clock_in)}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                            {record.status === 'leave' ? <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontFamily: 'inherit' }}>N/A</span> : formatTime(record.clock_out)}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                            {record.status === 'leave' ? <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>N/A</span> : getDuration(record.clock_in, record.clock_out)}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', maxWidth: '150px' }}>
                                            <span className="truncate" style={{ display: 'block' }}>{record.notes || '-'}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {record.clock_in && !record.clock_out && isToday && (
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleClockOut(record)} disabled={clockingOutId === record.id}
                                                        style={{ fontSize: '0.6875rem', padding: '3px 8px' }}>
                                                        {clockingOutId === record.id ? <div className="spinner" style={{ width: '12px', height: '12px' }} /> : 'Clock Out'}
                                                    </button>
                                                )}
                                                {isAdmin && record.status !== 'leave' && (
                                                    <button className="btn btn-sm" onClick={() => openLeaveModal(record)}
                                                        disabled={markingLeaveId === record.id}
                                                        style={{ fontSize: '0.6875rem', padding: '3px 8px', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.2)' }}>
                                                        {markingLeaveId === record.id ? '...' : '🏠 Leave'}
                                                    </button>
                                                )}
                                                {record.status === 'leave' && (
                                                    <span style={{ fontSize: '0.6875rem', padding: '3px 8px', color: '#7C3AED', fontWeight: 600 }}>On Leave</span>
                                                )}
                                                {isAdmin && record.clock_out && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => {
                                                        setPointModalRecord(record)
                                                        setPointAmount(5)
                                                        setPointReason('Daily performance and behavior')
                                                    }} title="Award Points"
                                                        style={{ fontSize: '0.6875rem', padding: '3px 8px', color: '#F59E0B' }}>
                                                        ⭐ Points
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(record)} title="Edit record"
                                                        style={{ fontSize: '0.6875rem', padding: '3px 8px' }}>
                                                        ✏️ Edit
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                )
                            })}
                        </tbody>
                    </table>
                </motion.div>
            )}
            </motion.div>
            ) : (
                <motion.div key="leaves" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    <AdminLeaves />
                </motion.div>
            )}
            </AnimatePresence>

            {/* Mark Attendance Modal */}
            <AnimatePresence>
                {showModal && (
                    <AttendanceModal date={date} existingEmployeeIds={records.map(r => r.employee_id)}
                        onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchAttendance() }} />
                )}
            </AnimatePresence>

            {/* Edit Attendance Record Modal */}
            <AnimatePresence>
                {editingRecord && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setEditingRecord(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', maxHeight: '75vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Edit Attendance - {editingRecord.employee.name}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingRecord(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {/* Status */}
                                <div className="input-group">
                                    <label className="input-label">Status</label>
                                    <select className="input" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                        <option value="present">Present</option>
                                        <option value="late">Late</option>
                                        <option value="absent">Absent</option>
                                        <option value="half_day">Half Day</option>
                                        <option value="leave">On Leave</option>
                                        <option value="on_duty">On Duty</option>
                                    </select>
                                </div>
                                {/* Clock In + Out */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="input-group">
                                        <label className="input-label">Clock In</label>
                                        <input type="time" className="input" value={editForm.clock_in} onChange={e => setEditForm({ ...editForm, clock_in: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Clock Out</label>
                                        <input type="time" className="input" value={editForm.clock_out} onChange={e => setEditForm({ ...editForm, clock_out: e.target.value })} />
                                    </div>
                                </div>
                                {/* Notes */}
                                <div className="input-group">
                                    <label className="input-label">Notes</label>
                                    <input type="text" className="input" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Admin notes..." />
                                </div>

                                {/* Activity Logs (admin only) */}
                                {isAdmin && (
                                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '14px' }}>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Change History</div>
                                        {editLogsLoading ? (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>Loading...</div>
                                        ) : editLogs.length === 0 ? (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>No changes recorded yet</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflow: 'auto' }}>
                                                {editLogs.map(log => (
                                                    <div key={log.id} style={{ padding: '6px 10px', background: 'var(--color-surface)', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                                        <span style={{ fontWeight: 600, flexShrink: 0 }}>{log.details?.actor_name || '?'}</span>
                                                        <span style={{ color: 'var(--color-text-secondary)', flex: 1 }}>
                                                            {log.details?.changes?.join(', ') || `${log.action}: ${log.old_value} → ${log.new_value}`}
                                                        </span>
                                                        <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{timeAgo(log.created_at)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                                <div>
                                    {isSuperAdmin && (
                                        <button className="btn btn-sm" onClick={() => handleDeleteAttendance(editingRecord.id)}
                                            disabled={deletingAttId === editingRecord.id}
                                            style={{ background: '#DC2626', color: '#fff', border: 'none' }}>
                                            {deletingAttId === editingRecord.id ? 'Deleting...' : '🗑 Delete Record'}
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingRecord(null)}>Cancel</button>
                                    <button className="btn btn-primary btn-sm" onClick={handleEditSave} disabled={editSaving}>
                                        {editSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Leave Reason Modal (#15) */}
            <AnimatePresence>
                {showLeaveModal && leaveTargetRecord && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowLeaveModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Mark On Leave</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowLeaveModal(false)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(124,58,237,0.06)', borderRadius: '10px', border: '1px solid rgba(124,58,237,0.15)' }}>
                                    <div style={{ background: getAvatarColor(leaveTargetRecord.employee.name), width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '0.875rem', flexShrink: 0, overflow: 'hidden' }}>
                                        {leaveTargetRecord.employee.avatar_url ? (
                                            <img src={leaveTargetRecord.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : leaveTargetRecord.employee.name[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{leaveTargetRecord.employee.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{leaveTargetRecord.employee.designation || leaveTargetRecord.employee.department?.name || '-'}</div>
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Reason for Leave</label>
                                    <select className="input" value={leaveReason} onChange={e => setLeaveReason(e.target.value)}>
                                        <option value="">Select reason...</option>
                                        <option value="Sick Leave">Sick Leave</option>
                                        <option value="Personal">Personal</option>
                                        <option value="Family Emergency">Family Emergency</option>
                                        <option value="Vacation">Vacation</option>
                                        <option value="Medical Appointment">Medical Appointment</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', background: 'rgba(245,158,11,0.08)', padding: '8px 12px', borderRadius: '8px' }}>
                                    ℹ️ This will mark attendance as &quot;On Leave&quot; and create an automatic notice on the noticeboard.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowLeaveModal(false)}>Cancel</button>
                                <button className="btn btn-sm" onClick={handleMarkLeave} disabled={markingLeaveId !== null}
                                    style={{ background: '#7C3AED', color: '#fff', border: 'none' }}>
                                    {markingLeaveId ? 'Processing...' : 'Confirm Leave'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Standalone Leave Modal */}
            <AnimatePresence>
                {showStandaloneLeave && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowStandaloneLeave(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Mark Leave</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowStandaloneLeave(false)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {/* Member Search */}
                                <div className="input-group">
                                    <label className="input-label">Select Member *</label>
                                    <input className="input" type="text" placeholder="Search by name..." value={slSearch}
                                        onChange={e => setSlSearch(e.target.value)} style={{ marginBottom: '6px' }} />
                                    <div style={{ maxHeight: '160px', overflow: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '8px' }}>
                                        {allMembers
                                            .filter(m => !slSearch || m.name.toLowerCase().includes(slSearch.toLowerCase()) || m.employee_id?.includes(slSearch))
                                            .map(m => (
                                                <div key={m.id} onClick={() => { setSlMemberId(m.id); setSlSearch(m.name) }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '8px 12px', cursor: 'pointer',
                                                        background: slMemberId === m.id ? 'rgba(124,58,237,0.08)' : 'transparent',
                                                        borderBottom: '1px solid var(--color-border-light)',
                                                        transition: 'background 0.1s',
                                                    }}
                                                >
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: getAvatarColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
                                                        {m.avatar_url ? (
                                                            <img src={m.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : m.name[0]?.toUpperCase()}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: slMemberId === m.id ? 600 : 400, fontSize: '0.8125rem' }}>{m.name}</div>
                                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{m.designation || ''}{m.employee_id ? ` • #${m.employee_id}` : ''}</div>
                                                    </div>
                                                    {slMemberId === m.id && (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                                {/* Date Mode Toggle */}
                                <div className="input-group">
                                    <label className="input-label">Leave Duration *</label>
                                    <div style={{ display: 'flex', background: 'rgba(118,118,128,0.08)', borderRadius: '8px', padding: '2px', marginBottom: '8px' }}>
                                        {[{ key: 'one_day', label: 'One Day' }, { key: 'range', label: 'Date Range' }].map(tab => (
                                            <button key={tab.key} onClick={() => setSlLeaveMode(tab.key as 'one_day' | 'range')}
                                                style={{
                                                    flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none',
                                                    fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                                                    background: slLeaveMode === tab.key ? 'var(--color-bg-primary)' : 'transparent',
                                                    color: slLeaveMode === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                                    boxShadow: slLeaveMode === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                    transition: 'all 0.15s',
                                                }}>
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                    {slLeaveMode === 'one_day' ? (
                                        <input type="date" className="input" value={slDate} onChange={e => setSlDate(e.target.value)} />
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                                            <input type="date" className="input" value={slDate} onChange={e => setSlDate(e.target.value)} />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>to</span>
                                            <input type="date" className="input" value={slEndDate} onChange={e => setSlEndDate(e.target.value)} min={slDate} />
                                        </div>
                                    )}
                                    {slLeaveMode === 'range' && slDate && slEndDate && slEndDate >= slDate && (
                                        <div style={{ fontSize: '0.6875rem', color: '#7C3AED', marginTop: '4px', fontWeight: 500 }}>
                                            {Math.round((new Date(slEndDate + 'T00:00:00').getTime() - new Date(slDate + 'T00:00:00').getTime()) / 86400000) + 1} day(s) selected
                                        </div>
                                    )}
                                </div>
                                {/* Reason */}
                                <div className="input-group">
                                    <label className="input-label">Reason</label>
                                    <select className="input" value={slReason} onChange={e => setSlReason(e.target.value)}>
                                        <option value="">Select reason...</option>
                                        <option value="Sick Leave">Sick Leave</option>
                                        <option value="Personal">Personal</option>
                                        <option value="Family Emergency">Family Emergency</option>
                                        <option value="Vacation">Vacation</option>
                                        <option value="Medical Appointment">Medical Appointment</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', background: 'rgba(245,158,11,0.08)', padding: '8px 12px', borderRadius: '8px' }}>
                                    ℹ️ This will mark the member as &quot;On Leave&quot; for the selected date and create an automatic notice on the noticeboard.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowStandaloneLeave(false)}>Cancel</button>
                                <button className="btn btn-sm" onClick={handleStandaloneLeave} disabled={slSaving || !slMemberId || !slDate || (slLeaveMode === 'range' && (!slEndDate || slEndDate < slDate))}
                                    style={{ background: '#7C3AED', color: '#fff', border: 'none' }}>
                                    {slSaving ? 'Processing...' : 'Confirm Leave'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Manual Award Point Modal */}
            <AnimatePresence>
                {pointModalRecord && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setPointModalRecord(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Award Performance Points</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setPointModalRecord(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(245,158,11,0.06)', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.15)' }}>
                                    <div style={{ background: getAvatarColor(pointModalRecord.employee.name), width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '0.875rem', flexShrink: 0, overflow: 'hidden' }}>
                                        {pointModalRecord.employee.avatar_url ? (
                                            <img src={pointModalRecord.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : pointModalRecord.employee.name[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{pointModalRecord.employee.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{pointModalRecord.employee.designation || pointModalRecord.employee.department?.name || '-'}</div>
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Points to Award</label>
                                    <input type="number" className="input" value={pointAmount} onChange={e => setPointAmount(Number(e.target.value))} min={1} max={100} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Reason / Feedback</label>
                                    <input type="text" className="input" value={pointReason} onChange={e => setPointReason(e.target.value)} placeholder="e.g. Good dress code, great performance today" />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-secondary)', padding: '8px 12px', borderRadius: '8px' }}>
                                    ℹ️ Points are added directly to the employee's total balance.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setPointModalRecord(null)}>Cancel</button>
                                <button className="btn btn-sm" onClick={handleAwardPoint} disabled={pointSaving || pointAmount <= 0}
                                    style={{ background: '#F59E0B', color: '#fff', border: 'none' }}>
                                    {pointSaving ? 'Awarding...' : 'Award Points'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
