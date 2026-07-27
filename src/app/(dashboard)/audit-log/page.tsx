'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import DatePicker from '@/components/ui/DatePicker'

interface AuditEntry {
    id: string; action: string; module: string; target_id: string | null
    details: Record<string, unknown> | null; created_at: string
    actor: { name: string } | { name: string }[] | null
}

function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

const moduleColors: Record<string, string> = {
    members: '#2563EB', work_log: '#3B82F6', attendance: '#1D4ED8', performance: '#60A5FA',
    problems: '#DC2626', expenses: '#CA8A04', courier: '#7C3AED', requisitions: '#059669',
    ideas: '#F59E0B', content: '#EC4899', permissions: '#1E40AF', settings: '#6B7280',
    notices: '#0EA5E9', tasks: '#8B5CF6', default: '#6B7280',
}

const allModules = Object.keys(moduleColors).filter(m => m !== 'default')

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export default function AuditLogPage() {
    const { lang } = useLanguage()
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [moduleFilter, setModuleFilter] = useState('all')
    const [dateRangeMode, setDateRangeMode] = useState<'today' | 'week' | 'month' | 'custom'>('today')
    const [refDate, setRefDate] = useState(() => new Date().toISOString().split('T')[0])
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const getWeekRange = (d: Date) => {
        const day = d.getDay()
        const start = new Date(d); start.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
        const end = new Date(start); end.setDate(start.getDate() + 6)
        return { start: fmtLocalDate(start), end: fmtLocalDate(end) }
    }
    const getMonthRange = (d: Date) => {
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        return { start: fmtLocalDate(start), end: fmtLocalDate(end) }
    }

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('limit', '200')
            if (searchQuery) params.set('search', searchQuery)
            if (moduleFilter !== 'all') params.set('module', moduleFilter)
            if (dateRangeMode === 'today') {
                params.set('start_date', refDate); params.set('end_date', refDate)
            } else if (dateRangeMode === 'week') {
                const r = getWeekRange(new Date(refDate)); params.set('start_date', r.start); params.set('end_date', r.end)
            } else if (dateRangeMode === 'month') {
                const r = getMonthRange(new Date(refDate)); params.set('start_date', r.start); params.set('end_date', r.end)
            } else if (dateRangeMode === 'custom' && customStart && customEnd) {
                params.set('start_date', customStart); params.set('end_date', customEnd)
            }
            const res = await fetch(`/api/audit-log?${params}`)
            if (res.ok) { const d = await res.json(); setEntries(d.entries || []); setTotal(d.total || 0) }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [searchQuery, moduleFilter, dateRangeMode, refDate, customStart, customEnd])

    useEffect(() => { fetchData() }, [fetchData])

    const getActorName = (actor: AuditEntry['actor']) => {
        if (!actor) return 'System'
        if (Array.isArray(actor)) return actor[0]?.name || 'Unknown'
        return actor.name || 'Unknown'
    }

    return (
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">{lang === 'bn' ? 'অডিট লগ' : 'Audit Log'}</h1>
                    <p className="page-subtitle">{lang === 'bn' ? 'সিস্টেমের সকল ইভেন্ট ট্র্যাক করুন' : 'Track all system events and changes'}</p>
                </div>
                <span className="badge badge-neutral">{total} {lang === 'bn' ? 'টি ইভেন্ট' : 'events'}</span>
            </motion.div>

            {/* Date Range Selector */}
            <motion.div variants={item} style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {([{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }] as const).map(tab => (
                        <button key={tab.key} onClick={() => setDateRangeMode(tab.key)}
                            style={{
                                position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                color: dateRangeMode === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                            }}>
                            {dateRangeMode === tab.key && (
                                <motion.div layoutId="auditDateTab" style={{
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
                        <button className="btn btn-ghost btn-icon" onClick={() => { const d = new Date(refDate); if (dateRangeMode === 'month') d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - (dateRangeMode === 'week' ? 7 : 1)); setRefDate(d.toISOString().split('T')[0]) }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                        <button className="btn btn-ghost btn-icon" onClick={() => { const d = new Date(refDate); if (dateRangeMode === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + (dateRangeMode === 'week' ? 7 : 1)); setRefDate(d.toISOString().split('T')[0]) }} style={{ borderRadius: '8px' }}>
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

            {/* Search + Module Filter */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <input className="form-input" type="text" placeholder="Search actions..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '34px', height: '36px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px' }}
                    />
                </div>
                <select className="form-input" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
                    style={{ height: '36px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px', width: 'auto', minWidth: '140px' }}>
                    <option value="all">All Modules</option>
                    {allModules.map(m => (
                        <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                </select>
            </motion.div>

            <motion.div className="card" variants={item}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</div>
                ) : entries.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                        <svg width="40" height="40" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.3, margin: '0 auto 12px' }}><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                        <div>{lang === 'bn' ? 'এখনো কোন লগ নেই' : 'No audit entries found'}</div>
                        <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>{lang === 'bn' ? 'ফিল্টার পরিবর্তন করুন' : 'Try adjusting your filters'}</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {entries.map((entry, i) => (
                            <motion.div key={entry.id} variants={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${moduleColors[entry.module] || moduleColors.default}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: moduleColors[entry.module] || moduleColors.default }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.875rem' }}>
                                        <strong>{getActorName(entry.actor)}</strong> {entry.action}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                                        <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>{entry.module}</span>
                                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{timeAgo(entry.created_at)}</span>
                                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
                                            {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>
        </motion.div>
    )
}
