'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { IconAlertCircle, IconCheckCircle, IconXCircle, IconTrendingUp, IconSearch, IconCalendar } from '@/components/icons/Icons'
import DatePicker from '@/components/ui/DatePicker'

type Fine = {
    id: string
    member_id: string
    issued_by: string
    amount: number
    category: string
    reason: string
    status: 'Active' | 'Appealed' | 'Waived'
    appeal_reason: string | null
    created_at: string
    member?: { name: string }
    issued_by_user?: { name: string }
}

const CATEGORIES = [
    'Discipline Issue (শৃঙ্খলা ভঙ্গ)',
    'Late Arrival (দেরিতে আসা)',
    'Damaged Property (জিনিসপত্র নষ্ট করা)',
    'Disobeyed Instructions (কথা না শোনা)',
    'Unprofessional Behavior (অপেশাদার আচরণ)',
    'Wasted Resources (রিসোর্স নষ্ট করা, যেমন এসি/পানি)',
    'Others (অন্যান্য)'
]

const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'Active', label: 'Active' },
    { key: 'Appealed', label: 'Appealed' },
    { key: 'Waived', label: 'Waived' }
]


function UserSelect({ value, onChange, options }: { value: string, onChange: (val: string) => void, options: { id: string, name: string, avatar_url: string | null }[] }) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredOptions = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
    const selected = options.find(o => o.id === value)

    return (
        <div className="form-group" style={{ position: 'relative' }} ref={containerRef}>
            <label className="form-label">Select Member</label>
            <div 
                className="form-input" 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '10px 12px' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                {selected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {selected.avatar_url ? (
                            <img src={selected.avatar_url} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                                {selected.name.charAt(0)}
                            </div>
                        )}
                        <span style={{ fontSize: '0.875rem' }}>{selected.name}</span>
                    </div>
                ) : (
                    <span style={{ color: 'var(--color-text-tertiary)', padding: '3px 0' }}>Select a member...</span>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)' }}><path d="m6 9 6 6 6-6"/></svg>
            </div>
            
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        style={{ 
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, 
                            background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', 
                            borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: '4px',
                            maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column' 
                        }}
                    >
                        <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border-light)', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2 }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>
                                    <IconSearch size={14} />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Search members..." 
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    autoFocus
                                    className="input"
                                    style={{ width: '100%', padding: '8px 10px 8px 32px', fontSize: '0.8125rem', height: '34px', borderRadius: '6px' }}
                                />
                            </div>
                        </div>
                        <div style={{ padding: '4px' }}>
                            {filteredOptions.length === 0 ? (
                                <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>No members found</div>
                            ) : (
                                filteredOptions.map(emp => (
                                    <div 
                                        key={emp.id}
                                        onClick={() => { onChange(emp.id); setIsOpen(false); setSearch('') }}
                                        style={{ 
                                            padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '10px', 
                                            cursor: 'pointer', borderRadius: '6px',
                                            background: value === emp.id ? 'var(--color-bg-secondary)' : 'transparent',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = value === emp.id ? 'var(--color-bg-secondary)' : 'transparent'}
                                    >
                                        {emp.avatar_url ? (
                                            <img src={emp.avatar_url} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                                                {emp.name.charAt(0)}
                                            </div>
                                        )}
                                        <span style={{ fontSize: '0.875rem', fontWeight: value === emp.id ? 600 : 400 }}>{emp.name}</span>
                                        {value === emp.id && (
                                            <div style={{ marginLeft: 'auto', color: '#10B981' }}>
                                                <IconCheckCircle size={16} />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function FinesPage() {
    const supabase = createClient()
    const toast = useToast()
    const { data: permData } = usePermissions()
    const isAdmin = permData.is_admin || permData.is_super
    const isSuper = permData.is_super

    const [fines, setFines] = useState<Fine[]>([])
    const [loading, setLoading] = useState(true)
    const [employees, setEmployees] = useState<{ id: string, name: string, avatar_url: string | null }[]>([])

    // Interactive Filters
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [dateRangeMode, setDateRangeMode] = useState<'all'|'today'|'week'|'month'|'custom'>('all')
    const [refDate, setRefDate] = useState(() => fmtLocalDate(new Date()))
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    // Modals state
    const [showAddModal, setShowAddModal] = useState(false)
    const [showAppealModal, setShowAppealModal] = useState<string | null>(null)
    const [appealReason, setAppealReason] = useState('')

    // Add Fine form state
    const [addForm, setAddForm] = useState({
        member_id: '',
        amount: '',
        category: CATEGORIES[0],
        reason: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchFines()
        if (isAdmin) {
            fetchEmployees()
        }
    }, [isAdmin])

    const fetchFines = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/fines')
            const json = await res.json()
            if (json.data) {
                setFines(json.data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const fetchEmployees = async () => {
        const { data } = await supabase.from('employees').select('id, name, avatar_url').eq('is_active', true).order('name')
        if (data) setEmployees(data)
    }

    const handleAddFine = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!addForm.member_id || !addForm.amount || !addForm.reason) {
            toast.error('Please fill all required fields')
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/fines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    member_id: addForm.member_id,
                    amount: parseInt(addForm.amount),
                    category: addForm.category,
                    reason: addForm.reason
                })
            })
            const json = await res.json()
            if (res.ok) {
                toast.success('Fine added successfully')
                setShowAddModal(false)
                setAddForm({ member_id: '', amount: '', category: CATEGORIES[0], reason: '' })
                fetchFines()
            } else {
                toast.error(json.error || 'Failed to add fine')
            }
        } catch (error) {
            toast.error('An error occurred')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleAppeal = async (fineId: string) => {
        if (!appealReason) {
            toast.error('Please provide an appeal reason')
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/fines/${fineId}/appeal`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appeal_reason: appealReason })
            })
            const json = await res.json()
            if (res.ok) {
                toast.success('Appeal submitted successfully')
                setShowAppealModal(null)
                setAppealReason('')
                fetchFines()
            } else {
                toast.error(json.error || 'Failed to submit appeal')
            }
        } catch (error) {
            toast.error('An error occurred')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleReview = async (fineId: string, action: 'waive' | 'reject') => {
        if (!window.confirm(`Are you sure you want to ${action} this appeal?`)) return
        
        try {
            const res = await fetch(`/api/fines/${fineId}/review`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })
            const json = await res.json()
            if (res.ok) {
                toast.success(`Appeal ${action === 'waive' ? 'waived' : 'rejected'} successfully`)
                fetchFines()
            } else {
                toast.error(json.error || 'Failed to process appeal')
            }
        } catch (error) {
            toast.error('An error occurred')
        }
    }

    const canAppeal = (fine: Fine) => {
        if (isAdmin) return false // Admins don't appeal their own view here
        if (fine.status !== 'Active') return false
        const createdDate = new Date(fine.created_at)
        const diffDays = (new Date().getTime() - createdDate.getTime()) / (1000 * 3600 * 24)
        return diffDays <= 3
    }

    const filteredFines = fines.filter(fine => {
        // Status filter
        if (activeFilter !== 'all' && fine.status !== activeFilter) return false
        
        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (!(fine.member?.name || '').toLowerCase().includes(q) &&
                !(fine.reason || '').toLowerCase().includes(q) &&
                !(fine.category || '').toLowerCase().includes(q)) return false
        }
        
        // Date filter
        if (dateRangeMode !== 'all') {
            const d = new Date(fine.created_at)
            const dStr = fmtLocalDate(d)
            if (dateRangeMode === 'today') {
                if (dStr !== refDate) return false
            } else if (dateRangeMode === 'week') {
                const r = new Date(refDate + 'T00:00:00')
                const start = new Date(r); start.setDate(start.getDate() - start.getDay())
                const end = new Date(start); end.setDate(start.getDate() + 6)
                const fTime = d.getTime()
                if (fTime < start.getTime() || fTime > end.getTime()) return false
            } else if (dateRangeMode === 'month') {
                const r = new Date(refDate + 'T00:00:00')
                if (d.getFullYear() !== r.getFullYear() || d.getMonth() !== r.getMonth()) return false
            } else if (dateRangeMode === 'custom' && customStart && customEnd) {
                if (dStr < customStart || dStr > customEnd) return false
            }
        }
        
        return true
    })

    const stats = {
        totalFines: filteredFines.length,
        activeAppeals: filteredFines.filter(f => f.status === 'Appealed').length,
        waivedFines: filteredFines.filter(f => f.status === 'Waived').length,
        pointsDeducted: filteredFines.filter(f => f.status !== 'Waived').reduce((acc, curr) => acc + curr.amount, 0)
    }

    const statCards = [
        { label: 'Total Fines', value: stats.totalFines, color: '#1E3A5F', icon: <IconAlertCircle size={20} color="#1E3A5F" /> },
        { label: 'Points Deducted', value: stats.pointsDeducted, color: '#DC2626', icon: <IconTrendingUp size={20} color="#DC2626" /> },
        { label: 'Active Appeals', value: stats.activeAppeals, color: '#F59E0B', icon: <IconAlertCircle size={20} color="#F59E0B" /> },
        { label: 'Fines Waived', value: stats.waivedFines, color: '#10B981', icon: <IconCheckCircle size={20} color="#10B981" /> },
    ]

    return (
        <motion.div variants={container} animate="show" initial="hidden">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Fines & Penalties</h1>
                    <p className="page-subtitle">Manage member infractions, deduct points, and handle appeals.</p>
                </div>
                {isAdmin && (
                    <button className="btn btn-danger btn-sm" onClick={() => setShowAddModal(true)}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Issue Fine
                    </button>
                )}
            </motion.div>

            {/* Date Range Selector */}
            <motion.div variants={item} style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {([{ key: 'all', label: 'All Time' }, { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }] as const).map(tab => (
                        <button key={tab.key} onClick={() => setDateRangeMode(tab.key)}
                            style={{
                                position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                color: dateRangeMode === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                            }}>
                            {dateRangeMode === tab.key && (
                                <motion.div layoutId="finesDateTab" style={{
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
            <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {statCards.map(s => (
                    <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', background: `${s.color}10` }}>{s.icon}</span>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
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
                                <motion.div layoutId="finesFilterTab" style={{
                                    position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                    borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>
                
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}>
                        <IconSearch size={16} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search by member, category, or reason..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="input" 
                        style={{ paddingLeft: '36px', width: '100%' }}
                    />
                </div>
            </motion.div>

            <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {loading ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                        <div className="spinner" style={{ margin: '0 auto var(--space-lg)' }}></div>
                        <p>Loading fines...</p>
                    </div>
                ) : filteredFines.length === 0 ? (
                    <div className="empty-state card" style={{ gridColumn: '1 / -1' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <h3>No fines found</h3>
                        <p>There are currently no fines matching your filters.</p>
                    </div>
                ) : (
                    filteredFines.map(fine => (
                        <motion.div key={fine.id} className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                        - {fine.amount} Pts
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                        {new Date(fine.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <span style={{
                                    padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '20px',
                                    background: fine.status === 'Active' ? 'rgba(220,38,38,0.1)' : fine.status === 'Appealed' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                                    color: fine.status === 'Active' ? '#DC2626' : fine.status === 'Appealed' ? '#F59E0B' : '#10B981'
                                }}>
                                    {fine.status}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '0.875rem' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Member: </span>
                                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{fine.member?.name || 'Unknown'}</span>
                                </div>
                                <div style={{ fontSize: '0.875rem' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Category: </span>
                                    <span style={{ color: 'var(--color-text-primary)' }}>{fine.category.split(' (')[0]}</span>
                                </div>
                                <div style={{ fontSize: '0.875rem', background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: '8px', color: 'var(--color-text-secondary)' }}>
                                    "{fine.reason}"
                                </div>
                            </div>

                            {fine.status === 'Appealed' && (
                                <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#D97706', marginBottom: '4px' }}>Appeal Reason:</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>"{fine.appeal_reason}"</div>
                                    
                                    {isSuper && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                            <button 
                                                onClick={() => handleReview(fine.id, 'waive')}
                                                className="btn btn-sm"
                                                style={{ flex: 1, background: '#10B981', color: 'white' }}
                                            >
                                                Waive & Refund
                                            </button>
                                            <button 
                                                onClick={() => handleReview(fine.id, 'reject')}
                                                className="btn btn-danger btn-sm"
                                                style={{ flex: 1 }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {canAppeal(fine) && (
                                <button
                                    onClick={() => setShowAppealModal(fine.id)}
                                    className="btn btn-secondary w-full"
                                    style={{ marginTop: '8px' }}
                                >
                                    Appeal Fine
                                </button>
                            )}
                        </motion.div>
                    ))
                )}
            </motion.div>

            {/* Add Fine Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="modal-overlay">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="modal"
                        >
                            <div className="modal-header">
                                <h2 className="modal-title">Issue a Fine</h2>
                            </div>
                            <form onSubmit={handleAddFine}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <UserSelect 
                                        value={addForm.member_id} 
                                        onChange={val => setAddForm({...addForm, member_id: val})} 
                                        options={employees} 
                                    />
                                    <div className="form-group">
                                        <label className="form-label">Fine Amount (Points)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={addForm.amount}
                                            onChange={e => setAddForm({...addForm, amount: e.target.value})}
                                            className="form-input"
                                            placeholder="e.g. 100"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select
                                            value={addForm.category}
                                            onChange={e => setAddForm({...addForm, category: e.target.value})}
                                            className="form-input"
                                        >
                                            {CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Reason / Details</label>
                                        <textarea
                                            value={addForm.reason}
                                            onChange={e => setAddForm({...addForm, reason: e.target.value})}
                                            className="form-input"
                                            style={{ minHeight: '100px' }}
                                            placeholder="Briefly explain the reason for this fine..."
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="btn btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="btn btn-danger"
                                    >
                                        {isSubmitting ? 'Issuing...' : 'Issue Fine'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Appeal Modal */}
            <AnimatePresence>
                {showAppealModal && (
                    <div className="modal-overlay">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="modal"
                        >
                            <div className="modal-header">
                                <h2 className="modal-title">Appeal Fine</h2>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                                    Explain why you believe this fine was issued incorrectly. This appeal will be reviewed directly by the Super Admin.
                                </p>
                                <div className="form-group">
                                    <textarea
                                        value={appealReason}
                                        onChange={e => setAppealReason(e.target.value)}
                                        className="form-input"
                                        style={{ minHeight: '120px' }}
                                        placeholder="Your reason for appeal..."
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    onClick={() => {
                                        setShowAppealModal(null)
                                        setAppealReason('')
                                    }}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAppeal(showAppealModal)}
                                    disabled={isSubmitting || !appealReason.trim()}
                                    className="btn btn-primary"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Appeal'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
