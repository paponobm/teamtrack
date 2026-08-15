'use client'

import RequireFeature from '@/components/common/RequireFeature'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import WorkEntryModal from '@/components/work-log/WorkEntryModal'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { formatLongDate } from '@/lib/format'
import {
    IconDownload, IconBolt, IconBarChart3, IconPlus, IconChevronLeft, IconChevronRight,
    IconEdit, IconTrash, IconCheckCircle, IconTrophy, IconClipboard, IconBanknote,
    IconWallet, IconLayers, IconFileText, IconX, IconSearch, IconClock, IconTarget
} from '@/components/icons/Icons'

interface WorkEntry {
    id: string
    sl: number
    customer_phone: string
    customer_name: string
    invoice_no: string
    courier_id: string
    source: string
    amount: number
    suggested_amount: number | null
    advance: number | null
    note: string
    order_type: string
    delivery_status: string
    payment_gateway: string | null
    transaction_id: string | null
    business_name: string | null
    advance_verified: boolean
    verified_at: string | null
    verifier: { id: string; name: string } | null
    date: string
    management_check: boolean
    employee: { id: string; name: string; employee_id: string } | null
}

interface Stats {
    totalOrders: number
    totalAmount: number
    totalAdvance: number
    sources: Record<string, number>
    orderTypes: Record<string, number>
    statusBreakdown: Record<string, number>
    verifiedAdvanceAmount: number
    verifiedAdvanceCount: number
    pendingAdvanceAmount: number
    pendingAdvanceCount: number
    advanceOrderCount: number
    paymentGatewaySummary: Record<string, number>
}

interface RankingEntry {
    employee_id: string
    name: string
    emp_code: string
    totalOrders: number
    totalAmount: number
    orders2000Plus: number
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const SOURCE_LABELS: Record<string, string> = {
    facebook: 'Facebook',
    whatsapp: 'WhatsApp',
    web: 'Web',
    direct: 'Direct',
    other: 'Other',
}

const SOURCE_COLORS: Record<string, string> = {
    facebook: '#1877F2',
    whatsapp: '#25D366',
    web: '#6366F1',
    direct: '#F59E0B',
    other: '#6B7280',
}

const ORDER_TYPE_LABELS: Record<string, string> = {
    normal: 'Normal',
    suggested: 'Suggested',
    '2000_plus': '2000+',
    '3000_plus': '3000+',
    '5000_plus': '5000+',
    upsell: 'Upsell',
    incomplete: 'Incomplete',
    exchange: 'Exchange',
}

const ORDER_TYPE_COLORS: Record<string, string> = {
    normal: '#6B7280',
    suggested: '#F59E0B',
    '2000_plus': '#10B981',
    '3000_plus': '#059669',
    '5000_plus': '#047857',
    upsell: '#8B5CF6',
    incomplete: '#EF4444',
    exchange: '#3B82F6',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    delivered: { label: 'Delivered', color: '#10B981' },
    confirmed: { label: 'Confirmed', color: '#3B82F6' },
    pending: { label: 'Pending', color: '#F59E0B' },
    returned: { label: 'Returned', color: '#EF4444' },
    exchanged: { label: 'Exchanged', color: '#8B5CF6' },
    refunded: { label: 'Refunded', color: '#EC4899' },
    partial_refunded: { label: 'Partial Refund', color: '#F97316' },
    cancelled: { label: 'Cancelled', color: '#EF4444' },
    partial: { label: 'Partial', color: '#3B82F6' },
}

// Matches PAYMENT_GATEWAYS in WorkEntryModal.tsx — 'Other' is the fallback for any
// entry saved before that field existed or with an unrecognized value.
const PAYMENT_GATEWAY_COLORS: Record<string, string> = {
    'bKash': '#E2136E',
    'Rocket': '#8C3494',
    'Nagad': '#F7941D',
    'Bank': '#2563EB',
    'Cash': '#10B981',
    'Other': '#6B7280',
}

type DateRangeMode = 'today' | 'custom' | 'week' | 'month'

const getLocalDateString = (d: Date = new Date()) => {
    const local = new Date(d)
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
    return local.toISOString().split('T')[0]
}

function getWeekRange(date: Date) {
    const day = date.getDay()
    const start = new Date(date)
    start.setDate(date.getDate() - (day === 0 ? 6 : day - 1)) // Monday
    const end = new Date(start)
    end.setDate(start.getDate() + 6) // Sunday
    return { start: getLocalDateString(start), end: getLocalDateString(end) }
}

function getMonthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    return { start: getLocalDateString(start), end: getLocalDateString(end) }
}

