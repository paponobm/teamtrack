'use client'

import React, { useState, useEffect } from 'react'

interface Transaction {
    id: string
    type: 'income' | 'expense'
    date: string
    category_name: string
    description: string
    amount: number
    payment_method?: string
    payment_status?: string
    user?: { id: string; name: string }
    created_at: string
}

const getLocalDateString = (d: Date = new Date()) => {
    const local = new Date(d)
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
    return local.toISOString().split('T')[0]
}

export default function TransactionsList() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, income, expense
    
    // Date filter state
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })
    const [datePreset, setDatePreset] = useState<'today' | 'this-week' | 'this-month' | 'custom'>('this-month')

    const fetchTransactions = async () => {
        setLoading(true)
        let url = `/api/finance/transactions?1=1`
        if (datePreset === 'this-month' && !dateRange.start) {
            url += `&month=${new Date().toISOString().slice(0, 7)}`
        } else if (dateRange.start && dateRange.end) {
            url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`
        }
        
        const res = await fetch(url)
        if (res.ok) {
            const data = await res.json()
            setTransactions(data.transactions)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchTransactions()
    }, [datePreset, dateRange])

    const handleDateChange = (preset: 'today' | 'this-week' | 'this-month' | 'custom', start: Date | null, end: Date | null) => {
        setDatePreset(preset)
        if (preset === 'custom' && start && end) {
            setDateRange({ start: getLocalDateString(start), end: getLocalDateString(end) })
        } else if (preset !== 'custom') {
            setDateRange({ start: null, end: null })
        }
    }

    const filtered = transactions.filter(t => filter === 'all' || t.type === filter)

    const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px' }}>Transactions</h1>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select 
                            value={datePreset}
                            onChange={(e) => handleDateChange(e.target.value as any, null, null)}
                            className="input" 
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}
                        >
                            <option value="today">Today</option>
                            <option value="this-week">This Week</option>
                            <option value="this-month">This Month</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Income</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#10B981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                        ৳{totalIncome.toLocaleString()}
                    </div>
                </div>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Expense</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#DC2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                        ৳{totalExpense.toLocaleString()}
                    </div>
                </div>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Net</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        {totalIncome - totalExpense > 0 ? '+' : ''}৳{(totalIncome - totalExpense).toLocaleString()}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                {['all', 'income', 'expense'].map(f => (
                    <button key={f} className={`btn btn-sm ${filter === f ? '' : 'btn-ghost'}`} onClick={() => setFilter(f)} style={filter === f ? { background: '#fff', color: '#111', border: '1px solid var(--color-border)' } : {}}>
                        {f === 'all' ? 'All Types' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border-light)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                    {filtered.length} TRANSACTIONS
                </div>
                {loading ? (
                    <div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No transactions found</div>
                ) : (
                    <div>
                        {filtered.map((t, idx) => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--color-border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: t.type === 'income' ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: t.type === 'income' ? '#10B981' : '#DC2626', marginRight: '16px' }}>
                                    {t.type === 'income' ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <h4 style={{ margin: 0, fontWeight: 600 }}>{t.category_name}</h4>
                                        <span style={{ fontSize: '0.6875rem', padding: '2px 6px', background: 'var(--color-surface-hover)', borderRadius: '4px', color: 'var(--color-text-secondary)' }}>{t.description}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {t.user?.name || 'Unknown'}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', fontWeight: 600, color: t.type === 'income' ? '#10B981' : '#DC2626' }}>
                                    {t.type === 'income' ? '+' : '-'}৳{Number(t.amount).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
