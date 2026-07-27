'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'

interface Fund {
    id: string
    name: string
    balance: number
    category: string
    created_at: string
}

export default function FundsManager() {
    const toast = useToast()
    const [funds, setFunds] = useState<Fund[]>([])
    const [loading, setLoading] = useState(true)

    // Modals
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState<Fund | null>(null)

    // Forms
    const [addForm, setAddForm] = useState({ name: '', balance: '', category: 'Mobile Banking' })
    const [editForm, setEditForm] = useState({ balance: '' })
    const [saving, setSaving] = useState(false)

    const fetchFunds = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/finance/funds')
            if (res.ok) {
                const data = await res.json()
                setFunds(data)
            }
        } catch {
            // Error handled silently or toast
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchFunds()
    }, [fetchFunds])

    const handleAddSubmit = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/finance/funds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: addForm.name, balance: addForm.balance, category: addForm.category })
            })
            if (res.ok) {
                toast.success('Fund added successfully')
                setShowAddModal(false)
                setAddForm({ name: '', balance: '', category: 'Mobile Banking' })
                fetchFunds()
            } else {
                toast.error('Failed to add fund')
            }
        } catch {
            toast.error('Failed to add fund')
        } finally {
            setSaving(false)
        }
    }

    const handleEditSubmit = async () => {
        if (!showEditModal) return
        setSaving(true)
        try {
            const res = await fetch('/api/finance/funds', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: showEditModal.id, balance: editForm.balance })
            })
            if (res.ok) {
                toast.success('Fund balance updated')
                setShowEditModal(null)
                fetchFunds()
            } else {
                toast.error('Failed to update balance')
            }
        } catch {
            toast.error('Failed to update balance')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this fund?')) return
        try {
            const res = await fetch(`/api/finance/funds?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Fund deleted')
                fetchFunds()
            } else {
                toast.error('Failed to delete fund')
            }
        } catch {
            toast.error('Failed to delete fund')
        }
    }

    const totalBalance = funds.reduce((acc, f) => acc + Number(f.balance), 0)

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading funds...</div>
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Company Funds</h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>Total Available: <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>৳{totalBalance.toLocaleString()}</span></p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ marginRight: '6px' }}><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Add Fund
                </button>
            </div>

            {funds.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px dashed var(--color-border-light)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏦</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>No Funds configured</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Add a fund (e.g. Bkash, Cash) to track its balance.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {funds.map((fund, i) => (
                        <motion.div key={fund.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{fund.name}</div>
                                    <div style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--color-bg-elevated)', borderRadius: '12px', display: 'inline-block', marginTop: '6px', border: '1px solid var(--color-border-light)' }}>
                                        {fund.category || 'Uncategorized'}
                                    </div>
                                </div>
                                <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(fund.id)} style={{ color: '#DC2626', alignSelf: 'flex-start' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                                </button>
                            </div>
                            
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Balance</div>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10B981' }}>৳{Number(fund.balance).toLocaleString()}</div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <div style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>MONEY IN (ALL TIME)</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10B981' }}>Syncing...</div>
                                    </div>
                                    <div style={{ flex: 1, padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#EF4444', fontWeight: 600 }}>MONEY OUT (ALL TIME)</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#EF4444' }}>Syncing...</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ marginTop: 'auto' }}>
                                <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => { setShowEditModal(fund); setEditForm({ balance: String(fund.balance) }) }}>
                                    Adjust Balance
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Add New Fund</h2>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Fund Name</label>
                                    <input className="form-input" placeholder="e.g. Bkash, Cash, City Bank" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <select className="form-input" value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })}>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Account">Bank Account</option>
                                        <option value="Mobile Banking">Mobile Banking</option>
                                        <option value="Digital Wallet">Digital Wallet</option>
                                        <option value="Investment">Investment</option>
                                        <option value="Credit Card">Credit Card</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Initial Balance (৳)</label>
                                    <input type="number" className="form-input" placeholder="0" value={addForm.balance} onChange={e => setAddForm({ ...addForm, balance: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleAddSubmit} disabled={saving || !addForm.name.trim()}>
                                    {saving ? 'Adding...' : 'Add Fund'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Adjust Balance: {showEditModal.name}</h2>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">New Balance (৳)</label>
                                    <input type="number" className="form-input" placeholder="0" value={editForm.balance} onChange={e => setEditForm({ ...editForm, balance: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(null)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleEditSubmit} disabled={saving || !editForm.balance.trim()}>
                                    {saving ? 'Saving...' : 'Update Balance'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
