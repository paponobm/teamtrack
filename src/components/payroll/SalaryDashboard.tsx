'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    IconUsers, IconWallet, IconCheckCircle, IconClock,
    IconBanknote, IconTrendingUp, IconAward, IconPartyPopper, IconLayers,
    IconTruck, IconPackage, IconBolt, IconAlertCircle,
} from '@/components/icons/Icons'

interface DashboardStats {
    sheetCount: number
    totalEmployees: number
    totalSalaryExpense: number
    totalMonthExpense: number
    paidEmployees: number
    paidAmount: number
    unpaidEmployees: number
    unpaidAmount: number
    totalBasicSalary: number
    totalBasicSalaryPaid: number
    totalBasicSalaryUnpaid: number
    totalTransportationBill: number
    totalTransportationBillPaid: number
    totalTransportationBillUnpaid: number
    totalSnacksBill: number
    totalSnacksBillPaid: number
    totalSnacksBillUnpaid: number
    totalExtraDuty: number
    totalExtraDutyPaid: number
    totalExtraDutyUnpaid: number
    totalPerformanceBonus: number
    totalPerformanceBonusPaid: number
    totalPerformanceBonusUnpaid: number
    totalFestivalBonus: number
    totalFestivalBonusPaid: number
    totalFestivalBonusUnpaid: number
    totalAdvance: number
    totalLoan: number
    totalProvidentFund: number
    totalProductBuy: number
    totalFine: number
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function currentMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// "Aug 2026" style label for a single month — used for the selected range's sub-label under
// Total Salary Expense, so it's clear at a glance which range the cards below reflect.
function formatMonthShort(month: string) {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function rangeLabel(from: string, to: string) {
    return from === to ? formatMonthShort(from) : `${formatMonthShort(from)} - ${formatMonthShort(to)}`
}

// Icon-left "white section" stat tile — an icon badge on the left, label/value stacked on
// the right, reusing the shared .card surface so it matches the app's existing card styling.
// sub renders as plain text by default; subBadge switches it to a single small colored pill.
// badges renders instead as several separately-colored pills side by side (used for the
// Paid/Unpaid split on the per-field cards below, where each half needs its own color).
function StatTile({ icon, label, value, sub, subColor, subBadge, badges, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; subColor?: string; subBadge?: boolean; badges?: { text: string; color: string }[]; color: string }) {
    return (
        <motion.div variants={item} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color, lineHeight: 1.3 }}>{value}</div>
                {badges ? (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {badges.map((b, i) => (
                            <span key={i} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600, background: `${b.color}33`, color: b.color }}>
                                {b.text}
                            </span>
                        ))}
                    </div>
                ) : sub && (subBadge ? (
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

// month seeds the initial From/To range (both default to it) but is otherwise independent of
// it from then on — this range filter is its own, separate control from the Salary Sheet
// table's single Month filter below, per its own From Month/To Month selectors here.
export default function SalaryDashboard({ month = currentMonth() }: { month?: string }) {
    const [fromMonth, setFromMonth] = useState(month)
    const [toMonth, setToMonth] = useState(month)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(true)

    const rangeInvalid = fromMonth > toMonth

    const load = useCallback(async (from: string, to: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/payroll/dashboard/range?from=${from}&to=${to}`)
            if (res.ok) setStats(await res.json())
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (rangeInvalid) return
        load(fromMonth, toMonth)
    }, [fromMonth, toMonth, rangeInvalid, load])

    // While the range is invalid, the last-fetched stats are stale for the (now nonsensical)
    // selection — cards fall back to the loading dash instead of showing them.
    const dash = loading || rangeInvalid
    const v = (n: number | undefined) => dash ? '—' : `৳${(n ?? 0).toLocaleString()}`
    // Basic Salary/Transportation Bill/Snacks Bill/Festival Bonus/Extra Duty/Performance Bonus
    // total both Paid and Unpaid entries now, so each card shows two separately-colored badges
    // instead of one combined pill — Paid keeps that card's own accent color, Unpaid is always
    // yellow so it reads as "still owed" consistently across every card.
    const paidUnpaidBadges = (paidColor: string, paid: number | undefined, unpaid: number | undefined) => [
        { text: `Paid: ${paid ?? 0}`, color: paidColor },
        { text: `Unpaid: ${unpaid ?? 0}`, color: '#F59E0B' },
    ]

    // Total Salary Expense is the sum of gross earnings (Basic Salary + Transportation Bill +
    // Snacks Bill + Festival Bonus + Extra Duty + Performance Bonus) across the range — the same
    // six fields the per-field cards below already total, just added together — not the net
    // payable (earnings minus deductions) figure used elsewhere.
    const totalEarning = (stats?.totalBasicSalary ?? 0) + (stats?.totalTransportationBill ?? 0)
        + (stats?.totalSnacksBill ?? 0) + (stats?.totalFestivalBonus ?? 0)
        + (stats?.totalExtraDuty ?? 0) + (stats?.totalPerformanceBonus ?? 0)

    return (
        <div>
            {!loading && !rangeInvalid && stats && stats.sheetCount === 0 && (
                <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    No salary sheets found in the selected range.
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Payroll Summary</div>
                    <button className="btn btn-ghost btn-icon" onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Independent from the Salary Sheet table's own Month filter below — this range
                    drives only the summary cards above, so it collapses/expands together with
                    them instead of staying pinned once there's nothing left for it to filter. */}
                {expanded && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>Range</span>
                        <input className="input" type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)}
                            aria-label="From month" style={{ padding: '6px 10px', fontSize: '0.8125rem', width: 'auto' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>to</span>
                        <input className="input" type="month" value={toMonth} onChange={e => setToMonth(e.target.value)}
                            aria-label="To month" style={{ padding: '6px 10px', fontSize: '0.8125rem', width: 'auto' }} />
                    </div>
                )}
            </div>

            {expanded && rangeInvalid && (
                <div style={{ marginBottom: '16px', fontSize: '0.8125rem', color: '#DC2626' }}>
                    From month must not be after To month.
                </div>
            )}

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        {/* Total Employees is the system's total active headcount — fixed,
                            unaffected by the From/To range. Total Salary Expense / Paid
                            Employees / Unpaid Employees are all combined (paid + unpaid) across
                            the selected range. */}
                        <motion.div variants={container} initial="hidden" animate="show"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                            <StatTile icon={<IconUsers size={20} color="#2563EB" />} color="#2564ebdc"
                                label="Total Employees" value={dash ? '—' : String(stats?.totalEmployees ?? 0)} />
                            <StatTile icon={<IconWallet size={20} color="#2563EB" />} color="#2563EB"
                                label="Total Salary Expense" value={dash ? '—' : `৳${totalEarning.toLocaleString()}`}
                                sub={!rangeInvalid ? rangeLabel(fromMonth, toMonth) : undefined} subColor="var(--color-text-tertiary)" />
                            <StatTile icon={<IconCheckCircle size={20} color="#16A34A" />} color="#16A34A"
                                label="Paid Employees" value={dash ? '—' : String(stats?.paidEmployees ?? 0)}
                                sub={`৳${(stats?.paidAmount ?? 0).toLocaleString()}`} />
                            <StatTile icon={<IconClock size={20} color="#DC2626" />} color="#DC2626"
                                label="Unpaid Employees" value={dash ? '—' : String(stats?.unpaidEmployees ?? 0)}
                                sub={`৳${(stats?.unpaidAmount ?? 0).toLocaleString()}`} />
                        </motion.div>

                        {/* Per-field earnings across the range — each totals both Paid and
                            Unpaid entries, with a badge breaking that total down by status. */}
                        <motion.div variants={container} initial="hidden" animate="show"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '12px' }}>
                            <StatTile icon={<IconBanknote size={20} color="#2563EB" />} color="#2563EB"
                                label="Basic Salary" value={v(stats?.totalBasicSalary)}
                                badges={paidUnpaidBadges('#2563EB', stats?.totalBasicSalaryPaid, stats?.totalBasicSalaryUnpaid)} />
                            <StatTile icon={<IconTruck size={20} color="#2563EB" />} color="#2563EB"
                                label="Transportation Bill" value={v(stats?.totalTransportationBill)}
                                badges={paidUnpaidBadges('#2563EB', stats?.totalTransportationBillPaid, stats?.totalTransportationBillUnpaid)} />
                            <StatTile icon={<IconPackage size={20} color="#2563EB" />} color="#2563EB"
                                label="Snacks Bill" value={v(stats?.totalSnacksBill)}
                                badges={paidUnpaidBadges('#2563EB', stats?.totalSnacksBillPaid, stats?.totalSnacksBillUnpaid)} />
                            <StatTile icon={<IconPartyPopper size={20} color="#DB2777" />} color="#DB2777"
                                label="Festival Bonus" value={v(stats?.totalFestivalBonus)}
                                badges={paidUnpaidBadges('#DB2777', stats?.totalFestivalBonusPaid, stats?.totalFestivalBonusUnpaid)} />
                            <StatTile icon={<IconBolt size={20} color="#D97706" />} color="#D97706"
                                label="Extra Duty" value={v(stats?.totalExtraDuty)}
                                badges={paidUnpaidBadges('#D97706', stats?.totalExtraDutyPaid, stats?.totalExtraDutyUnpaid)} />
                            <StatTile icon={<IconAward size={20} color="#0D9488" />} color="#0D9488"
                                label="Performance Bonus" value={v(stats?.totalPerformanceBonus)}
                                badges={paidUnpaidBadges('#0D9488', stats?.totalPerformanceBonusPaid, stats?.totalPerformanceBonusUnpaid)} />
                        </motion.div>

                        {/* Per-field deductions across the range. */}
                        <motion.div variants={container} initial="hidden" animate="show"
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '12px' }}>
                            <StatTile icon={<IconWallet size={20} color="#DC2626" />} color="#DC2626"
                                label="Salary Advance" value={v(stats?.totalAdvance)} />
                            <StatTile icon={<IconTrendingUp size={20} color="#DC2626" />} color="#DC2626"
                                label="Loan" value={v(stats?.totalLoan)} />
                            <StatTile icon={<IconLayers size={20} color="#DC2626" />} color="#DC2626"
                                label="Provident Fund" value={v(stats?.totalProvidentFund)} />
                            <StatTile icon={<IconPackage size={20} color="#DC2626" />} color="#DC2626"
                                label="Product Buy" value={v(stats?.totalProductBuy)} />
                            <StatTile icon={<IconAlertCircle size={20} color="#DC2626" />} color="#DC2626"
                                label="Monthly Fine" value={v(stats?.totalFine)} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
