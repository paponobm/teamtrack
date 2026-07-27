'use client'

import RequireFeature from '@/components/common/RequireFeature'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { IconCheckCircle, IconPlay, IconFileText, IconPlus, IconTrash, IconX, IconCamera, IconEdit, IconArrowUpCircle, IconClipboard } from '@/components/icons/Icons'
import React from 'react'
import { usePermissions } from '@/lib/PermissionsContext'
import { formatLongDate } from '@/lib/format'

interface ContentBatch {
    id: string
    category: string | null
    titles: string[]
    shoot_done: boolean
    edit_done: boolean
    upload_done: boolean
    uploaded_to?: string[]
    shoot_date?: string | null
    edit_date?: string | null
    upload_date?: string | null
    metrics_likes?: number
    metrics_comments?: number
    metrics_reach?: number
    rating?: string | null
    type?: string
    short_id?: string
    creator: { id: string; name: string } | null
    created_at: string
}

const CATEGORIES = ['Educational', 'Promotional', 'Entertainment', 'Tutorial', 'Behind the Scenes']

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const itemAnim = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

const UploadModal = ({ batch, onClose, onConfirm }: { batch: ContentBatch, onClose: () => void, onConfirm: (platforms: string[]) => void }) => {
    const PLATFORMS = ['Facebook', 'YouTube', 'Instagram', 'TikTok', 'LinkedIn', 'Twitter']
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(batch.uploaded_to || [])

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', width: '100%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">Select Platforms</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={20} /></button>
                </div>
                <div className="modal-body">
                    <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Where was this {batch.type === 'video' ? 'video' : 'post'} published?</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {PLATFORMS.map(platform => (
                            <label key={platform} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedPlatforms.includes(platform)}
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedPlatforms(prev => [...prev, platform])
                                        else setSelectedPlatforms(prev => prev.filter(p => p !== platform))
                                    }}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{platform}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={() => onConfirm(selectedPlatforms)} disabled={selectedPlatforms.length === 0}>Confirm Upload</button>
                </div>
            </motion.div>
        </motion.div>
    )
}

