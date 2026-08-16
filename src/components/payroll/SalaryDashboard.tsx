'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    IconUsers, IconWallet, IconCheckCircle, IconClock,
    IconBanknote, IconGift, IconTrendingUp, IconAward, IconPartyPopper,
} from '@/components/icons/Icons'

interface DashboardStats {
    sheetExists: boolean
    totalEmployees: number
    totalPayroll: number
    paidEmployees: number
    paidAmount: number
    unpaidEmployees: number
    unpaidAmount: number
    totalBasicSalary: number
    totalAdvance: number
    totalLoan: number
    totalPerformanceBonus: number
    totalFestivalBonus: number
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function currentMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Icon-left "white section" stat tile — an icon badge on the left, label/value stacked on
// the right, reusing the shared .card surface so it matches the app's existing card styling.
function StatTile({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
    return (
        <motion.div variants={item} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color, lineHeight: 1.3 }}>{value}</div>
                {sub && <div style={{ fontSize: '0.6875rem', color, marginTop: '2px' }}>{sub}</div>}
            </div>
        </motion.div>
    )
}

// month is controlled by the parent Payroll Management page — shared with the Salary Sheet
// below it so both always reflect the same selected month from one filter bar.
export default function SalaryDashboard({ month = currentMonth() }: { month?: string }) {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(true)

    const load = useCallback(async (m: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/payroll/dashboard?month=${m}`)
            if (res.ok) setStats(await res.json())
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load(month) }, [month, load])

    return (
        <div>
            {!loading && stats && !stats.sheetExists && (
                <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    No salary sheet has been created for this month yet. Create one below to get started.
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Payroll Summary</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <motion.div variants={container} initial="hidden" animate="show"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                            <StatTile icon={<IconUsers size={20} color="#2563EB" />} color="#2563EB"
                                label="Total Employees" value={loading ? '—' : String(stats?.totalEmployees ?? 0)} />
                            <StatTile icon={<IconWallet size={20} color="#2563EB" />} color="#2563EB"
                                label="Total Payroll" value={loading ? '—' : `৳${(stats?.totalPayroll ?? 0).toLocaleString()}`} />
                            <StatTile icon={<IconCheckCircle size={20} color="#16A34A" />} color="#16A34A"
                                label="Paid Employees" value={loading ? '—' : String(stats?.paidEmployees ?? 0)}
                                sub={`৳${(stats?.paidAmount ?? 0).toLocaleString()}`} />
                            <StatTile icon={<IconClock size={20} color="#DC2626" />} color="#DC2626"
                                label="Unpaid Employees" value={loading ? '—' : String(stats?.unpaidEmployees ?? 0)}
                                sub={`৳${(stats?.unpaidAmount ?? 0).toLocaleString()}`} />
                        </motion.div>

                        <motion.div variants={container} initial="hidden" animate="show"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '12px' }}>
                            <StatTile icon={<IconBanknote size={20} color="#2563EB" />} color="#2563EB"
                                label="Total Basic Salary" value={loading ? '—' : `৳${(stats?.totalBasicSalary ?? 0).toLocaleString()}`} />
                            <StatTile icon={<IconGift size={20} color="#7C3AED" />} color="#7C3AED"
                                label="Total Bonus" value={loading ? '—' : `৳${((stats?.totalPerformanceBonus ?? 0) + (stats?.totalFestivalBonus ?? 0)).toLocaleString()}`} />
                            <StatTile icon={<IconTrendingUp size={20} color="#DC2626" />} color="#DC2626"
                                label="Total Loan" value={loading ? '—' : `৳${(stats?.totalLoan ?? 0).toLocaleString()}`} />
                            <StatTile icon={<IconWallet size={20} color="#D97706" />} color="#D97706"
                                label="Total Advance" value={loading ? '—' : `৳${(stats?.totalAdvance ?? 0).toLocaleString()}`} />
                            <StatTile icon={<IconAward size={20} color="#0D9488" />} color="#0D9488"
                                label="Total Performance Bonus" value={loading ? '—' : `৳${(stats?.totalPerformanceBonus ?? 0).toLocaleString()}`} />
                            <StatTile icon={<IconPartyPopper size={20} color="#DB2777" />} color="#DB2777"
                                label="Total Festival Bonus" value={loading ? '—' : `৳${(stats?.totalFestivalBonus ?? 0).toLocaleString()}`} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
