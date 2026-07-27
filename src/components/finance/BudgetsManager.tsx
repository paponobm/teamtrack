'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ModernMonthPicker from '@/components/ui/ModernMonthPicker'

interface Budget {
    id: string
    category_id: string
    period: string
    amount: number
    category?: { name: string }
    spent?: number
}

interface Category {
    id: string
    name: string
    type: string
}

export default function BudgetsManager() {
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
    const [form, setForm] = useState({ category_id: '', amount: '' })
    const [saving, setSaving] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        const [budgetsRes, categoriesRes] = await Promise.all([
            fetch(`/api/finance/budgets?period=${period}`),
            fetch('/api/finance/categories')
        ])
        
        // In a real app we'd fetch actual expenses for the month to calculate `spent`.
        // For now, we'll fetch reports to estimate or just show basic budgets.
        // Let's fetch report data to compute spent amount per category.
        const reportsRes = await fetch(`/api/finance/reports?month=${period}`)
        
        let budgetsData = []
        let expenseByCategory: Record<string, number> = {}

        if (budgetsRes.ok) budgetsData = await budgetsRes.json()
        if (categoriesRes.ok) setCategories((await categoriesRes.json()).filter((c: Category) => c.type === 'expense'))
        
        if (reportsRes.ok) {
            const reportData = await reportsRes.json()
            reportData.pieData?.forEach((d: {name: string, value: number}) => {
                expenseByCategory[d.name] = d.value
            })
        }

        const enrichedBudgets = budgetsData.map((b: Budget) => ({
            ...b,
            spent: expenseByCategory[b.category?.name || ''] || 0
        }))

        setBudgets(enrichedBudgets)
        setLoading(false)
    }

    const handleMonthChange = (delta: number) => {
        const [y, m] = period.split('-').map(Number)
        const d = new Date(y, m - 1 + delta, 1)
        setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const currentMonthName = new Date(`${period}-01T00:00:00`).toLocaleString('default', { month: 'long', year: 'numeric' })

    useEffect(() => {
        fetchData()
    }, [period])

    const handleSave = async () => {
        setSaving(true)
        const res = await fetch('/api/finance/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: form.category_id,
                period,
                amount: Number(form.amount)
            })
        })
        setSaving(false)
        if (res.ok) {
            setShowModal(false)
            setForm({ category_id: '', amount: '' })
            fetchData()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this budget limit?')) return
        const res = await fetch(`/api/finance/budgets?id=${id}`, { method: 'DELETE' })
        if (res.ok) fetchData()
    }

    if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}>Loading budgets...</div>

    const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0)
    const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0)
    const overBudgetCount = budgets.filter(b => (b.spent || 0) > b.amount).length

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px' }}>Budgets</h1>
                    <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Set and track monthly spending limits by category</p>
                </div>
                <button className="btn" style={{ background: '#10B981', color: '#fff', border: 'none' }} onClick={() => setShowModal(true)}>
                    + Set Budget
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Period</div>
                    <div style={{ marginLeft: '-8px' }}>
                        <ModernMonthPicker value={period} onChange={setPeriod} />
                    </div>
                </div>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Total Budget</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>৳{totalBudget.toLocaleString()}</div>
                </div>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Total Spent</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: totalSpent > totalBudget ? '#DC2626' : '#10B981' }}>৳{totalSpent.toLocaleString()}</div>
                </div>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Over Budget</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: overBudgetCount > 0 ? '#DC2626' : 'var(--color-text-primary)' }}>{overBudgetCount} categories</div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {budgets.map(budget => {
                    const spent = budget.spent || 0
                    const isOver = spent > budget.amount
                    const percentage = Math.min((spent / budget.amount) * 100, 100)
                    
                    return (
                        <div key={budget.id} style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isOver && <span style={{ color: '#DC2626' }}>⚠️</span>}
                                    <h3 style={{ margin: 0, fontWeight: 600 }}>{budget.category?.name || 'Unknown'}</h3>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600 }}>৳{spent.toLocaleString()} / ৳{budget.amount.toLocaleString()}</div>
                                        <div style={{ fontSize: '0.75rem', color: isOver ? '#DC2626' : 'var(--color-text-tertiary)' }}>
                                            {isOver ? `Over by ৳${(spent - budget.amount).toLocaleString()}` : `৳${(budget.amount - spent).toLocaleString()} remaining`} ({Math.round((spent/budget.amount)*100)}% used)
                                        </div>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(budget.id)} style={{ color: '#DC2626' }}>&times;</button>
                                </div>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'var(--color-surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${percentage}%`, height: '100%', background: isOver ? '#DC2626' : (percentage > 80 ? '#F59E0B' : '#10B981'), transition: 'width 0.3s ease' }}></div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">Set Budget</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>&times;</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <select className="form-input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                                        <option value="">Select category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Amount (৳)</label>
                                    <input className="form-input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Budget limit" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-sm" style={{ background: '#10B981', color: '#fff', border: 'none' }} onClick={handleSave} disabled={saving || !form.category_id || !form.amount}>
                                    {saving ? 'Saving...' : 'Save Budget'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
