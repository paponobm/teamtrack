'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
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

export default function SalaryDashboard() {
    const [month, setMonth] = useState(currentMonth)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)

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
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Month</label>
                <input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.8125rem', width: 'auto' }} />
            </motion.div>

            {!loading && stats && !stats.sheetExists && (
                <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    No salary sheet has been created for this month yet. Go to the Salary Sheet tab to create one.
                </div>
            )}

            <motion.div variants={container} initial="hidden" animate="show"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconUsers size={14} color="var(--color-text-tertiary)" /> Total Employees</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{loading ? '—' : stats?.totalEmployees ?? 0}</span>
                </motion.div>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconWallet size={14} color="var(--color-text-tertiary)" /> Total Payroll</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{loading ? '—' : `৳${(stats?.totalPayroll ?? 0).toLocaleString()}`}</span>
                </motion.div>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="var(--color-text-tertiary)" /> Paid Employees</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>{loading ? '—' : stats?.paidEmployees ?? 0}</span>
                    <div style={{ fontSize: '0.6875rem', color: '#16A34A', marginTop: '4px' }}>৳{(stats?.paidAmount ?? 0).toLocaleString()}</div>
                </motion.div>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="var(--color-text-tertiary)" /> Unpaid Employees</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>{loading ? '—' : stats?.unpaidEmployees ?? 0}</span>
                    <div style={{ fontSize: '0.6875rem', color: '#DC2626', marginTop: '4px' }}>৳{(stats?.unpaidAmount ?? 0).toLocaleString()}</div>
                </motion.div>
            </motion.div>

            <motion.div variants={container} initial="hidden" animate="show"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconBanknote size={14} color="var(--color-text-tertiary)" /> Total Basic Salary</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{loading ? '—' : `৳${(stats?.totalBasicSalary ?? 0).toLocaleString()}`}</span>
                </motion.div>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconGift size={14} color="var(--color-text-tertiary)" /> Total Bonus</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#7C3AED' }}>{loading ? '—' : `৳${((stats?.totalPerformanceBonus ?? 0) + (stats?.totalFestivalBonus ?? 0)).toLocaleString()}`}</span>
                </motion.div>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconTrendingUp size={14} color="var(--color-text-tertiary)" /> Total Loan</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>{loading ? '—' : `৳${(stats?.totalLoan ?? 0).toLocaleString()}`}</span>
                </motion.div>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconWallet size={14} color="var(--color-text-tertiary)" /> Total Advance</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#D97706' }}>{loading ? '—' : `৳${(stats?.totalAdvance ?? 0).toLocaleString()}`}</span>
                </motion.div>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconAward size={14} color="var(--color-text-tertiary)" /> Total Performance Bonus</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#0D9488' }}>{loading ? '—' : `৳${(stats?.totalPerformanceBonus ?? 0).toLocaleString()}`}</span>
                </motion.div>
                <motion.div variants={item} className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconPartyPopper size={14} color="var(--color-text-tertiary)" /> Total Festival Bonus</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DB2777' }}>{loading ? '—' : `৳${(stats?.totalFestivalBonus ?? 0).toLocaleString()}`}</span>
                </motion.div>
            </motion.div>
        </div>
    )
}
