'use client'

import RequireFeature from '@/components/common/RequireFeature'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { IconPackage, IconClock, IconCheckCircle, IconShieldAlert, IconEdit, IconTrash, IconX } from '@/components/icons/Icons'
import React from 'react'
import { usePermissions } from '@/lib/PermissionsContext'
import DatePicker from '@/components/ui/DatePicker'

interface CourierIssue {
    id: string
    date: string
    parcel_id: string | null
    contact_number: string | null
    problem_details: string | null
    problem_category: string | null
    source: string | null
    logistics: string | null
    business_name: string | null
    payment_gateway: string | null
    problem_status: string
    delivery_status: string | null
    fraud_note: boolean
    solved_description: string | null
    peek_by: { id: string; name: string } | null
    solver: { id: string; name: string } | null
    created_at: string
}

interface Employee {
    id: string
    name: string
    employee_id: string
}

// Local (not UTC) YYYY-MM-DD so date-range filters don't shift a day in UTC+ timezones.
const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    resolved: { label: 'Resolved', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
}

// Per-delivery-status colors so the row dropdown reads at a glance (matches the stat cards).
const deliveryStatusColors: Record<string, string> = {
    'Pending': '#F59E0B',
    'Resend Request': '#8B5CF6',
    'Partial Delivery': '#3B82F6',
    'Delivered': '#10B981',
    'Returned': '#EF4444',
    'Exchanged': '#EC4899',
    'Ready to Received': '#059669',
}

const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'resolved', label: 'Resolved' },
]

const problemCategories = ['Delivery Delay', 'Wrong Address', 'Damaged Package', 'Lost Parcel', 'Return Issue', 'Payment Issue', 'Fraud', 'Ready to Receive', 'Customer is Unreachable', 'Other']

const deliveryStatuses = [
    'Pending',
    'Resend Request',
    'Partial Delivery',
    'Delivered',
    'Returned',
    'Exchanged',
    'Ready to Received'
]

const getNormalizedDeliveryStatus = (status: string | null) => {
    if (!status) return 'Pending'
    const lower = status.toLowerCase()
    if (lower === 'pending') return 'Pending'
    if (lower === 'resend request' || lower === 'resend_request') return 'Resend Request'
    if (lower === 'partial delivery' || lower === 'partial_delivery' || lower === 'partial') return 'Partial Delivery'
    if (lower === 'delivered') return 'Delivered'
    if (lower === 'returned') return 'Returned'
    if (lower === 'exchanged') return 'Exchanged'
    if (lower === 'ready to received' || lower === 'ready to recieved' || lower === 'ready_to_received' || lower === 'ready to receive') return 'Ready to Received'
    return 'Pending'
}

