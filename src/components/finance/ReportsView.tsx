'use client'

import React, { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import ModernDatePicker from '@/components/ui/ModernDatePicker'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16']

const getLocalDateString = (d: Date = new Date()) => {
    const local = new Date(d)
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
    return local.toISOString().split('T')[0]
}

export default function ReportsView() {
    const [loading, setLoading] = useState(true)
    const [report, setReport] = useState<any>(null)
    
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })
    const [datePreset, setDatePreset] = useState<'today' | 'this-week' | 'this-month' | 'custom'>('this-month')

    const fetchReport = async () => {
        setLoading(true)
        let url = `/api/finance/reports?1=1`
        if (datePreset === 'this-month' && !dateRange.start) {
            url += `&month=${new Date().toISOString().slice(0, 7)}`
        } else if (dateRange.start && dateRange.end) {
            url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`
        }

        const res = await fetch(url)
        if (res.ok) {
            setReport(await res.json())
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchReport()
    }, [datePreset, dateRange])

    const handleDateChange = (preset: 'today' | 'this-week' | 'this-month' | 'custom', start: Date | null, end: Date | null) => {
        setDatePreset(preset)
        if (preset === 'custom' && start && end) {
            setDateRange({ start: getLocalDateString(start), end: getLocalDateString(end) })
        } else if (preset !== 'custom') {
            setDateRange({ start: null, end: null })
        }
    }

    if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}>Loading reports...</div>
    if (!report) return <div style={{ padding: '24px', textAlign: 'center' }}>Error loading reports.</div>

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px' }}>Reports</h1>
                    <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Financial summaries and analytics</p>
                </div>
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
                        <option value="custom">Custom Range</option>
                    </select>
                    <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Export
                    </button>
                </div>
            </div>

            {datePreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
                    <div style={{ width: '150px' }}>
                        <ModernDatePicker 
                            value={dateRange.start || ''} 
                            onChange={v => setDateRange(prev => ({ ...prev, start: v }))} 
                            placeholder="Start Date" 
                        />
                    </div>
                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>to</span>
                    <div style={{ width: '150px' }}>
                        <ModernDatePicker 
                            value={dateRange.end || ''} 
                            onChange={v => setDateRange(prev => ({ ...prev, end: v }))} 
                            placeholder="End Date" 
                        />
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Total Income</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10B981' }}>৳{report.totalIncome.toLocaleString()}</div>
                </div>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Total Expense</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#DC2626' }}>৳{report.totalExpense.toLocaleString()}</div>
                </div>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Net Balance</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111' }}>৳{report.netBalance.toLocaleString()}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                
                {/* Expense Breakdown */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <h3 style={{ margin: '0 0 24px', fontSize: '1.125rem', fontWeight: 600 }}>Expense Breakdown by Category</h3>
                    {report.pieData && report.pieData.length > 0 ? (
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={report.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                                        {report.pieData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any) => `৳${Number(value).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>No expense data</div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px', justifyContent: 'center' }}>
                        {report.pieData?.map((entry: any, index: number) => (
                            <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLORS[index % COLORS.length] }}></span>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Income by Source */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                    <h3 style={{ margin: '0 0 24px', fontSize: '1.125rem', fontWeight: 600 }}>Income by Source</h3>
                    {report.incomeBarData && report.incomeBarData.length > 0 ? (
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={report.incomeBarData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" />
                                    <XAxis type="number" tickFormatter={val => `৳${val/1000}k`} />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value: any) => `৳${Number(value).toLocaleString()}`} />
                                    <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>No income data</div>
                    )}
                </div>

            </div>
        </div>
    )
}
