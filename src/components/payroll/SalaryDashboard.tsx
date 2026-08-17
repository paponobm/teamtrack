'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    IconUsers, IconWallet, IconCheckCircle, IconClock,
    IconBanknote, IconTrendingUp, IconAward, IconPartyPopper, IconLayers,
    IconTruck, IconPackage, IconBolt, IconAlertCircle,
} from '@/components/icons/Icons'

interface DashboardStats {
    sheetExists: boolean
    totalEmployees: number
    totalMonthExpense: number
    totalPayroll: number
    paidEmployees: number
    paidAmount: number
    unpaidEmployees: number
    unpaidAmount: number
    totalBasicSalary: number
    totalTransportationBill: number
    totalTransportationBillEmployees: number
    totalSnacksBill: number
    totalSnacksBillEmployees: number
    totalExtraDuty: number
    totalExtraDutyEmployees: number
    totalPerformanceBonus: number
    totalPerformanceBonusEmployees: number
    totalFestivalBonus: number
    totalFestivalBonusEmployees: number
    totalAdvance: number
    totalLoan: number
    totalProvidentFund: number
    totalProductBuy: number
    totalFine: number
}

// All-time running total, fetched once (see the load-once effect below) — independent of the
// selected Month filter, so switching months never re-triggers this expensive full-history scan.
interface SalaryExpenseStats {
    totalSalaryExpense: number
    salaryExpenseStartMonth: string | null
    salaryExpenseEndMonth: string | null
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function currentMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Short "Aug", "Sep", ... label used to prefix the per-field cards below, so it's clear at a
// glance which month's figures they reflect as the shared Month filter changes.
function monthAbbrev(month: string) {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

// "Aug - Sep" style range label for Total Salary Expense's all-time span — a single month
// collapses to just that one label instead of repeating it.
function monthRangeLabel(start: string | null, end: string | null) {
    if (!start || !end) return null
    return start === end ? monthAbbrev(start) : `${monthAbbrev(start)} - ${monthAbbrev(end)}`
}

// Icon-left "white section" stat tile — an icon badge on the left, label/value stacked on
// the right, reusing the shared .card surface so it matches the app's existing card styling.
// sub renders as plain text by default; subBadge switches it to a small colored pill (used for
// the employee-count sub on the per-field cards below).
function StatTile({ icon, label, value, sub, subColor, subBadge, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; subColor?: string; subBadge?: boolean; color: string }) {
    return (
        <motion.div variants={item} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color, lineHeight: 1.3 }}>{value}</div>
                {sub && (subBadge ? (
                    <span style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600, background: `${color}33`, color }}>
                        {sub}
                    </span>
                ) : (
                    <div style={{ fontSize: '0.6875rem', color: subColor ?? color, marginTop: '2px' }}>{sub}</div>
                ))}
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
    const [expenseStats, setExpenseStats] = useState<SalaryExpenseStats | null>(null)
    const [expenseLoading, setExpenseLoading] = useState(true)

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

    // Total Salary Expense is month-independent, so it's fetched once on mount from its own
    // endpoint rather than on every month switch — keeps it genuinely "fixed" instead of
    // re-running its expensive full-history scan (and blocking on it) each time the month changes.
    useEffect(() => {
        (async () => {
            setExpenseLoading(true)
            try {
                const res = await fetch('/api/payroll/dashboard/salary-expense')
                if (res.ok) setExpenseStats(await res.json())
            } finally {
                setExpenseLoading(false)
            }
        })()
    }, [])

    const mLabel = monthAbbrev(month)
    const v = (n: number | undefined) => loading ? '—' : `৳${(n ?? 0).toLocaleString()}`
    // These counts are Paid-only now (see /api/payroll/dashboard), so the badge says so.
    const employeeCount = (n: number | undefined) => `paid: ${n ?? 0}`

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
                        {/* Total Salary Expense (all-time, every Paid entry ever recorded — does
                            not change with the Month filter) / Total Employees / Paid Employees /
                            Unpaid Employees. */}
                        <motion.div variants={container} initial="hidden" animate="show"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                            <StatTile icon={<IconWallet size={20} color="#2563EB" />} color="#2563EB"
                                label="Total Salary Expense" value={expenseLoading ? '—' : `৳${(expenseStats?.totalSalaryExpense ?? 0).toLocaleString()}`}
                                sub={monthRangeLabel(expenseStats?.salaryExpenseStartMonth ?? null, expenseStats?.salaryExpenseEndMonth ?? null) ?? undefined} subColor="var(--color-text-tertiary)" />
                            <StatTile icon={<IconUsers size={20} color="#2563EB" />} color="#2563EB"
                                label="Total Employees" value={loading ? '—' : String(stats?.totalEmployees ?? 0)} />
                            <StatTile icon={<IconBanknote size={20} color="#7C3AED" />} color="#7C3AED"
                                label={`${mLabel} Salary Expense`} value={v(stats?.totalMonthExpense)}
                                 subColor="var(--color-text-tertiary)" />
                            <StatTile icon={<IconCheckCircle size={20} color="#16A34A" />} color="#16A34A"
                                label="Paid Employees" value={loading ? '—' : String(stats?.paidEmployees ?? 0)}
                                sub={`৳${(stats?.paidAmount ?? 0).toLocaleString()}`} />
                            <StatTile icon={<IconClock size={20} color="#DC2626" />} color="#DC2626"
                                label="Unpaid Employees" value={loading ? '—' : String(stats?.unpaidEmployees ?? 0)}
                                sub={`৳${(stats?.unpaidAmount ?? 0).toLocaleString()}`} />
                        </motion.div>

                        {/* Per-field earnings this month, each showing how many employees it
                            applies to (except Basic Salary, which every active employee has). */}
                        <motion.div variants={container} initial="hidden" animate="show"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '12px' }}>
                            <StatTile icon={<IconBanknote size={20} color="#2563EB" />} color="#2563EB"
                                label={`${mLabel} Basic Salary`} value={v(stats?.totalBasicSalary)} />
                            <StatTile icon={<IconTruck size={20} color="#2563EB" />} color="#2563EB"
                                label={`${mLabel} Transportation Bill`} value={v(stats?.totalTransportationBill)}
                                sub={employeeCount(stats?.totalTransportationBillEmployees)} subBadge />
                            <StatTile icon={<IconPackage size={20} color="#2563EB" />} color="#2563EB"
                                label={`${mLabel} Snacks Bill`} value={v(stats?.totalSnacksBill)}
                                sub={employeeCount(stats?.totalSnacksBillEmployees)} subBadge />
                            <StatTile icon={<IconPartyPopper size={20} color="#DB2777" />} color="#DB2777"
                                label={`${mLabel} Festival Bonus`} value={v(stats?.totalFestivalBonus)}
                                sub={employeeCount(stats?.totalFestivalBonusEmployees)} subBadge />
                            <StatTile icon={<IconBolt size={20} color="#D97706" />} color="#D97706"
                                label={`${mLabel} Extra Duty`} value={v(stats?.totalExtraDuty)}
                                sub={employeeCount(stats?.totalExtraDutyEmployees)} subBadge />
                            <StatTile icon={<IconAward size={20} color="#0D9488" />} color="#0D9488"
                                label={`${mLabel} Performance Bonus`} value={v(stats?.totalPerformanceBonus)}
                                sub={employeeCount(stats?.totalPerformanceBonusEmployees)} subBadge />
                        </motion.div>

                        {/* Per-field deductions this month. */}
                        <motion.div variants={container} initial="hidden" animate="show"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '12px' }}>
                            <StatTile icon={<IconWallet size={20} color="#DC2626" />} color="#DC2626"
                                label={`${mLabel} Salary Advance`} value={v(stats?.totalAdvance)} />
                            <StatTile icon={<IconTrendingUp size={20} color="#DC2626" />} color="#DC2626"
                                label={`${mLabel} Loan`} value={v(stats?.totalLoan)} />
                            <StatTile icon={<IconLayers size={20} color="#DC2626" />} color="#DC2626"
                                label={`${mLabel} Provident Fund`} value={v(stats?.totalProvidentFund)} />
                            <StatTile icon={<IconPackage size={20} color="#DC2626" />} color="#DC2626"
                                label={`${mLabel} Product Buy`} value={v(stats?.totalProductBuy)} />
                            <StatTile icon={<IconAlertCircle size={20} color="#DC2626" />} color="#DC2626"
                                label={`${mLabel} Monthly Fine`} value={v(stats?.totalFine)} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