const MetricsModal = ({ batch, onClose, onSave }: { batch: ContentBatch, onClose: () => void, onSave: (metrics: any) => void }) => {
    const [likes, setLikes] = useState(batch.metrics_likes?.toString() || '0')
    const [comments, setComments] = useState(batch.metrics_comments?.toString() || '0')
    const [reach, setReach] = useState(batch.metrics_reach?.toString() || '0')
    const [rating, setRating] = useState(batch.rating || 'Good')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        await onSave({
            metrics_likes: parseInt(likes) || 0,
            metrics_comments: parseInt(comments) || 0,
            metrics_reach: parseInt(reach) || 0,
            rating
        })
        setSaving(false)
    }

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">Performance Metrics</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><IconX size={20} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Total Reach / Views</label>
                            <input type="number" className="input" value={reach} onChange={e => setReach(e.target.value)} style={{ width: '100%' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Likes</label>
                                <input type="number" className="input" value={likes} onChange={e => setLikes(e.target.value)} style={{ width: '100%' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Comments</label>
                                <input type="number" className="input" value={comments} onChange={e => setComments(e.target.value)} style={{ width: '100%' }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Internal Rating</label>
                            <select className="input" value={rating} onChange={e => setRating(e.target.value)} style={{ width: '100%' }}>
                                <option value="Good">Good</option>
                                <option value="Edit">Edit</option>
                                <option value="Best">Best</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Metrics'}</button>
                </div>
            </motion.div>
        </motion.div>
    )
}

export default function ContentPage() {
    const { data: perms } = usePermissions()
    const [batches, setBatches] = useState<ContentBatch[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [viewMode, setViewMode] = useState<'create' | 'active' | 'shooting' | 'editing' | 'uploading' | 'completed'>('create')
    const [filterType, setFilterType] = useState<'all' | 'video' | 'post'>('all')
    const [newBatchType, setNewBatchType] = useState<'video' | 'post'>('video')
    
    // Batch Creation State
    const [newTitles, setNewTitles] = useState<{id: string, val: string}[]>([{ id: 'init', val: '' }])
    const [saving, setSaving] = useState(false)
    const [completingId, setCompletingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [uploadModalBatch, setUploadModalBatch] = useState<ContentBatch | null>(null)
    const [metricsModalBatch, setMetricsModalBatch] = useState<ContentBatch | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string>('')
    const [filterCategory, setFilterCategory] = useState('all')
    const [filterDate, setFilterDate] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const toast = useToast()

    const lastInputRef = useRef<HTMLInputElement>(null)
    const titlesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (newTitles.length > 1) {
            setTimeout(() => {
                if (lastInputRef.current) {
                    lastInputRef.current.focus()
                    // Use block: end to ensure it pushes the scroll container down
                    lastInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
                }
            }, 300) // 300ms ensures the Framer Motion slide-down animation has completely finished expanding the height
        }
    }, [newTitles.length])

    const fetchData = useCallback(async () => {
        try {
            let url = `/api/content?category=${filterCategory}`
            
            if (filterDate !== 'all') {
                const now = new Date()
                let start = new Date()
                if (filterDate === 'today') {
                    start.setHours(0,0,0,0)
                } else if (filterDate === 'week') {
                    start.setDate(now.getDate() - now.getDay())
                    start.setHours(0,0,0,0)
                } else if (filterDate === 'month') {
                    start.setDate(1)
                    start.setHours(0,0,0,0)
                }
                const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                url += `&start_date=${fmtLocal(start)}&end_date=${fmtLocal(now)}`
            }

            const res = await fetch(url)
            if (res.ok) { const d = await res.json(); setBatches(d.items || []) }
        } catch { console.error('Failed to fetch content') }
        finally { setLoading(false) }
    }, [filterCategory, filterDate])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (perms.is_super || perms.role === 'Admin' || perms.role === 'Owner' || perms.role === 'Super Admin') setIsAdmin(true)
    }, [perms])

    const handleTitleChange = (id: string, val: string) => {
        setNewTitles(prev => prev.map(t => t.id === id ? { ...t, val } : t))
    }

    const handleAddTitleRow = () => {
        setNewTitles(prev => [...prev, { id: Math.random().toString(), val: '' }])
    }

    const handleRemoveTitleRow = (id: string) => {
        setNewTitles(prev => {
            const next = prev.filter(t => t.id !== id)
            return next.length === 0 ? [{ id: Math.random().toString(), val: '' }] : next
        })
    }

    const handleStartBatch = async () => {
        const validTitles = newTitles.map(t => t.val.trim()).filter(t => t.length > 0)
        if (validTitles.length === 0) return
        
        setSaving(true)
        try {
            const res = await fetch('/api/content', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    titles: validTitles, 
                    type: newBatchType,
                    category: selectedCategory || null
                }),
            })
            if (res.ok) { 
                await fetchData()
                setNewTitles([{ id: Math.random().toString(), val: '' }])
                setSelectedCategory('')
            } else {
                let errMsg = 'Unknown Error'
                try {
                    const err = await res.json()
                    errMsg = err.error || errMsg
                } catch {
                    errMsg = `HTTP Error ${res.status}`
                }
                alert('Error creating batch: ' + errMsg)
            }
        } catch (err) { 
            console.error('API Error:', err)
            alert('Network error connecting to API.')
        }
        finally { setSaving(false) }
    }

    const handleProgress = async (batch: ContentBatch, field: 'shoot_done' | 'edit_done' | 'upload_done', value: boolean) => {
        // If they are checking the final upload button
        const isFinalStep = field === 'upload_done' && value === true && batch.shoot_done && batch.edit_done
        
        if (isFinalStep) {
            setUploadModalBatch(batch)
            return
        }

        // Optimistic update for other steps, with rollback on failure
        const timestampField = field === 'shoot_done' ? 'shoot_date' : 'edit_date'
        const timestampValue = value ? new Date().toISOString() : null
        const prevBatches = batches

        setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, [field]: value, [timestampField]: timestampValue } : b))
        try {
            const res = await fetch('/api/content', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: batch.id, [field]: value, [timestampField]: timestampValue }),
            })
            if (!res.ok) { setBatches(prevBatches); toast.error('Failed to update progress') }
        } catch { setBatches(prevBatches); toast.error('Failed to update progress') }
    }

    const handleConfirmUpload = async (platforms: string[]) => {
        if (!uploadModalBatch) return

        const batch = uploadModalBatch
        setUploadModalBatch(null)
        setCompletingId(batch.id)
        const uploadDate = new Date().toISOString()

        // Persist IMMEDIATELY (the old code deferred the write 2s and lost it on navigation).
        try {
            const res = await fetch('/api/content', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: batch.id, upload_done: true, uploaded_to: platforms, upload_date: uploadDate }),
            })
            if (!res.ok) {
                setCompletingId(null)
                toast.error('Failed to mark as uploaded. Please try again.')
                return
            }
            const data = await res.json()
            setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, upload_done: true, uploaded_to: platforms, upload_date: uploadDate } : b))
            if (data.awardedPoints && data.awardedPoints > 0) {
                toast.success(`Awesome! You earned ${data.awardedPoints} points! 🌟`)
            }
        } catch {
            setCompletingId(null)
            toast.error('Failed to mark as uploaded. Please try again.')
            return
        }
        // Brief celebration effect, then clear.
        setTimeout(() => setCompletingId(null), 1200)
    }

    const handleSaveMetrics = async (metrics: any) => {
        if (!metricsModalBatch) return
        const batchId = metricsModalBatch.id
        setMetricsModalBatch(null)
        
        setBatches(prev => prev.map(b => b.id === batchId ? { ...b, ...metrics } : b))
        
        await fetch('/api/content', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: batchId, ...metrics }),
        })
    }

    const handleDelete = async (id: string) => {
        const backup = [...batches]
        setBatches(prev => prev.filter(b => b.id !== id))
        
        try {
            const res = await fetch(`/api/content?id=${id}`, { method: 'DELETE' })
            if (!res.ok) {
                setBatches(backup)
                alert("Failed to delete. Server returned an error.")
            }
        } catch {
            setBatches(backup)
            alert("Network error while deleting.")
        }
    }

    // Filter batches
    const filteredBatches = batches.filter(b => {
        const isCompleted = b.shoot_done && b.edit_done && b.upload_done
        const type = b.type || (b.category?.toLowerCase().includes('video') ? 'video' : 'post')
        
        if (filterType !== 'all' && type !== filterType) return false
        
        if (viewMode === 'completed') return isCompleted
        
        if (isCompleted) return false
        
        if (viewMode === 'shooting' && b.shoot_done) return false
        if (viewMode === 'editing' && (!b.shoot_done || b.edit_done)) return false
        if (viewMode === 'uploading' && (!b.shoot_done || !b.edit_done || b.upload_done)) return false
        
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim()
            const matchId = b.short_id?.toLowerCase().includes(q)
            const matchTitle = b.titles.some(t => t.toLowerCase().includes(q))
            if (!matchId && !matchTitle) return false
        }
        
        return true
    })

    const StepButton = ({ label, done, available, onClick, icon: IconComponent, date }: { label: string, done: boolean, available: boolean, onClick: () => void, icon?: any, date?: string | null }) => {
        if (!available) return null;

        if (done) {
            return (
                <motion.div layout initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} style={{ display: 'flex', flexDirection: 'column', padding: '10px 20px', borderRadius: '12px', background: 'var(--color-success-light)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontSize: '1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <motion.div animate={{ scale: [0.5, 1.2, 1], rotate: [0, -15, 15, 0] }} transition={{ duration: 0.4 }}>
                            <IconCheckCircle size={20} />
                        </motion.div>
                        {label} Done
                    </div>
                    {date && <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', opacity: 0.8, marginTop: '2px', fontWeight: 600 }}>{new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>}
                </motion.div>
            )
        }

        return (
            <motion.button 
                layout
                initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                onClick={onClick}
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 32px', 
                    borderRadius: '12px', background: 'var(--color-primary)', color: '#fff', 
                    fontSize: '1.0625rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                    boxShadow: `0 6px 16px rgba(37,99,235, 0.25)`, overflow: 'hidden', whiteSpace: 'nowrap'
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                whileHover={{ scale: 1.02, boxShadow: `0 8px 24px rgba(37,99,235, 0.35)` }}
                whileTap={{ scale: 0.95 }}
            >
                {IconComponent && (
                    <motion.div animate={{ scale: [0.8, 1], opacity: [0, 1] }} transition={{ duration: 0.3 }} style={{ display: 'flex' }}>
                        <IconComponent size={20} />
                    </motion.div>
                )}
                {label}
            </motion.button>
        )
    }

    const stats = {
        active: batches.filter(b => !(b.shoot_done && b.edit_done && b.upload_done)).length,
        completed: batches.filter(b => b.shoot_done && b.edit_done && b.upload_done).length,
        needsShooting: batches.filter(b => !b.shoot_done).length,
        needsEditing: batches.filter(b => b.shoot_done && !b.edit_done).length,
        needsUploading: batches.filter(b => b.shoot_done && b.edit_done && !b.upload_done).length
    }

    const statCards = [
        { label: 'Create Batch', value: '+', color: '#8B5CF6', icon: <IconPlus size={18} color="#8B5CF6" />, filter: 'create' },
        { label: 'Total Active', value: stats.active, color: '#1E3A5F', icon: <IconClipboard size={18} color="#1E3A5F" />, filter: 'active' },
        { label: 'Needs Shooting', value: stats.needsShooting, color: '#DC2626', icon: <IconCamera size={18} color="#DC2626" />, filter: 'shooting' },
        { label: 'Needs Editing', value: stats.needsEditing, color: '#F59E0B', icon: <IconEdit size={18} color="#F59E0B" />, filter: 'editing' },
        { label: 'Needs Uploading', value: stats.needsUploading, color: '#3B82F6', icon: <IconArrowUpCircle size={18} color="#3B82F6" />, filter: 'uploading' },
        { label: 'Completed', value: stats.completed, color: '#10B981', icon: <IconCheckCircle size={18} color="#10B981" />, filter: 'completed' },
    ] as const

    const handleStatCardClick = (filter: string) => {
        if (filter === 'create' && viewMode === 'create') {
            handleAddTitleRow()
        }
        setViewMode(filter as any)
    }

    return (
        <RequireFeature slugs={['content']}>
        <motion.div variants={container} animate="show" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
            <motion.div className="page-header" variants={itemAnim} style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">Content Pipeline</h1>
                    <p className="page-subtitle">Batch production workflow.</p>
                </div>
            </motion.div>

            {/* Unified Stats Bar */}
            <motion.div variants={itemAnim} className="card" style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 20px', gap: '16px', marginBottom: '24px', background: 'var(--color-surface)', scrollbarWidth: 'none' }}>
                {statCards.map((s, idx) => {
                    const isActive = viewMode === s.filter
                    return (
                        <React.Fragment key={s.label}>
                            <motion.button 
                                onClick={() => handleStatCardClick(s.filter)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, 
                                    background: isActive ? `${s.color}15` : 'transparent', 
                                    padding: '8px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                                    outline: isActive ? `1px solid ${s.color}50` : 'none',
                                    transition: 'background 0.2s, outline 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '12px', background: isActive ? '#fff' : `${s.color}15`, boxShadow: isActive ? `0 2px 8px ${s.color}20` : 'none' }}>
                                    {s.icon}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color, lineHeight: 1.1 }}>{s.value}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</span>
                                </div>
                            </motion.button>
                            {idx < statCards.length - 1 && (
                                <div style={{ width: '1px', height: '40px', background: 'var(--color-border-light)', flexShrink: 0 }} />
                            )}
                        </React.Fragment>
                    )
                })}
            </motion.div>

            {/* Filter Bar */}
            <motion.div variants={itemAnim} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <input 
                    type="text" 
                    className="input" 
                    placeholder="Search by ID (e.g. V1) or title..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border-light)', fontSize: '0.9375rem', fontWeight: 500, background: 'var(--color-surface)', width: '100%', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                />
                <select 
                    className="input" 
                    value={filterType}
                    onChange={e => setFilterType(e.target.value as any)}
                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border-light)', fontSize: '0.9375rem', fontWeight: 600, background: 'var(--color-surface)', cursor: 'pointer', width: '100%', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                >
                    <option value="all">All Content</option>
                    <option value="video">Videos Only</option>
                    <option value="post">Posts Only</option>
                </select>
                <select 
                    className="input" 
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border-light)', fontSize: '0.9375rem', fontWeight: 600, background: 'var(--color-surface)', cursor: 'pointer', width: '100%', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                </select>
                <select 
                    className="input" 
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border-light)', fontSize: '0.9375rem', fontWeight: 600, background: 'var(--color-surface)', cursor: 'pointer', width: '100%', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                >
                    <option value="all">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </motion.div>

            {/* Batch Creation Form */}
            <AnimatePresence>
            {viewMode === 'create' && (
                <motion.div 
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="card" style={{ marginBottom: '32px', padding: '24px', background: 'var(--color-surface)', border: '2px solid var(--color-border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ fontSize: '1.0625rem', fontWeight: 600 }}>Start New Batch</div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <select 
                                    className="input" 
                                    value={newBatchType}
                                    onChange={e => setNewBatchType(e.target.value as 'video' | 'post')}
                                    style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--color-border-light)', fontSize: '0.9375rem', fontWeight: 600, minWidth: '140px', background: 'var(--color-bg-primary)', cursor: 'pointer' }}
                                >
                                    <option value="video">Video</option>
                                    <option value="post">Post</option>
                                </select>
                                <select 
                                    className="input" 
                                    value={selectedCategory}
                                    onChange={e => setSelectedCategory(e.target.value)}
                                    style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--color-border-light)', fontSize: '0.9375rem', fontWeight: 600, minWidth: '180px', background: 'var(--color-bg-primary)', cursor: 'pointer' }}
                                >
                                    <option value="" disabled>Select Category...</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', marginBottom: '20px' }}>
                        <AnimatePresence initial={false}>
                            {newTitles.map((item, i) => (
                                <motion.div 
                                    key={item.id} 
                                    initial={{ opacity: 0, height: 0, y: -10 }}
                                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                    transition={{ duration: 0.2 }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px' }}
                                >
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
                                        {i + 1}
                                    </div>
                                    <input 
                                        ref={i === newTitles.length - 1 ? lastInputRef : null}
                                        type="text" 
                                        className="input" 
                                        placeholder={`Enter Title...`}
                                        value={item.val}
                                        onChange={e => handleTitleChange(item.id, e.target.value)}
                                        style={{ flex: 1, padding: '12px 16px', fontSize: '0.9375rem', borderRadius: '10px', border: '1px solid var(--color-border-light)', background: 'var(--color-bg-elevated)' }}
                                        disabled={saving}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && item.val.trim()) {
                                                e.preventDefault()
                                                if (i === newTitles.length - 1) handleAddTitleRow()
                                            }
                                        }}
                                    />
                                    {newTitles.length > 1 && (
                                        <button onClick={() => handleRemoveTitleRow(item.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                                            <IconX size={18} />
                                        </button>
                                    )}
                                    {i === newTitles.length - 1 && (
                                        <button onClick={handleAddTitleRow} className="btn btn-ghost btn-icon" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)', flexShrink: 0 }}>
                                            <IconPlus size={18} />
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        <div ref={titlesEndRef} style={{ height: '10px' }} />
                    </div>

                    <motion.button 
                        onClick={handleStartBatch} 
                        disabled={saving || !newTitles.some(t => t.val.trim())} 
                        className="btn btn-primary" 
                        style={{ width: '100%', padding: '16px', fontSize: '1.0625rem', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {saving ? (
                            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.6 }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 0.6 }}>
                                    <IconCamera size={22} />
                                </motion.div>
                                Shooting Batch...
                            </motion.div>
                        ) : (
                            <>
                                <IconPlay size={20} /> Start Production
                            </>
                        )}
                    </motion.button>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>

            {/* Active Batches List */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[1,2].map(i => <div key={i} className="skeleton" style={{ height: '140px', borderRadius: '16px' }} />)}
                </div>
            ) : filteredBatches.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-tertiary)' }}>
                    {viewMode === 'completed' ? 'No completed batches yet.' : 'No active batches in production.'}
                </motion.div>
            ) : (
                <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <AnimatePresence mode="popLayout">
                        {filteredBatches.map(batch => (
                            <motion.div 
                                key={batch.id} 
                                layout
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.4, y: -200, x: '30%', filter: 'blur(8px)', transition: { duration: 0.6, ease: 'backIn' } }}
                                transition={{ duration: 0.3 }}
                                className="card" 
                                style={{ padding: '20px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}
                            >
                                {completingId === batch.id && (
                                    <motion.div 
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                                        style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <motion.div animate={{ scale: [0, 1.2, 1], rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, ease: 'easeOut' }}>
                                            <IconCheckCircle size={56} color="var(--color-success)" />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '16px' }}>
                                            Batch Completed!
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ fontSize: '0.9375rem', color: 'var(--color-text-tertiary)', marginTop: '8px', fontWeight: 500 }}>
                                            Moving to Completed tab...
                                        </motion.div>
                                    </motion.div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {batch.short_id && <span style={{ padding: '2px 6px', background: 'var(--color-primary)', color: '#fff', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>{batch.short_id}</span>}
                                            {batch.category || 'Content'} Batch
                                            {batch.category && <span style={{ padding: '2px 6px', background: 'var(--color-bg-tertiary)', borderRadius: '4px', fontSize: '0.6875rem' }}>{batch.category}</span>}
                                            <span style={{ opacity: 0.5 }}>•</span>
                                            {formatLongDate(batch.created_at)}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {batch.titles.map((t, i) => (
                                                <div key={i} style={{ fontSize: '1rem', fontWeight: 500, display: 'flex', gap: '8px' }}>
                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>{i+1}.</span> {t}
                                                </div>
                                            ))}
                                        </div>
                                        {batch.upload_done && batch.uploaded_to && batch.uploaded_to.length > 0 && (
                                            <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', alignSelf: 'center', marginRight: '4px' }}>Published to:</span>
                                                {batch.uploaded_to.map(platform => (
                                                    <span key={platform} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(37,99,235,0.1)', color: 'var(--color-primary)' }}>
                                                        {platform}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {viewMode === 'completed' && (
                                            <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                                <div style={{ background: 'var(--color-bg-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                                    Reach: <span style={{ color: 'var(--color-text-primary)' }}>{batch.metrics_reach || 0}</span>
                                                </div>
                                                <div style={{ background: 'var(--color-bg-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                                    Likes: <span style={{ color: 'var(--color-text-primary)' }}>{batch.metrics_likes || 0}</span>
                                                </div>
                                                <div style={{ background: 'var(--color-bg-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                                    Comments: <span style={{ color: 'var(--color-text-primary)' }}>{batch.metrics_comments || 0}</span>
                                                </div>
                                                <div style={{ background: 'var(--color-bg-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                                    Rating: <span style={{ color: batch.rating === 'Best' ? 'var(--color-success)' : batch.rating === 'Edit' ? 'var(--color-warning)' : 'var(--color-primary)' }}>{batch.rating || 'N/A'}</span>
                                                </div>
                                                <button className="btn btn-sm" onClick={() => setMetricsModalBatch(batch)} style={{ background: 'var(--color-bg-tertiary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}>
                                                    Edit Metrics
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {isAdmin && (
                                        deletingId === batch.id ? (
                                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <button onClick={() => handleDelete(batch.id)} className="btn btn-sm" style={{ background: 'var(--color-danger)', color: '#fff', fontSize: '0.8125rem', padding: '6px 12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                                                <button onClick={() => setDeletingId(null)} className="btn btn-sm" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', padding: '6px 12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                            </motion.div>
                                        ) : (
                                            <button onClick={() => setDeletingId(batch.id)} className="btn btn-ghost btn-icon" style={{ padding: '6px', color: 'var(--color-text-tertiary)' }}>
                                                <IconTrash size={18} />
                                            </button>
                                        )
                                    )}
                                </div>
                                
                                {/* Production Pipeline */}
                                {viewMode !== 'completed' && (
                                    <motion.div 
                                        layout
                                        style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingTop: '20px', borderTop: '1px solid var(--color-border-light)' }}
                                    >
                                        <StepButton 
                                            label={batch.type === 'video' ? 'Shoot' : 'Draft'} 
                                            icon={batch.type === 'video' ? IconCamera : IconFileText}
                                            done={batch.shoot_done} 
                                            available={true}
                                            date={batch.shoot_date}
                                            onClick={() => handleProgress(batch, 'shoot_done', true)} 
                                        />
                                        <StepButton 
                                            label="Edit" 
                                            icon={IconEdit}
                                            done={batch.edit_done} 
                                            available={batch.shoot_done}
                                            date={batch.edit_date}
                                            onClick={() => handleProgress(batch, 'edit_done', true)} 
                                        />
                                        <StepButton 
                                            label={batch.type === 'video' ? 'Upload' : 'Publish'} 
                                            icon={IconArrowUpCircle}
                                            done={batch.upload_done} 
                                            available={batch.edit_done}
                                            date={batch.upload_date}
                                            onClick={() => handleProgress(batch, 'upload_done', true)} 
                                        />
                                    </motion.div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Upload Modal */}
            <AnimatePresence>
                {uploadModalBatch && (
                    <UploadModal 
                        batch={uploadModalBatch} 
                        onClose={() => setUploadModalBatch(null)} 
                        onConfirm={handleConfirmUpload} 
                    />
                )}
            </AnimatePresence>

            {/* Metrics Modal */}
            <AnimatePresence>
                {metricsModalBatch && (
                    <MetricsModal 
                        batch={metricsModalBatch} 
                        onClose={() => setMetricsModalBatch(null)} 
                        onSave={handleSaveMetrics} 
                    />
                )}
            </AnimatePresence>

        </motion.div>
        </RequireFeature>
    )
}
