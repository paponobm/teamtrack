'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/ToastContext'
import { motion, AnimatePresence } from 'framer-motion'
import RequireFeature from '@/components/common/RequireFeature'
import { usePermissions } from '@/lib/PermissionsContext'

interface Memory {
    id: string
    title: string
    description: string | null
    memory_date: string | null
    images: string[] | null
    author: { id: string; name: string } | null
    created_at: string
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#7C3AED', '#DC2626', '#10B981', '#F59E0B', '#EC4899', '#1E3A5F', '#6366F1']
    return colors[name.charCodeAt(0) % colors.length]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getName = (obj: any) => { if (!obj) return null; return Array.isArray(obj) ? obj[0]?.name : obj.name }

const emptyForm = { title: '', description: '', memory_date: new Date().toISOString().split('T')[0], images: [] as string[] }

export default function MemoriesPage() {
    const [memories, setMemories] = useState<Memory[]>([])
    const [loading, setLoading] = useState(true)
    const { data: perms } = usePermissions()
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
    const toast = useToast()
    const [imageUploading, setImageUploading] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/memories')
            if (res.ok) {
                const data = await res.json()
                setMemories(Array.isArray(data) ? data : data.memories || [])
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (perms.is_super || perms.role === 'Owner' || perms.role === 'Super Admin') setIsSuperAdmin(true)
    }, [perms])

