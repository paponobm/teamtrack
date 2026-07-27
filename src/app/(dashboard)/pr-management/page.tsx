'use client'

import RequireFeature from '@/components/common/RequireFeature'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { usePermissions } from '@/lib/PermissionsContext'
import { useLanguage } from '@/lib/LanguageContext'
import {
    IconClipboard, IconCheckCircle, IconPlus, IconX,
    IconSearch, IconPlay, IconEdit, IconTrash, IconPackage, IconCamera
} from '@/components/icons/Icons'
import InfluencerDrawer from '@/components/pr-management/InfluencerDrawer'

interface PREntry {
    id: string
    send_date: string
    customer_name: string
    customer_phone: string
    address: string
    parcel_details: string
    source: string
    delivery_status: string
    video_status: string
    payment_status: string
    video_link: string
    view_note: string
    ai_comments: string
    influencer_id?: string | null
    created_at: string
}

export interface Influencer {
    id: string
    name: string
    phone?: string
    page_url?: string
    follower_count: number
    rating: number
    notes?: string
    created_at: string
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

const emptyForm = {
    send_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    customer_phone: '',
    address: '',
    parcel_details: '',
    source: 'FB',
    delivery_status: 'Product Sent',
    video_status: 'Pending',
    payment_status: 'Unpaid',
    video_link: '',
    view_note: '',
    ai_comments: ''
}

// Editable Cell Component for Spreadsheet feel
function EditableCell({ value, onSave, placeholder = '', type = 'text', style = {} }: any) {
    const [editing, setEditing] = useState(false)
    const [val, setVal] = useState(value || '')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setVal(value || '')
    }, [value])

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus()
        }
    }, [editing])

    const handleBlur = () => {
        setEditing(false)
        if (val !== (value || '')) {
            onSave(val)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur()
        }
        if (e.key === 'Escape') {
            setVal(value || '')
            setEditing(false)
        }
    }

    if (editing) {
        return (
            <input
                ref={inputRef}
                type={type}
                value={val}
                onChange={e => setVal(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="editable-input"
                style={{
                    width: '100%',
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    boxShadow: '0 0 0 2px rgba(59,130,246,0.2)',
                    ...style
                }}
            />
        )
    }

    return (
        <div 
            onClick={() => setEditing(true)} 
            style={{ 
                cursor: 'pointer', 
                minHeight: '18px', 
                padding: '0px 4px', 
                borderRadius: '4px',
                border: '1px solid transparent',
                transition: 'border-color 0.2s',
                wordBreak: 'break-word',
                ...style
            }}
            className="editable-cell-hover"
            title="Click to edit"
        >
            {value ? value : <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{placeholder}</span>}
        </div>
    )
}

const sourceIconMap: Record<string, any> = {
    'FB': <svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    'WhatsApp': <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>,
    'Instagram': <svg width="14" height="14" viewBox="0 0 24 24" fill="#E1306C"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
    'YouTube': <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
}

function ModernSelect({ value, options, onChange, colorStyle, iconMap, direction = 'down' }: any) {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleOutside = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }
        document.addEventListener('mousedown', handleOutside)
        return () => document.removeEventListener('mousedown', handleOutside)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative', width: 'fit-content' }}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500,
                    border: '1px solid transparent', cursor: 'pointer',
                    background: colorStyle?.bg || 'rgba(118,118,128,0.06)', 
                    color: colorStyle?.text || 'inherit',
                    transition: 'all 0.2s', outline: 'none',
                    whiteSpace: 'nowrap'
                }}
            >
                {iconMap?.[value] && <span style={{display:'flex'}}>{iconMap[value]}</span>}
                {value}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginLeft: '2px' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: direction === 'up' ? 4 : -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: direction === 'up' ? 4 : -4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            position: 'absolute', 
                            ...(direction === 'up' ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
                            left: 0,
                            background: 'var(--color-surface)', border: '1px solid var(--color-border-light)',
                            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            padding: '4px', zIndex: 50, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '2px'
                        }}
                    >
                        {options.map((opt: string) => (
                            <button
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent',
                                    textAlign: 'left', fontSize: '0.75rem', cursor: 'pointer',
                                    color: value === opt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                    fontWeight: value === opt ? 600 : 400
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(118,118,128,0.08)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                {iconMap?.[opt] && <span style={{display:'flex'}}>{iconMap[opt]}</span>}
                                {opt}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function PRManagementPage() {
    const { t } = useLanguage()
    const { data: perms } = usePermissions()
    const toast = useToast()

    const [entries, setEntries] = useState<PREntry[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeFilter, setActiveFilter] = useState('all')
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
    const [videoPromptId, setVideoPromptId] = useState<string | null>(null)
    const [tempVideoLink, setTempVideoLink] = useState('')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [showAnalytics, setShowAnalytics] = useState(false)
    const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(null)

    const fetchEntries = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/pr-management')
            if (res.ok) {
                const data = await res.json()
                setEntries(data.data || [])
            }
        } catch {
            console.error('Failed to fetch PR entries')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchEntries()
    }, [fetchEntries])

    const openAddModal = () => {
        setForm(emptyForm)
        setShowAddModal(true)
    }

    const isFormValid = form.customer_name.trim() && form.customer_phone.trim() && form.parcel_details.trim()

    const handleSave = async () => {
        if (!isFormValid) return
        setSaving(true)
        try {
            const res = await fetch('/api/pr-management', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })

            if (res.ok) {
                toast.success(t('pr.saveEntry'))
                await fetchEntries()
                setShowAddModal(false)
            } else {
                const errData = await res.json().catch(() => ({}))
                toast.error(`Error: ${errData.error || 'Failed to save'}`)
            }
        } catch (e) {
            toast.error('Save failed')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this PR entry?')) return
        try {
            const res = await fetch(`/api/pr-management?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Deleted successfully')
                setEntries(entries.filter(e => e.id !== id))
            }
        } catch {
            toast.error('Delete failed')
        }
    }

    const handleInlineUpdate = async (id: string, field: string, value: string) => {
        // Optimistic update
        setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
        try {
            const res = await fetch('/api/pr-management', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, [field]: value })
            })
            if (!res.ok) throw new Error('Update failed')
            toast.success('Saved')
        } catch {
            toast.error('Failed to save changes')
            await fetchEntries() // Revert on failure
        }
    }

    const handleBulkUpdate = async (field: string, value: string) => {
        if (!confirm(`Update ${selectedIds.length} entries?`)) return
        
        // Optimistic update
        setEntries(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, [field]: value } : e))
        
        try {
            const res = await fetch('/api/pr-management/bulk', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, updates: { [field]: value } })
            })
            if (!res.ok) throw new Error('Bulk update failed')
            toast.success(`Updated ${selectedIds.length} entries`)
            setSelectedIds([])
        } catch {
            toast.error('Failed to update')
            await fetchEntries()
        }
    }

    const filtered = entries.filter(p => {
        if (activeFilter === 'pending' && p.video_status !== 'Pending') return false
        if (activeFilter === 'received' && p.delivery_status !== 'Product Received') return false
        if (activeFilter === 'uploaded' && p.video_status !== 'Video Uploaded') return false
        
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (!(p.customer_name || '').toLowerCase().includes(q) &&
                !(p.customer_phone || '').includes(q) &&
                !(p.parcel_details || '').toLowerCase().includes(q)) return false
        }
        return true
    })

    const stats = {
        totalSent: entries.length,
        received: entries.filter(e => e.delivery_status === 'Product Received').length,
        uploaded: entries.filter(e => e.video_status === 'Video Uploaded').length,
        overdue: entries.filter(e => e.video_status === 'Pending' && e.send_date && ((Date.now() - new Date(e.send_date).getTime()) / (1000 * 60 * 60 * 24)) > 7).length,
    }

    const statCards = [
        { label: t('pr.totalSent'), value: stats.totalSent, color: '#3B82F6', icon: <IconPackage size={20} color="#3B82F6" /> },
        { label: t('pr.productReceived'), value: stats.received, color: '#F59E0B', icon: <IconClipboard size={20} color="#F59E0B" /> },
        { label: t('pr.videoUploaded'), value: stats.uploaded, color: '#10B981', icon: <IconCheckCircle size={20} color="#10B981" /> },
        { label: 'Overdue (7+ Days)', value: stats.overdue, color: '#DC2626', icon: <span style={{fontSize: '18px'}}>⚠️</span> },
    ]

    const isAdmin = perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin'

    return (
        <RequireFeature slugs={['pr-sending']}>
            <style dangerouslySetInnerHTML={{__html: `
                .editable-cell-hover:hover { border-color: rgba(59,130,246,0.3) !important; background: rgba(59,130,246,0.05); }
                .spreadsheet-table { width: 100%; border-collapse: separate; border-spacing: 0; }
                .spreadsheet-table th { position: sticky; top: 0; background: var(--color-surface); z-index: 10; padding: 6px 12px; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border-light); white-space: nowrap; }
                .spreadsheet-table td { padding: 4px 12px; border-bottom: 1px solid var(--color-border-light); font-size: 0.75rem; vertical-align: middle; }
                .spreadsheet-table tr:hover td { background: rgba(118,118,128,0.03); }
            `}} />
            
            <motion.div variants={container} animate="show" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <motion.div className="page-header" variants={item}>
                    <div>
                        <h1 className="page-title">{t('pr.title')}</h1>
                        <p className="page-subtitle">{t('pr.subtitle')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowAnalytics(!showAnalytics)}>
                            <IconPackage size={16} /> {showAnalytics ? 'Hide Analytics' : 'Analytics'}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                            <IconPlus size={16} /> {t('pr.addBtn')}
                        </button>
                    </div>
                </motion.div>

                {/* Stats Section */}
                <motion.div variants={item} className="grid grid-4" style={{ gap: '16px', marginBottom: '24px' }}>
                    {statCards.map(s => (
                        <div key={s.label} 
                            style={{ 
                                position: 'relative', overflow: 'hidden', padding: '16px 20px', borderRadius: '16px',
                                background: `linear-gradient(135deg, var(--color-surface) 0%, ${s.color}10 100%)`, 
                                border: `1px solid ${s.color}20`,
                                boxShadow: `0 4px 20px ${s.color}10`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px'
                            }}>
                            <div style={{ position: 'absolute', top: '-15px', right: '-15px', opacity: 0.1, transform: 'scale(2.5)' }}>
                                {s.icon}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: `${s.color}15`, boxShadow: `0 2px 8px ${s.color}20` }}>
                                    {s.icon}
                                </span>
                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, position: 'relative', zIndex: 1 }}>
                                {s.value}
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Analytics Panel */}
                <AnimatePresence>
                    {showAnalytics && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                            <div className="grid grid-3" style={{ gap: '16px', marginBottom: '24px' }}>
                                {/* Source Breakdown */}
                                <div className="card" style={{ padding: '20px' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Leads by Source</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {Object.entries(
                                            entries.reduce((acc, e) => { acc[e.source || 'FB'] = (acc[e.source || 'FB'] || 0) + 1; return acc }, {} as Record<string, number>)
                                        ).map(([source, count]) => (
                                            <div key={source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {sourceIconMap[source] || <IconPackage size={14} />}
                                                    <span style={{ fontSize: '0.875rem' }}>{source}</span>
                                                </div>
                                                <span style={{ fontWeight: 600 }}>{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Conversion */}
                                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(16,185,129,0.1) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px', color: '#059669' }}>Conversion Rate</h3>
                                    <div style={{ fontSize: '3.5rem', fontWeight: 700, color: '#10B981', lineHeight: 1, marginBottom: '8px' }}>
                                        {entries.length > 0 ? Math.round((stats.uploaded / entries.length) * 100) : 0}%
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>of PRs uploaded a video</div>
                                </div>
                                {/* Payment Breakdown */}
                                <div className="card" style={{ padding: '20px' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Payment Status</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {Object.entries(
                                            entries.reduce((acc, e) => { acc[e.payment_status || 'Unpaid'] = (acc[e.payment_status || 'Unpaid'] || 0) + 1; return acc }, {} as Record<string, number>)
                                        ).map(([status, count]) => (
                                            <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.875rem' }}>{status}</span>
                                                <span style={{ fontWeight: 600 }}>{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Filters */}
                <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                            {[
                                { key: 'all', label: t('pr.filterAll') },
                                { key: 'pending', label: t('pr.filterPending') },
                                { key: 'received', label: t('pr.filterReceived') },
                                { key: 'uploaded', label: t('pr.filterUploaded') }
                            ].map(tab => (
                                <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                                    style={{ position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '0.8125rem', fontWeight: 500, background: 'transparent', color: activeFilter === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', transition: 'color 0.2s', zIndex: 1 }}>
                                    {activeFilter === tab.key && (
                                        <motion.div layoutId="prTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                    )}
                                    <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ position: 'relative', width: '250px' }}>
                            <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                            <input className="form-input" type="text" placeholder={t('pr.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                style={{ paddingLeft: '34px', height: '34px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px' }} />
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(118,118,128,0.08)', padding: '2px', borderRadius: '8px' }}>
                        <button onClick={() => setViewMode('table')} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: viewMode === 'table' ? 'var(--color-bg-primary)' : 'transparent', boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}><IconClipboard size={16} color={viewMode === 'table' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'} /></button>
                        <button onClick={() => setViewMode('cards')} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: viewMode === 'cards' ? 'var(--color-bg-primary)' : 'transparent', boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}><IconPackage size={16} color={viewMode === 'cards' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'} /></button>
                    </div>
                </motion.div>

                {/* Data Area */}
                <motion.div variants={item} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: '60px', borderRadius: '12px' }} />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            <IconPackage size={48} color="var(--color-text-tertiary)" />
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>{t('pr.noEntries')}</h3>
                        </div>
                    ) : viewMode === 'table' ? (
                        <div className="card" style={{ padding: 0, overflow: 'auto', flex: 1, borderRadius: '12px', border: '1px solid var(--color-border-light)', paddingBottom: '150px' }}>
                            <table className="spreadsheet-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>
                                            <input type="checkbox" 
                                                checked={filtered.length > 0 && selectedIds.length === filtered.length}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedIds(filtered.map(f => f.id))
                                                    else setSelectedIds([])
                                                }}
                                            />
                                        </th>
                                        <th style={{ minWidth: '100px' }}>Date</th>
                                        <th style={{ minWidth: '150px' }}>Customer / Phone</th>
                                        <th style={{ minWidth: '200px' }}>Address & Parcel</th>
                                        <th>Source</th>
                                        <th>Delivery Status</th>
                                        <th>Video Status</th>
                                        <th>Payment</th>
                                        <th style={{ minWidth: '120px' }}>Notes</th>
                                        <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(p => {
                                        const isActionNeeded = p.delivery_status === 'Product Received' && p.video_status === 'Pending'
                                        const overdue = p.video_status === 'Pending' && p.send_date && ((Date.now() - new Date(p.send_date).getTime()) / (1000 * 60 * 60 * 24)) > 7
                                        return (
                                            <tr key={p.id} style={{ background: overdue ? 'rgba(220,38,38,0.06)' : isActionNeeded ? 'rgba(220,38,38,0.02)' : 'transparent' }}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" 
                                                        checked={selectedIds.includes(p.id)}
                                                        onChange={e => {
                                                            if (e.target.checked) setSelectedIds([...selectedIds, p.id])
                                                            else setSelectedIds(selectedIds.filter(id => id !== p.id))
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <EditableCell 
                                                        type="date" 
                                                        value={p.send_date ? new Date(p.send_date).toISOString().split('T')[0] : ''} 
                                                        onSave={(val: string) => handleInlineUpdate(p.id, 'send_date', val)} 
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600, color: overdue ? '#DC2626' : 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {overdue && <span title="Overdue (7+ days pending video)">⚠️</span>}
                                                        {p.influencer_id ? (
                                                            <button 
                                                                onClick={() => setSelectedInfluencerId(p.influencer_id || '')}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                                                            >
                                                                {p.customer_name}
                                                            </button>
                                                        ) : (
                                                            <EditableCell value={p.customer_name} placeholder="Name" onSave={(val: string) => handleInlineUpdate(p.id, 'customer_name', val)} />
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                                        <EditableCell value={p.customer_phone} placeholder="Phone" onSave={(val: string) => handleInlineUpdate(p.id, 'customer_phone', val)} />
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>
                                                        <EditableCell value={p.parcel_details} placeholder="Parcel Info" onSave={(val: string) => handleInlineUpdate(p.id, 'parcel_details', val)} />
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                                        <EditableCell value={p.address} placeholder="Address" onSave={(val: string) => handleInlineUpdate(p.id, 'address', val)} />
                                                    </div>
                                                </td>
                                                <td>
                                                    <ModernSelect 
                                                        value={p.source || 'FB'} 
                                                        options={['FB', 'WhatsApp', 'Instagram', 'YouTube', 'Other']}
                                                        onChange={(val: string) => handleInlineUpdate(p.id, 'source', val)}
                                                        iconMap={sourceIconMap}
                                                    />
                                                </td>
                                                <td>
                                                    <ModernSelect 
                                                        value={p.delivery_status || 'Product Sent'} 
                                                        options={['Product Sent', 'Product Received', 'Returned']}
                                                        onChange={(val: string) => handleInlineUpdate(p.id, 'delivery_status', val)}
                                                        colorStyle={{ 
                                                            bg: p.delivery_status === 'Product Received' ? 'rgba(16,185,129,0.1)' : 'rgba(118,118,128,0.06)',
                                                            text: p.delivery_status === 'Product Received' ? '#059669' : 'inherit'
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <ModernSelect 
                                                        value={p.video_status || 'Pending'} 
                                                        options={['Pending', 'Video Received', 'Video Uploaded']}
                                                        onChange={(val: string) => handleInlineUpdate(p.id, 'video_status', val)}
                                                        colorStyle={{ 
                                                            bg: p.video_status === 'Video Uploaded' ? 'rgba(59,130,246,0.1)' : p.video_status === 'Pending' && p.delivery_status === 'Product Received' ? 'rgba(220,38,38,0.1)' : 'rgba(118,118,128,0.06)',
                                                            text: p.video_status === 'Video Uploaded' ? '#2563EB' : p.video_status === 'Pending' && p.delivery_status === 'Product Received' ? '#DC2626' : 'inherit'
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <ModernSelect 
                                                        value={p.payment_status || 'Unpaid'} 
                                                        options={['Paid', 'Unpaid', 'Free']}
                                                        onChange={(val: string) => handleInlineUpdate(p.id, 'payment_status', val)}
                                                        colorStyle={{ 
                                                            bg: p.payment_status === 'Paid' ? 'rgba(16,185,129,0.1)' : 'rgba(118,118,128,0.06)',
                                                            text: p.payment_status === 'Paid' ? '#059669' : 'inherit'
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <EditableCell value={p.view_note} placeholder="Add note..." onSave={(val: string) => handleInlineUpdate(p.id, 'view_note', val)} />
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        {p.video_link ? (
                                                            <a href={p.video_link.startsWith('http') ? p.video_link : `https://${p.video_link}`} target="_blank" rel="noreferrer" title="Watch Video" style={{ color: '#3B82F6' }}>
                                                                <IconPlay size={16} />
                                                            </a>
                                                        ) : (
                                                            <span style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={() => {
                                                                setVideoPromptId(p.id)
                                                                setTempVideoLink(p.video_link || '')
                                                            }} title="Add Video Link">
                                                                <IconCamera size={16} />
                                                            </span>
                                                        )}
                                                        {isAdmin && (
                                                            <button onClick={() => handleDelete(p.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }} title="Delete">
                                                                <IconTrash size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto', paddingBottom: '150px' }}>
                            {filtered.map(p => {
                                const isActionNeeded = p.delivery_status === 'Product Received' && p.video_status === 'Pending'
                                const overdue = p.video_status === 'Pending' && p.send_date && ((Date.now() - new Date(p.send_date).getTime()) / (1000 * 60 * 60 * 24)) > 7
                                return (
                                    <div key={p.id} className="card"
                                        style={{ 
                                            position: 'relative', overflow: 'visible', padding: '16px 20px', 
                                            border: overdue ? '1px solid rgba(220,38,38,0.4)' : isActionNeeded ? '1px solid rgba(220,38,38,0.2)' : '1px solid var(--color-border-light)',
                                            background: overdue ? 'rgba(220,38,38,0.06)' : isActionNeeded ? 'rgba(220,38,38,0.02)' : 'var(--color-surface)'
                                        }}>
                                        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                                            <input type="checkbox" 
                                                checked={selectedIds.includes(p.id)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedIds([...selectedIds, p.id])
                                                    else setSelectedIds(selectedIds.filter(id => id !== p.id))
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                                            <div style={{ flex: '1 1 250px', minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    {overdue && <span title="Overdue (7+ days pending video)">⚠️</span>}
                                                    {p.influencer_id ? (
                                                        <button 
                                                            onClick={() => setSelectedInfluencerId(p.influencer_id || '')}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600, padding: 0, textDecoration: 'underline', fontSize: '1.0625rem' }}
                                                        >
                                                            {p.customer_name}
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '1.0625rem', fontWeight: 600, color: overdue ? '#DC2626' : 'inherit' }}>{p.customer_name}</span>
                                                    )}
                                                    {p.customer_phone && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{p.customer_phone}</span>}
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                                                    <strong>{p.parcel_details}</strong> &bull; {p.send_date ? new Date(p.send_date).toLocaleDateString() : 'N/A'}
                                                </div>
                                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
                                                    {p.address}
                                                </div>
                                            </div>

                                            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ width: '80px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Delivery:</span>
                                                    <ModernSelect 
                                                        value={p.delivery_status || 'Product Sent'} 
                                                        options={['Product Sent', 'Product Received', 'Returned']}
                                                        onChange={(val: string) => handleInlineUpdate(p.id, 'delivery_status', val)}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ width: '80px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Video:</span>
                                                    <ModernSelect 
                                                        value={p.video_status || 'Pending'} 
                                                        options={['Pending', 'Video Received', 'Video Uploaded']}
                                                        onChange={(val: string) => handleInlineUpdate(p.id, 'video_status', val)}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ width: '80px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Payment:</span>
                                                    <ModernSelect 
                                                        value={p.payment_status || 'Unpaid'} 
                                                        options={['Paid', 'Unpaid', 'Free']}
                                                        onChange={(val: string) => handleInlineUpdate(p.id, 'payment_status', val)}
                                                    />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {p.video_link ? (
                                                    <a href={p.video_link.startsWith('http') ? p.video_link : `https://${p.video_link}`} target="_blank" rel="noreferrer" title="Watch Video"
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                                                        <IconPlay size={18} />
                                                    </a>
                                                ) : (
                                                    <button onClick={() => {
                                                        setVideoPromptId(p.id)
                                                        setTempVideoLink(p.video_link || '')
                                                    }} title="Add Video Link"
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(118,118,128,0.1)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}>
                                                        <IconCamera size={18} />
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button onClick={() => handleDelete(p.id)} style={{ padding: '8px', color: '#DC2626', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                                        <IconTrash size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {p.view_note && (
                                            <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(118,118,128,0.05)', borderRadius: '8px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                                <strong>Note:</strong> {p.view_note}
                                            </div>
                                        )}
                                        {p.ai_comments && (
                                            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                                <span style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}><IconCheckCircle size={12} /></span>
                                                {p.ai_comments}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* Bulk Action Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        style={{
                            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--color-surface)', border: '1px solid var(--color-border-primary)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', borderRadius: '12px', padding: '12px 24px',
                            display: 'flex', alignItems: 'center', gap: '20px', zIndex: 100
                        }}
                    >
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {selectedIds.length} selected
                        </div>
                        <div style={{ width: '1px', height: '24px', background: 'var(--color-border-light)' }} />
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Update to:</span>
                            <ModernSelect direction="up" value="Delivery Status" options={['Product Sent', 'Product Received', 'Returned']} onChange={(val: string) => handleBulkUpdate('delivery_status', val)} />
                            <ModernSelect direction="up" value="Video Status" options={['Pending', 'Video Received', 'Video Uploaded']} onChange={(val: string) => handleBulkUpdate('video_status', val)} />
                            <ModernSelect direction="up" value="Payment Status" options={['Paid', 'Unpaid', 'Free']} onChange={(val: string) => handleBulkUpdate('payment_status', val)} />
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}><IconX size={16} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Influencer Drawer */}
            <AnimatePresence>
                {selectedInfluencerId && (
                    <InfluencerDrawer 
                        influencerId={selectedInfluencerId} 
                        onClose={() => setSelectedInfluencerId(null)} 
                    />
                )}
            </AnimatePresence>

            {/* Add Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <>
                        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{t('pr.addBtn')}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}><IconX size={20} /></button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group"><label className="form-label">{t('pr.customer')} *</label><input className="form-input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} placeholder="Name..." required /></div>
                                    <div className="form-group"><label className="form-label">Phone/Link *</label><input className="form-input" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="01XXXXXXXXX" required /></div>
                                </div>
                                <div className="form-group"><label className="form-label">{t('pr.parcelDetails')} *</label><input className="form-input" value={form.parcel_details} onChange={e => setForm({ ...form, parcel_details: e.target.value })} placeholder="e.g. 1450/- or শুটকি ভর্তা প্লেটার" required /></div>
                                <div className="form-group"><label className="form-label">{t('pr.address')}</label><textarea className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} /></div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group"><label className="form-label">{t('pr.date')}</label><input type="date" className="form-input" value={form.send_date} onChange={e => setForm({ ...form, send_date: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">{t('pr.source')}</label>
                                        <select className="form-input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                                            <option value="FB">FB</option>
                                            <option value="WhatsApp">WhatsApp</option>
                                            <option value="Instagram">Instagram</option>
                                            <option value="YouTube">YouTube</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    <div className="form-group"><label className="form-label">{t('pr.deliveryStatus')}</label>
                                        <select className="form-input" value={form.delivery_status} onChange={e => setForm({ ...form, delivery_status: e.target.value })}>
                                            <option value="Product Sent">Product Sent</option>
                                            <option value="Product Received">Product Received</option>
                                            <option value="Returned">Returned</option>
                                        </select>
                                    </div>
                                    <div className="form-group"><label className="form-label">{t('pr.videoStatus')}</label>
                                        <select className="form-input" value={form.video_status} onChange={e => setForm({ ...form, video_status: e.target.value })}>
                                            <option value="Pending">Pending</option>
                                            <option value="Video Received">Video Received</option>
                                            <option value="Video Uploaded">Video Uploaded</option>
                                        </select>
                                    </div>
                                    <div className="form-group"><label className="form-label">{t('pr.paymentStatus')}</label>
                                        <select className="form-input" value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })}>
                                            <option value="Paid">Paid</option>
                                            <option value="Unpaid">Unpaid</option>
                                            <option value="Free">Free</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group"><label className="form-label">{t('pr.videoLink')}</label><input className="form-input" value={form.video_link} onChange={e => setForm({ ...form, video_link: e.target.value })} placeholder="https://..." /></div>
                                <div className="form-group"><label className="form-label">{t('pr.note')}</label><textarea className="form-input" value={form.view_note} onChange={e => setForm({ ...form, view_note: e.target.value })} rows={2} /></div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !isFormValid}>{saving ? t('common.loading') : t('common.save')}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Video Link Modal */}
            <AnimatePresence>
                {videoPromptId && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVideoPromptId(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%', padding: '24px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3B82F6', marginBottom: '16px' }}>
                                <IconCamera size={24} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-primary)' }}>Add Video Link</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>Enter the URL of the uploaded review video</p>
                            
                            <input 
                                autoFocus
                                className="form-input" 
                                value={tempVideoLink} 
                                onChange={e => setTempVideoLink(e.target.value)} 
                                placeholder="https://youtube.com/..." 
                                style={{ marginBottom: '20px', textAlign: 'left', width: '100%' }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && tempVideoLink) {
                                        handleInlineUpdate(videoPromptId, 'video_link', tempVideoLink)
                                        setVideoPromptId(null)
                                    }
                                }}
                            />
                            
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setVideoPromptId(null)} style={{ flex: 1 }}>Cancel</button>
                                <button className="btn btn-primary btn-sm" disabled={!tempVideoLink.trim()} style={{ flex: 1 }}
                                    onClick={() => {
                                        if (tempVideoLink) {
                                            handleInlineUpdate(videoPromptId, 'video_link', tempVideoLink)
                                            setVideoPromptId(null)
                                        }
                                    }}>
                                    Save Link
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </RequireFeature>
    )
}
