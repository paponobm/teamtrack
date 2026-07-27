'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Category {
    id: string
    name: string
    type: 'income' | 'expense'
    parent_id: string | null
}

export default function CategoriesManager() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ name: '', type: 'expense', parent_id: '' })
    const [saving, setSaving] = useState(false)

    const fetchCategories = async () => {
        setLoading(true)
        const res = await fetch('/api/finance/categories')
        if (res.ok) {
            setCategories(await res.json())
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        const res = await fetch('/api/finance/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name,
                type: form.type,
                parent_id: form.parent_id || null
            })
        })
        setSaving(false)
        if (res.ok) {
            setShowModal(false)
            setForm({ name: '', type: 'expense', parent_id: '' })
            fetchCategories()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category?')) return
        const res = await fetch(`/api/finance/categories?id=${id}`, { method: 'DELETE' })
        if (res.ok) fetchCategories()
    }

    const expenses = categories.filter(c => c.type === 'expense')
    const incomes = categories.filter(c => c.type === 'income')

    if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}>Loading categories...</div>

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px' }}>Categories</h1>
                    <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Manage income and expense categories with subcategories</p>
                </div>
                <button className="btn" style={{ background: '#10B981', color: '#fff', border: 'none' }} onClick={() => setShowModal(true)}>
                    + Add Category
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
                {/* Expense Categories */}
                <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.125rem', marginBottom: '16px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#DC2626' }}></span>
                        Expense Categories
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {expenses.filter(c => !c.parent_id).map(parent => (
                            <div key={parent.id} style={{ background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h4 style={{ margin: '0 0 4px', fontWeight: 600 }}>{parent.name}</h4>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(parent.id)} style={{ padding: '4px', color: '#DC2626' }}>
                                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>
                                    Subcategories: {expenses.filter(c => c.parent_id === parent.id).length} items
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {expenses.filter(c => c.parent_id === parent.id).map(sub => (
                                        <span key={sub.id} style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--color-surface-hover)', borderRadius: '20px', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {sub.name}
                                            <button onClick={() => handleDelete(sub.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-tertiary)' }}>&times;</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Income Categories */}
                <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.125rem', marginBottom: '16px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
                        Income Categories
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {incomes.filter(c => !c.parent_id).map(parent => (
                            <div key={parent.id} style={{ background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h4 style={{ margin: '0 0 4px', fontWeight: 600 }}>{parent.name}</h4>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(parent.id)} style={{ padding: '4px', color: '#DC2626' }}>
                                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>
                                    Subcategories: {incomes.filter(c => c.parent_id === parent.id).length} items
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {incomes.filter(c => c.parent_id === parent.id).map(sub => (
                                        <span key={sub.id} style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--color-surface-hover)', borderRadius: '20px', border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {sub.name}
                                            <button onClick={() => handleDelete(sub.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-tertiary)' }}>&times;</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Add Category</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>&times;</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Server, Software" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}>
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Parent Category (Optional)</label>
                                    <select className="form-input" value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}>
                                        <option value="">None (Top-level)</option>
                                        {categories.filter(c => c.type === form.type && !c.parent_id).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-sm" style={{ background: '#10B981', color: '#fff', border: 'none' }} onClick={handleSave} disabled={saving || !form.name}>
                                    {saving ? 'Saving...' : 'Save Category'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