    const handleSave = async () => {
        if (!form.title.trim()) return
        setSaving(true)
        try {
            const res = await fetch('/api/memories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title,
                    description: form.description,
                    memory_date: form.memory_date,
                    images: form.images.length > 0 ? form.images : null,
                }),
            })
            if (res.ok) { 
                await fetchData()
                setShowModal(false)
                setForm(emptyForm)
                toast.success('Memory saved successfully')
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to preserve memory')
            }
        } catch (err) { 
            toast.error('A network error occurred. Please try again.')
        }
        finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this memory?')) return
        try {
            const res = await fetch(`/api/memories?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                setSelectedMemory(null)
                await fetchData()
                toast.success('Memory deleted')
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to delete memory')
            }
        } catch {
            toast.error('Network error while deleting')
        }
    }

    return (
        <RequireFeature slugs={['memories']}>
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                        Memories
                    </h1>
                    <p className="page-subtitle">Capture and share team moments.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyForm); setShowModal(true) }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Add Memory
                </button>
            </motion.div>

            {/* Memories Grid */}
            {loading ? (
                <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="card" style={{ padding: 0 }}>
                            <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: '12px 12px 0 0' }} />
                            <div style={{ padding: '16px' }}>
                                <div className="skeleton" style={{ width: '70%', height: 14, marginBottom: '8px' }} />
                                <div className="skeleton" style={{ width: '50%', height: 10 }} />
                            </div>
                        </div>
                    ))}
                </motion.div>
            ) : memories.length === 0 ? (
                <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '80px 24px' }}>
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.5 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>No memories yet</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Start capturing team moments by adding your first memory!</p>
                </motion.div>
            ) : (
                <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {memories.map(memory => {
                        const authorName = getName(memory.author)
                        const hasImages = memory.images && memory.images.length > 0
                        return (
                            <motion.div key={memory.id} className="card" style={{ padding: 0, cursor: 'pointer', overflow: 'hidden' }}
                                whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}
                                transition={{ duration: 0.25 }}
                                onClick={() => setSelectedMemory(memory)}>
                                {/* Image placeholder / gradient */}
                                <div style={{
                                    height: hasImages ? '200px' : '140px',
                                    background: hasImages ? `url(${memory.images![0]}) center/cover` : `linear-gradient(135deg, ${getAvatarColor(memory.title)}20 0%, ${getAvatarColor(memory.title)}40 100%)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    position: 'relative',
                                }}>
                                    {!hasImages && (
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={getAvatarColor(memory.title)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <polyline points="21 15 16 10 5 21" />
                                        </svg>
                                    )}
                                    {/* Date badge */}
                                    {memory.memory_date && (
                                        <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: '0.6875rem', fontWeight: 600 }}>
                                            {new Date(memory.memory_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    )}
                                </div>

                                <div style={{ padding: '16px 20px' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px', lineHeight: 1.4 }}>{memory.title}</h3>
                                    {memory.description && (
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '8px' }}>
                                            {memory.description}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                        {authorName && (
                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: getAvatarColor(authorName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.5rem', fontWeight: 600 }}>
                                                {authorName[0]}
                                            </div>
                                        )}
                                        <span>{authorName || 'Anonymous'}</span>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}

            {/* Memory Detail Modal */}
            <AnimatePresence>
                {selectedMemory && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedMemory(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{selectedMemory.title}</h2>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {isSuperAdmin && (
                                        <button className="btn btn-ghost btn-sm" style={{ color: '#DC2626' }} onClick={() => handleDelete(selectedMemory.id)}>
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    )}
                                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMemory(null)}>
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {selectedMemory.memory_date && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
                                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                                        {new Date(selectedMemory.memory_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                )}
                                {/* Media (Images/Videos) */}
                                {selectedMemory.images && selectedMemory.images.length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: selectedMemory.images.length === 1 ? '1fr' : '1fr 1fr', gap: '8px' }}>
                                        {selectedMemory.images.map((mediaUrl, i) => {
                                            const isVideo = mediaUrl.match(/\.(mp4|webm|mov|quicktime)(\?.*)?$/i)
                                            return isVideo ? (
                                                <video key={i} src={mediaUrl} controls style={{
                                                    width: '100%', borderRadius: '10px', objectFit: 'cover',
                                                    maxHeight: selectedMemory.images!.length === 1 ? '400px' : '200px',
                                                }} />
                                            ) : (
                                                <img key={i} src={mediaUrl} alt={`Memory ${i + 1}`} style={{
                                                    width: '100%', borderRadius: '10px', objectFit: 'cover',
                                                    maxHeight: selectedMemory.images!.length === 1 ? '400px' : '200px',
                                                }} />
                                            )
                                        })}
                                    </div>
                                )}
                                {/* Description */}
                                {selectedMemory.description && (
                                    <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>{selectedMemory.description}</p>
                                )}
                                {/* Author */}
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Shared by {getName(selectedMemory.author) || 'Anonymous'}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Memory Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Add Memory</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group">
                                    <label className="form-label">Title *</label>
                                    <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Team Lunch, Office Party..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What happened?" rows={4} style={{ resize: 'vertical' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date</label>
                                    <input className="form-input" type="date" value={form.memory_date} onChange={e => setForm({ ...form, memory_date: e.target.value })} />
                                </div>
                                {/* Media Upload */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label className="form-label">Photos & Videos</label>
                                    {/* Media Previews */}
                                    {form.images.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                                            {form.images.map((url, idx) => {
                                                const isVideo = url.match(/\.(mp4|webm|mov|quicktime)(\?.*)?$/i)
                                                return (
                                                    <div key={idx} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                                                        {isVideo ? (
                                                            <video src={url} preload="metadata" muted playsInline style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                                                        ) : (
                                                            <img src={url} alt={`Upload ${idx + 1}`} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                                                        )}
                                                        <button onClick={() => setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                                                            style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem' }}>✕</button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                    {/* Upload Zone */}
                                    <label style={{
                                        padding: '16px', borderRadius: '10px', border: '2px dashed var(--color-border-light)',
                                        textAlign: 'center', color: 'var(--color-text-tertiary)',
                                        cursor: imageUploading ? 'wait' : 'pointer', transition: 'all 0.15s',
                                    }}>
                                        {imageUploading ? (
                                            <>
                                                <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 6px', borderColor: 'var(--color-border-light)', borderTopColor: 'var(--color-primary, #2563EB)' }} />
                                                <p style={{ fontSize: '0.75rem' }}>Uploading...</p>
                                            </>
                                        ) : (
                                            <>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 6px', display: 'block', opacity: 0.5 }}>
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="17 8 12 3 7 8" />
                                                    <line x1="12" y1="3" x2="12" y2="15" />
                                                </svg>
                                                <p style={{ fontSize: '0.75rem' }}>Click to upload photos/videos</p>
                                                <p style={{ fontSize: '0.6875rem', marginTop: '2px' }}>JPG, PNG, MP4 • Max 50MB each</p>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                                            multiple
                                            style={{ display: 'none' }}
                                            disabled={imageUploading}
                                            onChange={async (e) => {
                                                const files = e.target.files
                                                if (!files || files.length === 0) return
                                                setImageUploading(true)
                                                try {
                                                    const MAX_BYTES = 50 * 1024 * 1024
                                                    const newUrls: string[] = []
                                                    const failed: string[] = []
                                                    for (const file of Array.from(files)) {
                                                        if (file.size > MAX_BYTES) {
                                                            failed.push(`${file.name} (over 50MB)`)
                                                            continue
                                                        }
                                                        // 1. Get Presigned URL (send size so the server can reject oversized/invalid files)
                                                        const res = await fetch('/api/upload/r2', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size })
                                                        })
                                                        if (!res.ok) { failed.push(file.name); continue }
                                                        const data = await res.json()
                                                        if (data.presignedUrl && data.publicUrl) {
                                                            // 2. Upload file directly to R2 using Presigned URL
                                                            const putRes = await fetch(data.presignedUrl, {
                                                                method: 'PUT',
                                                                body: file,
                                                                headers: { 'Content-Type': file.type }
                                                            })
                                                            if (putRes.ok) {
                                                                newUrls.push(data.publicUrl)
                                                            } else {
                                                                failed.push(file.name)
                                                            }
                                                        } else {
                                                            failed.push(file.name)
                                                        }
                                                    }
                                                    if (newUrls.length > 0) {
                                                        setForm(prev => ({ ...prev, images: [...prev.images, ...newUrls] }))
                                                    }
                                                    if (failed.length > 0) {
                                                        toast.error(`Failed to upload: ${failed.join(', ')}`)
                                                    }
                                                } catch {
                                                    toast.error('Upload failed. Please try again.')
                                                }
                                                finally {
                                                    setImageUploading(false)
                                                    e.target.value = ''
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.title.trim()}>
                                    {saving ? 'Saving...' : 'Add Memory'}
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