const emptyForm = {
    parcel_id: '', contact_number: '', problem_details: '',
    problem_category: '', source: '', fraud_note: false,
    business_name: '', logistics: 'Steadfast',
    problem_status: 'pending',
    solver_id: '',
    solved_description: '',
    call_peek: '',
    delivery_status: 'Pending',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getName = (obj: any) => { if (!obj) return null; return Array.isArray(obj) ? obj[0]?.name : obj.name }

export default function CourierPage() {
    const { data: perms } = usePermissions()
    const [issues, setIssues] = useState<CourierIssue[]>([])
    const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0, fraud: 0 })
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all')
    const [deliveryFilter, setDeliveryFilter] = useState('all')
    const [memberFilter, setMemberFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [editingIssueId, setEditingIssueId] = useState<string | null>(null)
    const [showAllStats, setShowAllStats] = useState(false)
    const [activityLog, setActivityLog] = useState<{ id: string; action: string; old_value: string | null; new_value: string | null; actor: { name: string } | null; created_at: string }[]>([])
    const [activityLoading, setActivityLoading] = useState(false)
    const toast = useToast()

    const fetchActivityLog = async (issueId: string) => {
        if (!isAdmin) return
        setActivityLoading(true)
        try {
            const res = await fetch(`/api/activity-log?module=courier&target_id=${issueId}`)
            if (res.ok) setActivityLog(await res.json())
        } catch { /* ignore */ }
        finally { setActivityLoading(false) }
    }

    // Date range state
    const [dateRangeMode, setDateRangeMode] = useState<'today' | 'week' | 'month' | 'custom'>('month')
    const [refDate, setRefDate] = useState(() => fmtLocalDate(new Date()))
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    const getWeekRange = (d: Date) => {
        const day = d.getDay()
        const start = new Date(d); start.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
        const end = new Date(start); end.setDate(start.getDate() + 6)
        return { start: fmtLocalDate(start), end: fmtLocalDate(end) }
    }
    const getMonthRange = (d: Date) => {
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        return { start: fmtLocalDate(start), end: fmtLocalDate(end) }
    }

    const fetchData = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (dateRangeMode === 'today') {
                params.set('start_date', refDate)
                params.set('end_date', refDate)
            } else if (dateRangeMode === 'week') {
                const r = getWeekRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRangeMode === 'month') {
                const r = getMonthRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRangeMode === 'custom' && customStart && customEnd) {
                params.set('start_date', customStart)
                params.set('end_date', customEnd)
            }
            const res = await fetch(`/api/courier?${params}`)
            if (res.ok) { const d = await res.json(); setIssues(d.issues); setStats(d.stats) }
        } catch { console.error('Failed') }
        finally { setLoading(false) }
    }, [dateRangeMode, refDate, customStart, customEnd])

    useEffect(() => {
        fetchData()
        fetch('/api/members').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setEmployees(d)
        }).catch(() => { })
    }, [fetchData])

    useEffect(() => {
        if (perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin') setIsAdmin(true)
        if (perms.is_super || perms.role === 'Owner' || perms.role === 'Super Admin') setIsSuperAdmin(true)
    }, [perms])

    const handleSave = async () => {
        if (!form.problem_details.trim()) return
        setSaving(true)
        try {
            const isEdit = !!editingIssueId
            const url = '/api/courier'
            const method = isEdit ? 'PUT' : 'POST'
            const payload = isEdit
                ? {
                      id: editingIssueId,
                      parcel_id: form.parcel_id || null,
                      contact_number: form.contact_number || null,
                      problem_details: form.problem_details,
                      problem_category: form.problem_category || null,
                      source: form.source,
                      logistics: form.logistics || null,
                      fraud_note: form.fraud_note,
                      business_name: form.business_name || null,
                      problem_status: form.problem_status,
                      problem_solver: form.solver_id || null,
                      solved_description: form.solved_description || null,
                      call_peek: form.call_peek || null,
                      delivery_status: form.delivery_status || null,
                  }
                : {
                      parcel_id: form.parcel_id || null,
                      contact_number: form.contact_number || null,
                      problem_details: form.problem_details,
                      problem_category: form.problem_category || null,
                      source: form.source,
                      logistics: form.logistics || null,
                      fraud_note: form.fraud_note,
                      business_name: form.business_name || null,
                      problem_status: form.problem_status,
                      problem_solver: form.solver_id || null,
                      call_peek: form.call_peek || null,
                      delivery_status: form.delivery_status || 'Pending',
                  }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (res.ok) { 
                const data = await res.json()
                if (data.awardedPoints && data.awardedPoints > 0) {
                    toast.success(`Awesome! You earned ${data.awardedPoints} points! 🌟`)
                }
                toast.success(isEdit ? 'Courier issue updated successfully' : 'Courier issue reported successfully')
                await fetchData(); setShowModal(false); setForm(emptyForm); setEditingIssueId(null)
            } else {
                const errData = await res.json().catch(() => ({}))
                toast.error(`Failed to save: ${errData.error || 'Unknown error'}`)
            }
        } catch { console.error('Save failed') }
        finally { setSaving(false) }
    }

    const openEditModal = (issue: CourierIssue) => {
        setActivityLog([])
        fetchActivityLog(issue.id)
        setEditingIssueId(issue.id)
        setForm({
            parcel_id: issue.parcel_id || '',
            contact_number: issue.contact_number || '',
            problem_details: issue.problem_details || '',
            problem_category: issue.problem_category || '',
            source: issue.source || 'phone',
            fraud_note: issue.fraud_note,
            business_name: issue.business_name || '',
            logistics: issue.logistics || '',
            problem_status: issue.problem_status || 'pending',
            solver_id: issue.solver ? (Array.isArray(issue.solver) ? (issue.solver as unknown as Employee[])[0]?.id : issue.solver.id) : '',
            solved_description: issue.solved_description || '',
            call_peek: issue.peek_by ? (Array.isArray(issue.peek_by) ? (issue.peek_by as unknown as Employee[])[0]?.id : issue.peek_by.id) : '',
            delivery_status: getNormalizedDeliveryStatus(issue.delivery_status),
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setForm(emptyForm)
        setEditingIssueId(null)
    }

    const handleStatusChange = async (id: string, status: string) => {
        const res = await fetch('/api/courier', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, problem_status: status }),
        })
        if (res.ok) {
            const data = await res.json()
            if (data.awardedPoints && data.awardedPoints > 0) {
                toast.success(`Awesome! You earned ${data.awardedPoints} points! 🌟`)
            }
        }
        await fetchData()
    }

    const handleDeliveryStatusChange = async (id: string, status: string) => {
        const res = await fetch('/api/courier', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, delivery_status: status }),
        })
        if (res.ok) {
            toast.success('Delivery status updated successfully')
        } else {
            toast.error('Failed to update delivery status')
        }
        await fetchData()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this issue?')) return
        const res = await fetch(`/api/courier?id=${id}`, { method: 'DELETE' })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to delete issue'); return }
        toast.success('Issue deleted')
        await fetchData()
    }

    const filtered = issues.filter(i => {
        if (activeFilter !== 'all' && i.problem_status !== activeFilter) return false
        if (deliveryFilter !== 'all' && getNormalizedDeliveryStatus(i.delivery_status) !== deliveryFilter) return false
        if (memberFilter !== 'all') {
            const refId = Array.isArray(i.peek_by) ? (i.peek_by as unknown as Employee[])[0]?.id : i.peek_by?.id
            if (refId !== memberFilter) return false
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (!(i.parcel_id || '').toLowerCase().includes(q) &&
                !(i.problem_details || '').toLowerCase().includes(q) &&
                !(i.contact_number || '').includes(q)) return false
        }
        return true
    })

    const deliveryStatusCounts = issues.reduce((acc, issue) => {
        const status = getNormalizedDeliveryStatus(issue.delivery_status)
        acc[status] = (acc[status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const statCards = [
        { label: 'Total Issues', value: issues.length, color: '#1E3A5F', icon: <IconPackage size={20} color="#1E3A5F" /> },
        { label: 'Pending', value: deliveryStatusCounts['Pending'] || 0, color: '#F59E0B', icon: <IconClock size={20} color="#F59E0B" /> },
        { label: 'Resend Request', value: deliveryStatusCounts['Resend Request'] || 0, color: '#8B5CF6', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> },
        { label: 'Partial Delivery', value: deliveryStatusCounts['Partial Delivery'] || 0, color: '#3B82F6', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
        { label: 'Delivered', value: deliveryStatusCounts['Delivered'] || 0, color: '#10B981', icon: <IconCheckCircle size={20} color="#10B981" /> },
        { label: 'Returned', value: deliveryStatusCounts['Returned'] || 0, color: '#EF4444', icon: <IconShieldAlert size={20} color="#EF4444" /> },
        { label: 'Exchanged', value: deliveryStatusCounts['Exchanged'] || 0, color: '#EC4899', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
        { label: 'Ready to Received', value: deliveryStatusCounts['Ready to Received'] || 0, color: '#059669', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> }
    ]

    return (
        <RequireFeature slugs={['courier']}>
        <motion.div variants={container} animate="show" className="courier-page">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Courier Management</h1>
                    <p className="page-subtitle">Track and resolve courier delivery issues.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyForm); setShowModal(true) }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Report Issue
                </button>
            </motion.div>

            {/* Date Range Selector */}
            <motion.div variants={item} style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {([{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }] as const).map(tab => (
                        <button key={tab.key} onClick={() => setDateRangeMode(tab.key)}
                            style={{
                                position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                color: dateRangeMode === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                            }}>
                            {dateRangeMode === tab.key && (
                                <motion.div layoutId="courierDateTab" style={{
                                    position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                    borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>
                {(dateRangeMode === 'today' || dateRangeMode === 'week' || dateRangeMode === 'month') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => {
                            const d = new Date(refDate + 'T00:00:00'); if (dateRangeMode === 'month') d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - (dateRangeMode === 'week' ? 7 : 1)); setRefDate(fmtLocalDate(d))
                        }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                        <button className="btn btn-ghost btn-icon" onClick={() => {
                            const d = new Date(refDate + 'T00:00:00'); if (dateRangeMode === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + (dateRangeMode === 'week' ? 7 : 1)); setRefDate(fmtLocalDate(d))
                        }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                )}
                {dateRangeMode === 'custom' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95, x: -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DatePicker value={customStart} onChange={val => setCustomStart(val)} align="right" />
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>to</span>
                        <DatePicker value={customEnd} onChange={val => setCustomEnd(val)} align="right" />
                    </motion.div>
                )}
            </motion.div>

            {/* Stats */}
            <motion.div variants={item} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                    {(showAllStats ? statCards : statCards.slice(0, 4)).map(s => {
                        const filterKey = s.label === 'Total Issues' ? 'all' : s.label
                        const isActive = deliveryFilter === filterKey
                        return (
                            <div key={s.label} className="card" onClick={() => setDeliveryFilter(isActive ? 'all' : filterKey)}
                                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', minHeight: '68px', cursor: 'pointer', border: isActive ? `1.5px solid ${s.color}` : '1.5px solid transparent', background: isActive ? `${s.color}0A` : undefined, transition: 'border-color 0.15s, background 0.15s' }}
                                title={filterKey === 'all' ? 'Show all' : `Filter: ${s.label}`}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: `${s.color}10` }}>{s.icon}</span>
                                <div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.label}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAllStats(!showAllStats)} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {showAllStats ? 'Show Less' : 'Show More Statuses'}
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style={{ transform: showAllStats ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </motion.div>

            {/* Filters + Search */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {filterTabs.map(tab => (
                        <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                            style={{
                                position: 'relative', padding: '7px 16px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                color: activeFilter === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                            }}>
                            {activeFilter === tab.key && (
                                <motion.div layoutId="courierTab" style={{
                                    position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                    borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>
                {/* Filter by referral member (#14) */}
                <select className="form-input" value={memberFilter} onChange={e => setMemberFilter(e.target.value)}
                    style={{ height: '36px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px', width: 'auto', minWidth: '150px', color: memberFilter === 'all' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)' }}
                    title="Filter by referral">
                    <option value="all">All Members</option>
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                </select>
                {deliveryFilter !== 'all' && (
                    <button onClick={() => setDeliveryFilter('all')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: deliveryStatusColors[deliveryFilter] || 'var(--color-text-primary)', background: `${deliveryStatusColors[deliveryFilter] || '#888'}14` }}>
                        {deliveryFilter}
                        <IconX size={13} />
                    </button>
                )}
                <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                    <div style={{ position: 'relative' }}>
                        <svg width="15" height="15" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                        <input className="form-input" type="text" placeholder="Search by parcel ID..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '34px', height: '36px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px' }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Issues List */}
            {loading ? (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0 }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div className="skeleton" style={{ width: '60%', height: 14 }} />
                                <div className="skeleton" style={{ width: '40%', height: 10 }} />
                            </div>
                            <div className="skeleton" style={{ width: 60, height: 24, borderRadius: '12px' }} />
                        </div>
                    ))}
                </motion.div>
            ) : filtered.length === 0 ? (
                <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><IconPackage size={48} color="var(--color-text-tertiary)" /></div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>No courier issues</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>All shipments are running smoothly!</p>
                </motion.div>
            ) : (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.map(issue => {
                        const sc = statusConfig[issue.problem_status] || statusConfig.pending
                        return (
                            <motion.div key={issue.id} className="card"
                                style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                                whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} transition={{ duration: 0.2 }}
                                onClick={() => openEditModal(issue)}>
                                {issue.fraud_note && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#DC2626' }} />}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                            {issue.parcel_id && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', fontWeight: 800, fontFamily: 'monospace' }}>
                                                    <IconPackage size={14} /> {issue.parcel_id}
                                                    <button
                                                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(issue.parcel_id!).then(() => toast.success('Parcel ID copied')) }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: 'var(--color-text-tertiary)', display: 'inline-flex', alignItems: 'center' }}
                                                        title="Copy parcel ID">
                                                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" /><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" /></svg>
                                                    </button>
                                                </span>
                                            )}
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: sc.bg }}>{sc.label}</span>
                                            {issue.problem_category && (() => {
                                                const cat = issue.problem_category
                                                const catColor = cat === 'Fraud' ? '#DC2626' : (cat === 'Ready to Receive' || cat === 'Ready to Received') ? '#16A34A' : null
                                                return <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', background: catColor ? `${catColor}15` : 'rgba(118,118,128,0.08)', color: catColor || 'var(--color-text-tertiary)', fontWeight: catColor ? 600 : 400 }}>{cat}</span>
                                            })()}
                                            {issue.logistics && <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 500, background: 'rgba(37,99,235,0.08)', color: '#2563EB' }}>{issue.logistics}</span>}
                                            {issue.source && <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 500, background: 'rgba(245,158,11,0.08)', color: '#D97706' }}>{issue.source}</span>}
                                            {issue.fraud_note && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: '#DC2626', background: 'rgba(220,38,38,0.08)' }}><IconShieldAlert size={12} color="#DC2626" /> Fraud</span>}
                                        </div>
                                        {issue.problem_details && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '4px 0 8px', lineHeight: 1.5 }}>{issue.problem_details}</p>}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                            <span>{new Date(issue.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            {issue.contact_number && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg> {issue.contact_number}</span>}
                                            {getName(issue.peek_by) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#16A34A', fontWeight: 500 }} title="Reference"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> Ref: {getName(issue.peek_by)}</span>}
                                            {getName(issue.solver) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg> {getName(issue.solver)}</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(issue)} style={{ padding: '6px', color: 'var(--color-text-tertiary)' }} title="Edit issue">
                                            <IconEdit size={16} />
                                        </button>
                                        {isAdmin && issue.problem_status === 'pending' && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(issue.id, 'resolved')} style={{ padding: '6px', color: '#10B981' }} title="Mark as resolved">
                                                <IconCheckCircle size={16} />
                                            </button>
                                        )}
                                        {isAdmin && issue.problem_status === 'resolved' && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(issue.id, 'pending')} style={{ padding: '6px', color: '#F59E0B' }} title="Revert to pending">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                            </button>
                                        )}
                                        {(() => {
                                            const ds = getNormalizedDeliveryStatus(issue.delivery_status)
                                            const dc = deliveryStatusColors[ds] || 'var(--color-text-secondary)'
                                            return (
                                                <select className="form-input" value={ds}
                                                    onChange={e => handleDeliveryStatusChange(issue.id, e.target.value)}
                                                    style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', height: 'auto', width: '130px', color: dc, borderColor: dc, background: `${dc}0F` }}>
                                                    {deliveryStatuses.map(s => (
                                                        <option key={s} value={s} style={{ color: 'var(--color-text-primary)' }}>{s}</option>
                                                    ))}
                                                </select>
                                            )
                                        })()}
                                        {isSuperAdmin && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(issue.id)} style={{ padding: '6px', color: '#DC2626' }} title="Delete issue">
                                                <IconTrash size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{editingIssueId ? 'Edit Courier Issue' : 'Report Courier Issue'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={closeModal}>
                                    <IconX size={20} />
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Parcel ID</label>
                                        <input className="form-input" value={form.parcel_id} onChange={e => setForm({ ...form, parcel_id: e.target.value })} placeholder="Tracking number..." />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contact Number</label>
                                        <input className="form-input" value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} placeholder="01XXXXXXXXX" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Problem Details *</label>
                                    <textarea className="form-input" value={form.problem_details} onChange={e => setForm({ ...form, problem_details: e.target.value })} placeholder="Describe the issue..." rows={3} style={{ resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select className="form-input" value={form.problem_category} onChange={e => setForm({ ...form, problem_category: e.target.value })}>
                                            <option value="">Select category</option>
                                            {problemCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Delivery Status</label>
                                        <select className="form-input" value={form.delivery_status} onChange={e => setForm({ ...form, delivery_status: e.target.value })}>
                                            {deliveryStatuses.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Logistics</label>
                                        <select className="form-input" value={form.logistics} onChange={e => setForm({ ...form, logistics: e.target.value })}>
                                            <option value="">Select logistics</option>
                                            <option value="Pathao">Pathao</option>
                                            <option value="Steadfast">Steadfast</option>
                                            <option value="RedX">RedX</option>
                                            <option value="eCourier">eCourier</option>
                                            <option value="Paperfly">Paperfly</option>
                                            <option value="Sundarban">Sundarban</option>
                                            <option value="SA Paribahan">SA Paribahan</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                                        <input type="checkbox" id="fraud" checked={form.fraud_note} onChange={e => setForm({ ...form, fraud_note: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#DC2626' }} />
                                        <label htmlFor="fraud" className="form-label" style={{ margin: 0, cursor: 'pointer', color: '#DC2626' }}>Fraud Note</label>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Reference</label>
                                        <select className="form-input" value={form.call_peek} onChange={e => setForm({ ...form, call_peek: e.target.value })}>
                                            <option value="">Select reference...</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Assign Solver</label>
                                        <select className="form-input" value={form.solver_id} onChange={e => setForm({ ...form, solver_id: e.target.value })}>
                                            <option value="">Select solver...</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Source</label>
                                        <select className="form-input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                                            <option value="">Select source...</option>
                                            <option value="facebook">Facebook</option>
                                            <option value="instagram">Instagram</option>
                                            <option value="whatsapp">WhatsApp</option>
                                            <option value="web">Web</option>
                                            <option value="tiktok">TikTok</option>
                                            <option value="direct">Direct</option>
                                        </select>
                                    </div>
                                </div>
                                {editingIssueId && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="form-group">
                                                <label className="form-label">Status</label>
                                                <select className="form-input" value={form.problem_status} onChange={e => setForm({ ...form, problem_status: e.target.value })}>
                                                    <option value="pending">Pending</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="resolved">Resolved</option>
                                                </select>
                                            </div>
                                        </div>
                                        {form.problem_status === 'resolved' && (
                                            <div className="form-group">
                                                <label className="form-label">Resolution Note / Solved Description</label>
                                                <textarea className="form-input" value={form.solved_description} onChange={e => setForm({ ...form, solved_description: e.target.value })} placeholder="How was it resolved?..." rows={2} style={{ resize: 'vertical' }} />
                                            </div>
                                        )}
                                        {/* Activity Log */}
                                        {isAdmin && (
                                            <div>
                                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Activity Log</div>
                                                {activityLoading ? (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Loading...</div>
                                                ) : activityLog.length === 0 ? (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>No activity yet.</div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflow: 'auto' }}>
                                                        {activityLog.map(log => (
                                                            <div key={log.id} style={{ fontSize: '0.75rem', display: 'flex', gap: '8px', padding: '6px 10px', background: 'var(--color-surface)', borderRadius: '6px' }}>
                                                                <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                                                    <strong>{log.actor?.name || 'System'}</strong>{' '}
                                                                    {log.action === 'status_change' ? `changed status: ${log.old_value} → ${log.new_value}` :
                                                                     log.action === 'delivery_status_change' ? `set delivery: ${log.new_value}` :
                                                                     log.action === 'created' ? `created this entry` :
                                                                     log.action}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={closeModal}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.problem_details.trim()}>
                                    {saving ? 'Saving...' : (editingIssueId ? 'Save Changes' : 'Report Issue')}
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
