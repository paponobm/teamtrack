'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import RequireFeature from '@/components/common/RequireFeature'
import { usePermissions } from '@/lib/PermissionsContext'

interface Category { id: string; name: string; review_count: number; created_at: string | null; created_by: { id: string; name: string } | null }
interface Review {
    id: string
    title: string
    description: string
    image_url: string
    created_at: string
    created_by: string | null
    category: { id: string; name: string }
    author: { id: string; name: string } | null
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

const closeIcon = <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
const plusIcon = <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>

export default function CustomerReviewPage() {
    const toast = useToast()
    const [section, setSection] = useState<'review' | 'category'>('review')

    const [reviews, setReviews] = useState<Review[]>([])
    const [reviewsLoading, setReviewsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)

    const [categories, setCategories] = useState<Category[]>([])
    const [categoriesLoading, setCategoriesLoading] = useState(true)

    const [showReviewModal, setShowReviewModal] = useState(false)
    const [reviewForm, setReviewForm] = useState({ category_id: '', title: '', description: '', image_url: '' })
    const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
    const [viewingReview, setViewingReview] = useState<Review | null>(null)
    const [savingReview, setSavingReview] = useState(false)
    const [photoUploading, setPhotoUploading] = useState(false)

    const { data: perms } = usePermissions()
    const isSuperAdmin = !!(perms.is_super || perms.role === 'Owner' || perms.role === 'Super Admin')
    // Only the review's author (or a super admin) may edit it — the server enforces the same rule
    const canEditReview = (review: Review) => isSuperAdmin || (!!perms.employee_id && review.created_by === perms.employee_id)

    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
    const [categoryName, setCategoryName] = useState('')
    const [savingCategory, setSavingCategory] = useState(false)

    // Only the most recent search may update the list — a slower response for an earlier
    // keystroke must not overwrite the results for what's currently typed.
    const reviewRequestId = useRef(0)
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchReviews = async (q: string) => {
        const requestId = ++reviewRequestId.current
        setReviewsLoading(true)
        try {
            const res = await fetch(`/api/customer-reviews${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
            if (res.ok && requestId === reviewRequestId.current) setReviews((await res.json()).reviews || [])
        } catch { /* ignore */ }
        finally { if (requestId === reviewRequestId.current) setReviewsLoading(false) }
    }

    const fetchCategories = useCallback(async () => {
        setCategoriesLoading(true)
        try {
            const res = await fetch('/api/customer-review-categories')
            if (res.ok) setCategories((await res.json()).categories || [])
        } catch { /* ignore */ }
        finally { setCategoriesLoading(false) }
    }, [])

    // Initial load on mount. Async promise handlers only — section switches and searches fetch from their own handlers.
    useEffect(() => {
        let cancelled = false
        fetch('/api/customer-reviews')
            .then(r => (r.ok ? r.json() : { reviews: [] }))
            .then(d => { if (!cancelled) setReviews(d.reviews || []) })
            .catch(() => { })
            .finally(() => { if (!cancelled) setReviewsLoading(false) })
        fetch('/api/customer-review-categories')
            .then(r => (r.ok ? r.json() : { categories: [] }))
            .then(d => { if (!cancelled) setCategories(d.categories || []) })
            .catch(() => { })
            .finally(() => { if (!cancelled) setCategoriesLoading(false) })
        return () => { cancelled = true }
    }, [])

    // Debounced so typing doesn't fire a request per keystroke; a suggestion click searches immediately.
    const handleSearch = (value: string, immediate = false) => {
        setSearch(value)
        if (searchTimer.current) clearTimeout(searchTimer.current)
        if (immediate) { fetchReviews(value); return }
        searchTimer.current = setTimeout(() => fetchReviews(value), 250)
    }

    const handlePhotoUpload = async (file: File) => {
        if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return }
        setPhotoUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('bucket', 'memories')
            formData.append('folder', 'customer-review')
            const res = await fetch('/api/upload', { method: 'POST', body: formData })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.url) { toast.error(data.error || 'Upload failed. Please try again.'); return }
            setReviewForm(prev => ({ ...prev, image_url: data.url }))
        } catch { toast.error('Upload failed. Please try again.') }
        finally { setPhotoUploading(false) }
    }

    const openAddReview = () => {
        setEditingReviewId(null)
        setReviewForm({ category_id: '', title: '', description: '', image_url: '' })
        setShowReviewModal(true)
    }
    const openEditReview = (review: Review) => {
        setEditingReviewId(review.id)
        setReviewForm({ category_id: review.category.id, title: review.title, description: review.description, image_url: review.image_url })
        setShowReviewModal(true)
    }

    const saveReview = async () => {
        setSavingReview(true)
        try {
            const res = editingReviewId
                ? await fetch(`/api/customer-reviews?id=${editingReviewId}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reviewForm),
                })
                : await fetch('/api/customer-reviews', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reviewForm),
                })
            if (res.ok) {
                setShowReviewModal(false)
                setEditingReviewId(null)
                setReviewForm({ category_id: '', title: '', description: '', image_url: '' })
                await Promise.all([fetchReviews(search), fetchCategories()])
                toast.success(editingReviewId ? 'Customer review updated' : 'Customer review added')
            } else {
                toast.error((await res.json()).error || (editingReviewId ? 'Failed to update customer review' : 'Failed to add customer review'))
            }
        } catch { toast.error('A network error occurred. Please try again.') }
        finally { setSavingReview(false) }
    }

    const deleteReview = async (review: Review) => {
        if (!confirm(`Delete review "${review.title}"? This cannot be undone.`)) return
        try {
            const res = await fetch(`/api/customer-reviews?id=${review.id}`, { method: 'DELETE' })
            if (res.ok) {
                await Promise.all([fetchReviews(search), fetchCategories()])
                toast.success('Customer review deleted')
            } else {
                toast.error((await res.json()).error || 'Failed to delete customer review')
            }
        } catch { toast.error('A network error occurred. Please try again.') }
    }

    const openAddCategory = () => { setEditingCategoryId(null); setCategoryName(''); setShowCategoryModal(true) }
    const openEditCategory = (c: Category) => { setEditingCategoryId(c.id); setCategoryName(c.name); setShowCategoryModal(true) }

    const saveCategory = async () => {
        setSavingCategory(true)
        try {
            const res = editingCategoryId
                ? await fetch('/api/customer-review-categories', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingCategoryId, name: categoryName }),
                })
                : await fetch('/api/customer-review-categories', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: categoryName }),
                })
            if (res.ok) {
                setShowCategoryModal(false)
                setCategoryName('')
                setEditingCategoryId(null)
                await fetchCategories()
                toast.success(editingCategoryId ? 'Category updated' : 'Category added')
            } else {
                toast.error((await res.json()).error || 'Failed to save category')
            }
        } catch { toast.error('A network error occurred. Please try again.') }
        finally { setSavingCategory(false) }
    }

    const deleteCategory = async (c: Category) => {
        if (!confirm(`Delete category "${c.name}"? This cannot be undone.`)) return
        try {
            const res = await fetch(`/api/customer-review-categories?id=${c.id}`, { method: 'DELETE' })
            if (res.ok) {
                await fetchCategories()
                toast.success('Category deleted')
            } else {
                toast.error((await res.json()).error || 'Failed to delete category')
            }
        } catch { toast.error('A network error occurred. Please try again.') }
    }

    const downloadPhoto = async (review: Review) => {
        try {
            const res = await fetch(review.image_url)
            if (!res.ok) throw new Error('download failed')
            const blob = await res.blob()
            const objectUrl = URL.createObjectURL(blob)
            const extMatch = review.image_url.match(/\.(jpe?g|png|webp|gif)(\?.*)?$/i)
            const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
            const base = review.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'customer-review'
            const a = document.createElement('a')
            a.href = objectUrl
            a.download = `${base}.${ext}`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(objectUrl)
        } catch {
            toast.error('Could not download the photo. Please try again.')
        }
    }

    return (
        <RequireFeature slugs={['customer-review']}>
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Customer Review</h1>
                    <p className="page-subtitle">Customer feedback, grouped by category.</p>
                </div>
                {section === 'review' ? (
                    <button className="btn btn-sm" style={{ background: '#3B82F6', color: '#fff', border: 'none' }} onClick={openAddReview}>{plusIcon} Add Customer Review</button>
                ) : (
                    <button className="btn btn-sm" style={{ background: '#3B82F6', color: '#fff', border: 'none' }} onClick={openAddCategory}>{plusIcon} Add Category</button>
                )}
            </motion.div>

            <motion.div variants={item} style={{
                display: 'flex', gap: '6px', padding: '6px', width: 'fit-content', borderRadius: '16px',
                marginBottom: '20px', background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(139,92,246,0.06))',
                border: '1px solid var(--color-border-light)',
            }}>
                {([
                    { key: 'review' as const, label: 'Review', gradient: 'linear-gradient(135deg, #2563EB, #1D4ED8)', shadow: 'rgba(37,99,235,0.35)' },
                    { key: 'category' as const, label: 'Category', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', shadow: 'rgba(139,92,246,0.35)' },
                ]).map(tab => {
                    const isActive = section === tab.key
                    return (
                        <button key={tab.key} onClick={() => setSection(tab.key)}
                            style={{
                                position: 'relative', display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 22px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                fontSize: '0.9375rem', fontWeight: 600, zIndex: 1, transition: 'color 0.25s',
                                color: isActive ? '#fff' : 'var(--color-text-tertiary)',
                            }}>
                            {isActive && (
                                <motion.div layoutId="customerReviewSectionTab" transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                    style={{ position: 'absolute', inset: 0, borderRadius: '12px', background: tab.gradient, boxShadow: `0 6px 16px -2px ${tab.shadow}`, zIndex: -1 }} />
                            )}
                            {tab.label}
                        </button>
                    )
                })}
            </motion.div>

            {section === 'review' && (
                <>
                    <motion.div variants={item} style={{ marginBottom: '20px', maxWidth: '360px', position: 'relative' }}>
                        <input className="form-input" value={search} placeholder="Search by category name..."
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setShowSuggestions(false)}
                            onChange={e => { handleSearch(e.target.value); setShowSuggestions(true) }} />
                        {showSuggestions && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, maxHeight: '260px', overflowY: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: '4px' }}>
                                {categories.filter(c => c.name.toLowerCase().startsWith(search.trim().toLowerCase())).length === 0 ? (
                                    <div style={{ padding: '10px 12px', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>No matching categories</div>
                                ) : (
                                    categories.filter(c => c.name.toLowerCase().startsWith(search.trim().toLowerCase())).map(c => (
                                        <button key={c.id} type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => { handleSearch(c.name, true); setShowSuggestions(false) }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-primary)', textAlign: 'left' }}>
                                            <span>{c.name}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{c.review_count}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </motion.div>

                    {reviewsLoading ? (
                        <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="card" style={{ padding: 0 }}>
                                    <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '12px 12px 0 0' }} />
                                    <div style={{ padding: '16px' }}>
                                        <div className="skeleton" style={{ width: '70%', height: 14, marginBottom: '8px' }} />
                                        <div className="skeleton" style={{ width: '50%', height: 10 }} />
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    ) : reviews.length === 0 ? (
                        <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>{search ? 'No reviews match this category' : 'No customer reviews yet'}</h3>
                            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>{search ? 'Try a different category name.' : 'Add the first customer review to get started.'}</p>
                        </motion.div>
                    ) : (
                        <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                            {reviews.map(review => (
                                <motion.div key={review.id} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                                    onClick={() => setViewingReview(review)}
                                    whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }} transition={{ duration: 0.25 }}>
                                    <div style={{ position: 'relative', height: '200px', background: `url(${review.image_url}) center/cover` }}>
                                        <span style={{ position: 'absolute', top: '10px', left: '10px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.6875rem', fontWeight: 600 }}>
                                            {review.category.name}
                                        </span>
                                        <button onClick={e => { e.stopPropagation(); downloadPhoto(review) }} title="Download photo"
                                            style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer' }}>
                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 14a1 1 0 011 1v1h12v-1a1 1 0 112 0v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1a1 1 0 011-1zm7-11a1 1 0 011 1v6.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 10.586V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                            Download
                                        </button>
                                    </div>
                                    <div style={{ padding: '16px 20px' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px', lineHeight: 1.4 }}>{review.title}</h3>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                                            {review.description}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                            <span>{review.author?.name || 'Anonymous'}</span>
                                            <span>·</span>
                                            <span>{new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                            {canEditReview(review) && (
                                                <button className="btn btn-ghost btn-sm" title="Edit review" onClick={e => { e.stopPropagation(); openEditReview(review) }}>Edit</button>
                                            )}
                                            {isSuperAdmin && (
                                                <button className="btn btn-ghost btn-sm" title="Delete review" style={{ color: '#DC2626' }} onClick={e => { e.stopPropagation(); deleteReview(review) }}>Delete</button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </>
            )}

            {section === 'category' && (
                categoriesLoading ? (
                    <motion.div variants={item} className="card" style={{ padding: '24px' }}>
                        <div className="skeleton" style={{ width: '40%', height: 14, marginBottom: '10px' }} />
                        <div className="skeleton" style={{ width: '25%', height: 10 }} />
                    </motion.div>
                ) : categories.length === 0 ? (
                    <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>No categories yet</h3>
                        <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Add a category before adding customer reviews.</p>
                    </motion.div>
                ) : (
                    <motion.div variants={item} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {categories.map((c, i) => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 20px', borderBottom: i < categories.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{c.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                                        Added by {c.created_by?.name || 'Unknown'}{c.created_at ? ` · ${new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(37,99,235,0.1)', color: 'var(--color-primary, #2563EB)', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        {c.review_count} review{c.review_count === 1 ? '' : 's'}
                                    </span>
                                    <button className="btn btn-ghost btn-sm" title="Edit category" onClick={() => openEditCategory(c)}>Edit</button>
                                    {isSuperAdmin && (
                                        <button className="btn btn-ghost btn-sm" title="Delete category" style={{ color: '#DC2626' }} onClick={() => deleteCategory(c)}>Delete</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )
            )}

            {/* View full review */}
            <AnimatePresence>
                {viewingReview && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingReview(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{viewingReview.title}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setViewingReview(null)}>{closeIcon}</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <img src={viewingReview.image_url} alt={viewingReview.title} style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', background: '#F8FAFC', borderRadius: '8px' }} />
                                <span style={{ alignSelf: 'flex-start', padding: '4px 10px', borderRadius: '8px', background: 'var(--color-bg-secondary, #F1F5F9)', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {viewingReview.category.name}
                                </span>
                                <p style={{ fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{viewingReview.description}</p>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                    {viewingReview.author?.name || 'Anonymous'} · {new Date(viewingReview.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => downloadPhoto(viewingReview)}>Download photo</button>
                                <button className="btn btn-primary btn-sm" onClick={() => setViewingReview(null)}>Close</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Customer Review */}
            <AnimatePresence>
                {showReviewModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{editingReviewId ? 'Edit Customer Review' : 'Add Customer Review'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowReviewModal(false)}>{closeIcon}</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group">
                                    <label className="form-label">Category *</label>
                                    <select className="form-input" value={reviewForm.category_id} onChange={e => setReviewForm({ ...reviewForm, category_id: e.target.value })}>
                                        <option value="">{categories.length ? 'Select category...' : 'No categories yet — add one first'}</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Title *</label>
                                    <input className="form-input" value={reviewForm.title} onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })} placeholder="e.g. Fast delivery, great packaging..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description *</label>
                                    <textarea className="form-input" rows={4} style={{ resize: 'vertical' }} value={reviewForm.description} onChange={e => setReviewForm({ ...reviewForm, description: e.target.value })} placeholder="What did the customer say?" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label className="form-label">Photo *</label>
                                    {reviewForm.image_url ? (
                                        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                                            <img src={reviewForm.image_url} alt="Review photo" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px' }} />
                                            <button onClick={() => setReviewForm(prev => ({ ...prev, image_url: '' }))}
                                                style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.625rem' }}>✕</button>
                                        </div>
                                    ) : (
                                        <label style={{ padding: '16px', borderRadius: '10px', border: '2px dashed var(--color-border-light)', textAlign: 'center', color: 'var(--color-text-tertiary)', cursor: photoUploading ? 'wait' : 'pointer' }}>
                                            <p style={{ fontSize: '0.75rem' }}>{photoUploading ? 'Uploading...' : 'Click to upload a photo'}</p>
                                            {!photoUploading && <p style={{ fontSize: '0.6875rem', marginTop: '2px' }}>JPG, PNG, WEBP, GIF • Max 2MB</p>}
                                            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} disabled={photoUploading}
                                                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = '' }} />
                                        </label>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowReviewModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={saveReview}
                                    disabled={savingReview || photoUploading || !reviewForm.category_id || !reviewForm.title.trim() || !reviewForm.description.trim() || !reviewForm.image_url}>
                                    {savingReview ? 'Saving...' : editingReviewId ? 'Save Changes' : 'Add Customer Review'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Category */}
            <AnimatePresence>
                {showCategoryModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{editingCategoryId ? 'Edit Category' : 'Add Category'}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowCategoryModal(false)}>{closeIcon}</button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Category Name *</label>
                                    <input className="form-input" value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g. Packaging" maxLength={60} autoFocus
                                        onKeyDown={e => { if (e.key === 'Enter' && categoryName.trim() && !savingCategory) saveCategory() }} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowCategoryModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={saveCategory} disabled={savingCategory || !categoryName.trim()}>
                                    {savingCategory ? 'Saving...' : editingCategoryId ? 'Save Changes' : 'Add Category'}
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