export default function WorkLogPage() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const [entries, setEntries] = useState<WorkEntry[]>([])
    const [stats, setStats] = useState<Stats>({ totalOrders: 0, totalAmount: 0, totalAdvance: 0, sources: {}, orderTypes: {}, statusBreakdown: {}, verifiedAdvanceAmount: 0, verifiedAdvanceCount: 0, pendingAdvanceAmount: 0, pendingAdvanceCount: 0, advanceOrderCount: 0, paymentGatewaySummary: {} })
    const [loading, setLoading] = useState(true)
    const [date, setDate] = useState(getLocalDateString())
    const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('today')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null)
    const [employees, setEmployees] = useState<{ id: string; name: string; employee_id: string }[]>([])
    const [filterEmployee, setFilterEmployee] = useState('')
    const [filterOrderType, setFilterOrderType] = useState('all')
    const [filterSource, setFilterSource] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterAdvanceStatus, setFilterAdvanceStatus] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    // Per-entry activity/history (#7)
    const [historyEntry, setHistoryEntry] = useState<WorkEntry | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [historyLogs, setHistoryLogs] = useState<any[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [quickMode, setQuickMode] = useState(false)
    const [quickForm, setQuickForm] = useState({ customer_phone: '', customer_name: '', invoice_no: '', courier_id: '', source: '', amount: '', order_type: '', delivery_status: 'confirmed', employee_id: '', payment_gateway: '', business_name: '' })
    const [quickSaving, setQuickSaving] = useState(false)
    const [currentUser, setCurrentUser] = useState<{ employee_id: string; name: string; is_super: boolean; role: string } | null>(null)
    const [showRanking, setShowRanking] = useState(false)
    const [rankingData, setRankingData] = useState<RankingEntry[]>([])
    const [rankingPeriod, setRankingPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
    const [rankingLoading, setRankingLoading] = useState(false)

    const isMember = currentUser && !currentUser.is_super
    const isAdmin = !!currentUser && (currentUser.is_super || ['Owner', 'Super Admin', 'Admin'].includes(currentUser.role))

    // Client-side search across customer, invoice, courier id, business (#7)
    const q = searchQuery.trim().toLowerCase()
    const displayedEntries = q
        ? entries.filter(e =>
            (e.customer_name || '').toLowerCase().includes(q) ||
            (e.customer_phone || '').toLowerCase().includes(q) ||
            (e.invoice_no || '').toLowerCase().includes(q) ||
            (e.courier_id || '').toLowerCase().includes(q) ||
            (e.business_name || '').toLowerCase().includes(q))
        : entries

    const openHistory = async (entry: WorkEntry) => {
        setHistoryEntry(entry)
        setHistoryLoading(true)
        setHistoryLogs([])
        try {
            const res = await fetch(`/api/activity-log?module=work_log&target_id=${entry.id}`)
            if (res.ok) setHistoryLogs(await res.json())
        } catch { /* ignore */ }
        finally { setHistoryLoading(false) }
    }

    const fetchEntries = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()

        if (dateRangeMode === 'today') {
            params.set('date', date)
        } else if (dateRangeMode === 'week') {
            const range = getWeekRange(new Date(date))
            params.set('start_date', range.start)
            params.set('end_date', range.end)
        } else if (dateRangeMode === 'month') {
            const range = getMonthRange(new Date(date))
            params.set('start_date', range.start)
            params.set('end_date', range.end)
        } else if (dateRangeMode === 'custom' && customStart && customEnd) {
            params.set('start_date', customStart)
            params.set('end_date', customEnd)
        } else {
            params.set('date', date)
        }

        if (filterEmployee) params.set('employee_id', filterEmployee)
        if (filterOrderType !== 'all') params.set('order_type', filterOrderType)
        if (filterSource !== 'all') params.set('source', filterSource)
        if (filterStatus !== 'all') params.set('delivery_status', filterStatus)
        if (filterAdvanceStatus !== 'all') params.set('advance_status', filterAdvanceStatus)

        const res = await fetch(`/api/work-log?${params}`)
        const data = await res.json()
        if (data.entries) {
            setEntries(data.entries)
            setStats(data.stats)
        }
        setLoading(false)
    }, [date, dateRangeMode, customStart, customEnd, filterEmployee, filterOrderType, filterSource, filterStatus, filterAdvanceStatus])

    useEffect(() => { fetchEntries() }, [fetchEntries])

    useEffect(() => {
        const fetchEmp = async () => {
            const res = await fetch('/api/members?status=active')
            const data = await res.json()
            if (Array.isArray(data)) setEmployees(data)
        }
        fetchEmp()
    }, [])

    useEffect(() => {
        const loadUser = async () => {
            if (perms.employee_id) {
                try {
                    const empRes = await fetch(`/api/members/${perms.employee_id}`)
                    const empData = await empRes.json()
                    setCurrentUser({
                        employee_id: perms.employee_id,
                        name: empData?.name || 'You',
                        is_super: perms.is_super || false,
                        role: perms.role || '',
                    })
                    if (!perms.is_super) {
                        setQuickForm(prev => ({ ...prev, employee_id: perms.employee_id! }))
                    }
                } catch { /* ignore */ }
            }
        }

        if (perms.employee_id || perms.is_super) {
            loadUser()
        }
    }, [perms])

    const fetchRanking = useCallback(async (period: 'daily' | 'weekly' | 'monthly') => {
        setRankingLoading(true)
        try {
            const res = await fetch(`/api/work-log/ranking?period=${period}`)
            const data = await res.json()
            setRankingData(data.ranking || [])
        } catch { console.error('Failed to fetch ranking') }
        finally { setRankingLoading(false) }
    }, [])

    const changeDate = (offset: number) => {
        const d = new Date(date)
        d.setDate(d.getDate() + offset)
        setDate(getLocalDateString(d))
    }

    const formatDate = (d: string) => formatLongDate(d)

    const isToday = date === getLocalDateString()

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this entry?')) return
        const res = await fetch(`/api/work-log/${id}`, { method: 'DELETE' })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to delete entry'); return }
        toast.success('Entry deleted')
        fetchEntries()
    }

    const handleSave = () => {
        setShowModal(false)
        setEditingEntry(null)
        fetchEntries()
    }

    const handleStatusChange = async (entryId: string, newStatus: string) => {
        const prevEntries = entries
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, delivery_status: newStatus } : e))
        try {
            const res = await fetch('/api/work-log/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entry_id: entryId, delivery_status: newStatus }),
            })
            if (!res.ok) { setEntries(prevEntries); const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to update status'); return }
        } catch { setEntries(prevEntries); toast.error('Failed to update status'); return }
        fetchEntries()
    }

    const handleQuickSubmit = async () => {
        if (!quickForm.customer_phone && !quickForm.amount) return
        // Resolve the target member up front and require one (admins must pick a member;
        // members default to themselves) — otherwise the entry has no owner.
        const resolvedEmployeeId = quickForm.employee_id || (isMember ? currentUser?.employee_id : '')
        if (!resolvedEmployeeId) {
            toast.error('Please select a member for this entry')
            return
        }
        setQuickSaving(true)
        try {
            const res = await fetch('/api/work-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...quickForm,
                    amount: Number(quickForm.amount) || 0,
                    date,
                    employee_id: resolvedEmployeeId,
                }),
            })
            if (res.ok) {
                setQuickForm({ customer_phone: '', customer_name: '', invoice_no: '', courier_id: '', source: '', amount: '', order_type: '', delivery_status: 'confirmed', employee_id: quickForm.employee_id, payment_gateway: '', business_name: '' })
                fetchEntries()
            } else {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to add entry')
            }
        } catch { toast.error('Failed to add entry') }
        finally { setQuickSaving(false) }
    }

    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']

    return (
        <RequireFeature slugs={['work-log', 'orders-2000-plus', 'suggest-orders', 'pending-orders', 'payment-confirmation', 'daily-order-submit', 'refund-exchange', 'customer-review', 'pr-sending']}>
            <motion.div variants={container} animate="show">
                {/* Header */}
                <motion.div className="page-header" variants={item}>
                    <div>
                        <h1 className="page-title">Work Log</h1>
                        <p className="page-subtitle">Daily order submissions</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { const link = document.createElement('a'); link.href = `/api/export?type=work-log&date=${date}`; link.download = `work-log-${date}.csv`; link.click() }} title="Export CSV">
                            <IconDownload size={16} /> Export
                        </button>
                        <button className={`btn ${quickMode ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setQuickMode(!quickMode)} title="Toggle Quick Entry Mode" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconBolt size={16} /> Quick
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setShowRanking(true); fetchRanking(rankingPeriod) }} title="View Ranking Board" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconBarChart3 size={16} /> Ranking
                        </button>
                        <button className="btn btn-primary" onClick={() => { setEditingEntry(null); setShowModal(true) }} id="add-entry-btn">
                            <IconPlus size={16} /> Add Entry
                        </button>
                    </div>
                </motion.div>

                {/* Date Range Selector */}
                <motion.div variants={item} style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Range mode tabs */}
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
                                    <motion.div layoutId="dateRangeTab" style={{
                                        position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                        borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                    }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                )}
                                <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Date nav for daily mode */}
                    {dateRangeMode === 'today' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                            <button className="btn btn-ghost btn-icon" onClick={() => changeDate(-1)} style={{ borderRadius: '8px' }}>
                                <IconChevronLeft size={16} />
                            </button>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                            <button className="btn btn-ghost btn-icon" onClick={() => changeDate(1)} style={{ borderRadius: '8px' }}>
                                <IconChevronRight size={16} />
                            </button>
                        </div>
                    )}

                    {/* Week/Month: date picker that determines the reference date */}
                    {(dateRangeMode === 'week' || dateRangeMode === 'month') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                            <button className="btn btn-ghost btn-icon" onClick={() => changeDate(dateRangeMode === 'week' ? -7 : -30)} style={{ borderRadius: '8px' }}>
                                <IconChevronLeft size={16} />
                            </button>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                            <button className="btn btn-ghost btn-icon" onClick={() => changeDate(dateRangeMode === 'week' ? 7 : 30)} style={{ borderRadius: '8px' }}>
                                <IconChevronRight size={16} />
                            </button>
                        </div>
                    )}

                    {/* Custom date range */}
                    {dateRangeMode === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input" style={{ padding: '6px 8px', fontSize: '0.8125rem', width: '150px', border: '1px solid var(--color-border-light)', borderRadius: '8px' }} />
                            <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>to</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input" style={{ padding: '6px 8px', fontSize: '0.8125rem', width: '150px', border: '1px solid var(--color-border-light)', borderRadius: '8px' }} />
                        </div>
                    )}

                    {!isToday && dateRangeMode === 'today' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setDate(getLocalDateString())}>Today</button>
                    )}
                </motion.div>

                {/* Filters Row */}
                <motion.div variants={item} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select className="input" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} style={{ width: '160px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                        <option value="">All Members</option>
                        {employees.map(e => (<option key={e.id} value={e.id}>{e.name}</option>))}
                    </select>
                    <select className="input" value={filterOrderType} onChange={(e) => setFilterOrderType(e.target.value)} style={{ width: '140px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                        <option value="all">All Types</option>
                        <option value="normal">Normal</option>
                        <option value="suggested">Suggested</option>
                        <option value="2000_plus">2000+</option>
                    </select>
                    <select className="input" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ width: '140px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                        <option value="all">All Sources</option>
                        <option value="facebook">Facebook</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="web">Web</option>
                        <option value="direct">Direct</option>
                        <option value="other">Other</option>
                    </select>
                    <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '160px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                        <option value="all">All Statuses</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="delivered">Delivered</option>
                        <option value="pending">Pending</option>
                        <option value="returned">Returned</option>
                        <option value="exchanged">Exchanged</option>
                        <option value="refunded">Refunded</option>
                        <option value="partial_refunded">Partial Refund</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select className="input" value={filterAdvanceStatus} onChange={(e) => setFilterAdvanceStatus(e.target.value)} style={{ width: '190px', padding: '8px 12px', fontSize: '0.8125rem' }}>
                        <option value="all">All Advance Status</option>
                        <option value="with_advance">With Advance</option>
                        <option value="verified">Verified</option>
                        <option value="pending_verification">Pending Verification</option>
                        <option value="no_advance">No Advance</option>
                    </select>
                    <div style={{ position: 'relative', minWidth: '200px' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', opacity: 0.5, pointerEvents: 'none' }}><IconSearch size={14} color="var(--color-text-tertiary)" /></span>
                        <input className="input" type="text" placeholder="Search customer, phone, invoice..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '32px', width: '100%', padding: '8px 12px 8px 32px', fontSize: '0.8125rem' }} />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: 'var(--color-text-tertiary)' }} title="Clear"><IconX size={14} /></button>
                        )}
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                        {dateRangeMode === 'today' ? formatDate(date) : dateRangeMode === 'week' ? `Week of ${formatDate(getWeekRange(new Date(date)).start)}` : dateRangeMode === 'month' ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : customStart && customEnd ? `${customStart} → ${customEnd}` : 'Select date range'}
                    </span>
                </motion.div>

                {/* Stats Cards */}
                <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px', alignItems: 'stretch' }}>
                    <div className="stat-card">
                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClipboard size={14} color="var(--color-text-tertiary)" /> Total Orders</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{stats.totalOrders}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconBanknote size={14} color="var(--color-text-tertiary)" /> Total Amount</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>৳{stats.totalAmount.toLocaleString()}</span>
                    </div>
                   
                    <div className="stat-card">
                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="var(--color-text-tertiary)" /> Pending Verification</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>৳{stats.pendingAdvanceAmount.toLocaleString()}</span>
                        <div style={{ fontSize: '0.6875rem', color: '#DC2626', marginTop: '4px' }}>Pending: {stats.pendingAdvanceCount}</div>
                    </div>
                     <div className="stat-card">
                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="var(--color-text-tertiary)" /> Verified Advance Payment</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>৳{stats.verifiedAdvanceAmount.toLocaleString()}</span>
                        <div style={{ fontSize: '0.6875rem', color: '#16A34A', marginTop: '4px' }}>Verified: {stats.verifiedAdvanceCount} Orders</div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconWallet size={14} color="var(--color-text-tertiary)" /> Advance Payment Source</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {Object.entries(stats.paymentGatewaySummary || {}).map(([gw, amount]) => (
                                <span key={gw} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.625rem', fontWeight: 600, color: PAYMENT_GATEWAY_COLORS[gw] || '#6B7280', background: `${PAYMENT_GATEWAY_COLORS[gw] || '#6B7280'}15` }}>
                                    {gw}: ৳{amount.toLocaleString()}
                                </span>
                            ))}
                            {Object.keys(stats.paymentGatewaySummary || {}).length === 0 && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>-</span>}
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconTarget size={14} color="var(--color-text-tertiary)" /> Order Status</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {Object.entries(stats.statusBreakdown || {}).map(([st, count]) => {
                                const cfg = STATUS_CONFIG[st] || { label: st, color: '#6B7280' }
                                return (
                                    <span key={st} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.625rem', fontWeight: 600, color: cfg.color, background: `${cfg.color}15` }}>
                                        {cfg.label}: {count}
                                    </span>
                                )
                            })}
                            {Object.keys(stats.statusBreakdown || {}).length === 0 && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>-</span>}
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconLayers size={14} color="var(--color-text-tertiary)" /> Order Types</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {Object.entries(stats.orderTypes || {}).map(([ot, count]) => (
                                <span key={ot} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.625rem', fontWeight: 600, color: ORDER_TYPE_COLORS[ot] || '#6B7280', background: `${ORDER_TYPE_COLORS[ot] || '#6B7280'}15` }}>
                                    {ORDER_TYPE_LABELS[ot] || ot}: {count}
                                </span>
                            ))}
                            {Object.keys(stats.orderTypes || {}).length === 0 && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>-</span>}
                        </div>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="var(--color-text-tertiary)"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            Sources
                        </span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {Object.entries(stats.sources || {}).map(([src, count]) => (
                                <span key={src} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.625rem', fontWeight: 600, color: SOURCE_COLORS[src] || '#6B7280', background: `${SOURCE_COLORS[src] || '#6B7280'}15` }}>
                                    {SOURCE_LABELS[src] || src}: {count}
                                </span>
                            ))}
                            {Object.keys(stats.sources || {}).length === 0 && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>-</span>}
                        </div>
                    </div>
                </motion.div>

                {/* Entries Table */}
                {loading ? (
                    <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                        <span className="spinner" style={{ margin: '0 auto', display: 'block', width: '32px', height: '32px' }} />
                    </div>
                ) : entries.length === 0 ? (
                    <motion.div className="empty-state" variants={item}>
                        <IconFileText size={48} color="#94A3B8" />
                        <h3>No entries for this date</h3>
                        <p>Start logging work by adding your first entry.</p>
                        <button className="btn btn-primary" onClick={() => { setEditingEntry(null); setShowModal(true) }}>Add Entry</button>
                    </motion.div>
                ) : (
                    <motion.div className="table-container" variants={item}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>SL</th>
                                    <th>Member</th>
                                    <th>Customer</th>
                                    <th>Source</th>
                                    <th>Type</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                    <th>Advance</th>
                                    <th>Status</th>
                                    <th style={{ width: '60px' }}></th>
                                    <th style={{ width: '44px', textAlign: 'center' }} title="Management Check"><IconCheckCircle size={14} color="var(--color-text-tertiary)" /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {quickMode && (
                                    <tr style={{ background: 'rgba(37,99,235,0.04)' }}>
                                        <td><IconBolt size={14} color="#2563EB" /></td>
                                        <td>
                                            {isMember ? (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{currentUser.name}</span>
                                            ) : (
                                                <select value={quickForm.employee_id} onChange={e => setQuickForm({ ...quickForm, employee_id: e.target.value })} style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem', border: '1px solid var(--color-border-light)', borderRadius: '6px', background: 'var(--color-bg-primary)' }}>
                                                    <option value="">-</option>
                                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <input value={quickForm.customer_name} onChange={e => setQuickForm({ ...quickForm, customer_name: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickSubmit()} placeholder="Name" style={{ width: '50%', padding: '4px 6px', fontSize: '0.75rem', border: '1px solid var(--color-border-light)', borderRadius: '6px' }} />
                                                <input value={quickForm.customer_phone} onChange={e => setQuickForm({ ...quickForm, customer_phone: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickSubmit()} placeholder="Phone" style={{ width: '50%', padding: '4px 6px', fontSize: '0.75rem', border: '1px solid var(--color-border-light)', borderRadius: '6px', fontFamily: 'monospace' }} />
                                            </div>
                                        </td>
                                        <td><select value={quickForm.source} onChange={e => setQuickForm({ ...quickForm, source: e.target.value })} style={{ padding: '4px 4px', fontSize: '0.7rem', border: '1px solid var(--color-border-light)', borderRadius: '6px', background: 'var(--color-bg-primary)' }}><option value="" disabled>Src</option><option value="facebook">FB</option><option value="whatsapp">WA</option><option value="web">Web</option><option value="direct">Direct</option></select></td>
                                        <td><select value={quickForm.order_type} onChange={e => setQuickForm({ ...quickForm, order_type: e.target.value })} style={{ padding: '4px 4px', fontSize: '0.7rem', border: '1px solid var(--color-border-light)', borderRadius: '6px', background: 'var(--color-bg-primary)' }}><option value="" disabled>Type</option><option value="normal">Normal</option><option value="2000_plus">2000+</option><option value="3000_plus">3000+</option><option value="5000_plus">5000+</option><option value="suggested">Sugg</option><option value="upsell">Upsell</option><option value="incomplete">Incomp</option><option value="exchange">Exchg</option></select></td>
                                        <td><input type="number" value={quickForm.amount} onChange={e => setQuickForm({ ...quickForm, amount: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickSubmit()} placeholder="৳" style={{ width: '80px', padding: '4px 6px', fontSize: '0.75rem', border: '1px solid var(--color-border-light)', borderRadius: '6px', textAlign: 'right' }} /></td>
                                        <td><select value={quickForm.delivery_status} onChange={e => setQuickForm({ ...quickForm, delivery_status: e.target.value })} style={{ padding: '4px 4px', fontSize: '0.7rem', border: '1px solid var(--color-border-light)', borderRadius: '6px', background: 'var(--color-bg-primary)' }}><option value="confirmed">Confirmed</option><option value="delivered">Done</option><option value="pending">Pending</option><option value="returned">Return</option><option value="exchanged">Exchange</option><option value="refunded">Refund</option><option value="cancelled">Cancel</option></select></td>
                                        <td colSpan={2}>
                                            <button className="btn btn-primary btn-sm" onClick={handleQuickSubmit} disabled={quickSaving} style={{ padding: '4px 10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <IconPlus size={12} /> {quickSaving ? '...' : 'Add'}
                                            </button>
                                        </td>
                                    </tr>
                                )}
                                {displayedEntries.length === 0 && entries.length > 0 && (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>No orders match &quot;{searchQuery}&quot;</td></tr>
                                )}
                                {displayedEntries.map((entry) => {
                                    const statusCfg = STATUS_CONFIG[entry.delivery_status] || STATUS_CONFIG.pending
                                    const otColor = ORDER_TYPE_COLORS[entry.order_type] || '#6B7280'
                                    return (
                                        <tr key={entry.id}>
                                            <td style={{ fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{entry.sl}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#2563EB', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 600, flexShrink: 0 }}>
                                                        {entry.employee?.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <span style={{ fontSize: '0.8125rem' }}>{entry.employee?.name || '-'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.8125rem' }}>
                                                    {entry.customer_name && <div style={{ fontWeight: 500 }}>{entry.customer_name}</div>}
                                                    {entry.customer_phone && <div style={{ fontFamily: 'monospace', color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>{entry.customer_phone}</div>}
                                                    {!entry.customer_name && !entry.customer_phone && '-'}
                                                </div>
                                            </td>
                                            <td><span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>{SOURCE_LABELS[entry.source] || entry.source}</span></td>
                                            <td><span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.625rem', fontWeight: 600, color: otColor, background: `${otColor}15` }}>{ORDER_TYPE_LABELS[entry.order_type] || entry.order_type}</span></td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>৳{(Number(entry.amount) + Number(entry.suggested_amount || 0)).toLocaleString()}</td>
                                            <td>
                                                {Number(entry.advance) > 0 ? (
                                                    <div style={{ fontSize: '0.75rem' }}>
                                                        <div style={{ fontWeight: 600 }}>৳{Number(entry.advance).toLocaleString()}</div>
                                                        {entry.advance_verified ? (
                                                            <div style={{ color: '#16A34A' }}>
                                                                ✅ Verified
                                                                {entry.verifier?.name && (
                                                                    <span style={{ color: '#6B7280', fontWeight: 500 }}>
                                                                        {' '}({entry.verifier.name})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div style={{ color: '#DC2626' }}>❌ Pending Verification</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                                        <div>৳0</div>
                                                        <div>—</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <select value={entry.delivery_status} onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                                                    style={{ padding: '3px 6px', fontSize: '0.6875rem', fontWeight: 600, border: `1px solid ${statusCfg.color}40`, borderRadius: '6px', cursor: 'pointer', color: statusCfg.color, background: `${statusCfg.color}10` }}>
                                                    <option value="confirmed">Confirmed</option>
                                                    <option value="delivered">Delivered</option>
                                                    <option value="pending">Pending</option>
                                                    <option value="returned">Returned</option>
                                                    <option value="exchanged">Exchanged</option>
                                                    <option value="refunded">Refunded</option>
                                                    <option value="partial_refunded">Partial Refund</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </select>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="btn btn-ghost btn-icon" onClick={() => { setEditingEntry(entry); setShowModal(true) }} style={{ padding: '4px' }} title="Edit"><IconEdit size={14} /></button>
                                                    {isAdmin && <button className="btn btn-ghost btn-icon" onClick={() => openHistory(entry)} style={{ padding: '4px', color: '#64748B' }} title="View history"><IconClock size={14} /></button>}
                                                    {currentUser?.is_super && <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(entry.id)} style={{ padding: '4px', color: '#64748B' }} title="Delete"><IconTrash size={14} /></button>}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn btn-ghost btn-icon"
                                                    onClick={async () => {
                                                        const newVal = !entry.management_check
                                                        const prevEntries = entries
                                                        setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, management_check: newVal } : e))
                                                        try {
                                                            const res = await fetch('/api/work-log/check', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_id: entry.id, management_check: newVal }) })
                                                            if (!res.ok) { setEntries(prevEntries); const er = await res.json().catch(() => ({})); toast.error(er.error || 'Failed to update approval') }
                                                        } catch { setEntries(prevEntries); toast.error('Failed to update approval') }
                                                    }}
                                                    style={{ padding: '4px', color: entry.management_check ? '#16A34A' : '#D1D5DB' }}
                                                    title={entry.management_check ? 'Approved' : 'Click to approve'}>
                                                    <IconCheckCircle size={18} color={entry.management_check ? '#16A34A' : '#D1D5DB'} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </motion.div>
                )}

                {/* Modal */}
                {showModal && (
                    <WorkEntryModal entry={editingEntry} date={date} employees={employees} currentUser={currentUser} onClose={() => { setShowModal(false); setEditingEntry(null) }} onSave={handleSave} />
                )}

                {/* Per-entry History / Activity Log (#7) */}
                {historyEntry && (
                    <div className="modal-overlay" onClick={() => setHistoryEntry(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                        <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
                            className="card" style={{ maxWidth: '460px', width: '100%', maxHeight: '80vh', overflow: 'auto', padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Order History</h3>
                                <button className="btn btn-ghost btn-icon" onClick={() => setHistoryEntry(null)} style={{ padding: '4px' }}><IconX size={18} /></button>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '14px' }}>
                                {historyEntry.customer_name || historyEntry.invoice_no || 'Order'} · {historyEntry.employee?.name || ''}
                            </div>
                            {historyLoading ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>Loading...</div>
                            ) : historyLogs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>No activity recorded for this order yet.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {historyLogs.map((log) => {
                                        const actor = log.details?.actor_name || log.actor?.name || 'Someone'
                                        const changes = Array.isArray(log.details?.changes) ? log.details.changes : []
                                        let summary = log.action
                                        if (log.action === 'Added new work entry') summary = 'created this order'
                                        else if (log.action === 'Deleted work log entry') summary = 'deleted this order'
                                        else if (log.action === 'status_change') summary = `changed status: ${log.old_value ?? '?'} → ${log.new_value ?? '?'}`
                                        else if (log.action === 'Updated work log entry') summary = changes.length ? 'edited this order' : 'updated this order'
                                        return (
                                            <div key={log.id} style={{ display: 'flex', gap: '10px', fontSize: '0.8125rem', borderLeft: '2px solid var(--color-border-light)', paddingLeft: '10px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div><span style={{ fontWeight: 600 }}>{actor}</span> <span style={{ color: 'var(--color-text-secondary)' }}>{summary}</span></div>
                                                    {changes.length > 0 && (
                                                        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            {changes.map((c: { field: string; from: unknown; to: unknown }, i: number) => (
                                                                <div key={i} style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
                                                                    <span style={{ fontWeight: 600 }}>{c.field.replace(/_/g, ' ')}</span>: {String(c.from ?? '—')} → {String(c.to ?? '—')}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '3px' }}>{new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}

                {/* Ranking Board Modal */}
                <AnimatePresence>
                    {showRanking && (
                        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRanking(false)}>
                            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
                                <div className="modal-header">
                                    <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <IconTrophy size={20} color="#F59E0B" /> Ranking Board
                                    </h2>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowRanking(false)}><IconX size={20} /></button>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', padding: '0 0 16px', justifyContent: 'center' }}>
                                    {(['daily', 'weekly', 'monthly'] as const).map(p => (
                                        <button key={p} className={`btn btn-sm ${rankingPeriod === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setRankingPeriod(p); fetchRanking(p) }} style={{ textTransform: 'capitalize' }}>{p === 'daily' ? 'Today' : p}</button>
                                    ))}
                                </div>
                                <div className="modal-body" style={{ maxHeight: '400px', overflow: 'auto' }}>
                                    {rankingLoading ? (
                                        <div style={{ textAlign: 'center', padding: '40px' }}><span className="spinner" style={{ margin: '0 auto', display: 'block', width: '24px', height: '24px' }} /></div>
                                    ) : rankingData.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No entries for this period</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {rankingData.map((r, idx) => (
                                                <div key={r.employee_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: idx < 3 ? `${medalColors[idx]}08` : 'var(--color-surface)', border: `1px solid ${idx < 3 ? `${medalColors[idx]}30` : 'var(--color-border-light)'}`, borderRadius: '12px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: idx < 3 ? '0.875rem' : '0.8125rem', background: idx < 3 ? `${medalColors[idx]}20` : 'rgba(100,116,139,0.08)', color: idx < 3 ? medalColors[idx] : 'var(--color-text-tertiary)' }}>
                                                        {idx < 3 ? <IconTrophy size={16} color={medalColors[idx]} /> : `#${idx + 1}`}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{r.name}</div>
                                                        {r.emp_code && <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>ID: {r.emp_code}</div>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                        <div style={{ textAlign: 'center', width: '48px' }}>
                                                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#2563EB' }}>{r.totalOrders}</div>
                                                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>Orders</div>
                                                        </div>
                                                        <div style={{ textAlign: 'center', width: '80px' }}>
                                                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#10B981' }}>৳{r.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>Amount</div>
                                                        </div>
                                                        <div style={{ textAlign: 'center', width: '40px' }}>
                                                            {r.orders2000Plus > 0 ? (
                                                                <>
                                                                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#F59E0B' }}>{r.orders2000Plus}</div>
                                                                    <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>2000+</div>
                                                                </>
                                                            ) : <span style={{ width: '100%', display: 'inline-block' }}></span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
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
