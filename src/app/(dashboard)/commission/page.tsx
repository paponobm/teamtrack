'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import {
    IconDownload, IconChevronLeft, IconChevronRight, IconTrophy, IconAward,
    IconStar, IconCheckCircle, IconClock
} from '@/components/icons/Icons'

interface PointsBreakdown {
    id: string; name: string; employeeId: string; department: string
    orders: number; delivered: number; problemPoints: number; presentDays: number
    orderPoints: number; attendancePoints: number
    totalPoints: number
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

export default function PointsPage() {
    const { lang } = useLanguage()
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
    const [pointsData, setPointsData] = useState<PointsBreakdown[]>([])
    const [rates, setRates] = useState({ POINT_VALUE: 1, ORDER_BONUS: 2, ATTENDANCE_BONUS: 1 })
    const [grandTotal, setGrandTotal] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetch(`/api/reports/commission?month=${month}`)
            .then(r => r.json())
            .then(data => {
                // Map the API data to points-only (no money)
                const mapped = (data.commissions || []).map((c: {
                    id: string; name: string; employeeId: string; department: string
                    orders: number; delivered: number; points: number; presentDays: number
                    orderCommission: number; pointCommission: number; attendanceCommission: number
                    totalCommission: number
                }) => ({
                    id: c.id,
                    name: c.name,
                    employeeId: c.employeeId,
                    department: c.department,
                    orders: c.orders,
                    delivered: c.delivered,
                    problemPoints: c.points,
                    presentDays: c.presentDays,
                    orderPoints: c.delivered * (data.rates?.ORDER_BONUS || 2),
                    attendancePoints: c.presentDays * (data.rates?.ATTENDANCE_BONUS || 1),
                    totalPoints: c.points + (c.delivered * (data.rates?.ORDER_BONUS || 2)) + (c.presentDays * (data.rates?.ATTENDANCE_BONUS || 1)),
                }))
                setPointsData(mapped)
                setRates(data.rates || rates)
                setGrandTotal(mapped.reduce((sum: number, c: PointsBreakdown) => sum + c.totalPoints, 0))
                setLoading(false)
            })
            .catch(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month])

    const prevMonth = () => { const d = new Date(month + '-01'); d.setMonth(d.getMonth() - 1); setMonth(d.toISOString().slice(0, 7)) }
    const nextMonth = () => { const d = new Date(month + '-01'); d.setMonth(d.getMonth() + 1); setMonth(d.toISOString().slice(0, 7)) }
    const monthLabel = new Date(month + '-01').toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' })

    const handleExport = () => {
        const headers = ['Name', 'Department', 'Delivered', 'Problem Points', 'Present Days', 'Order Points', 'Attendance Points', 'Total Points']
        const rows = pointsData.map(c => [c.name, c.department, c.delivered, c.problemPoints, c.presentDays, c.orderPoints, c.attendancePoints, c.totalPoints])
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `points-${month}.csv`; a.click()
    }

    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']

    return (
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">{lang === 'bn' ? 'পয়েন্ট ক্যালকুলেশন' : 'Points Breakdown'}</h1>
                    <p className="page-subtitle">{lang === 'bn' ? 'পারফরম্যান্স পয়েন্ট হিসাব' : 'Performance-based points calculation'}</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <IconDownload size={14} /> CSV
                </button>
            </motion.div>

            {/* Month Nav */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
                <button className="btn btn-ghost btn-sm" onClick={prevMonth}><IconChevronLeft size={16} /></button>
                <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: '0.9375rem' }}>{monthLabel}</span>
                <button className="btn btn-ghost btn-sm" onClick={nextMonth}><IconChevronRight size={16} /></button>
            </motion.div>

            {/* Rate Info (points, not money) */}
            <motion.div variants={item} className="grid grid-3" style={{ marginBottom: '24px' }}>
                <div className="stat-card" style={{ borderLeft: '3px solid #2563EB' }}>
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconStar size={14} color="#2563EB" /> {lang === 'bn' ? 'প্রবলেম পয়েন্ট' : 'Problem Points'}</span>
                    <span className="stat-value">5 / 10 pts</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{lang === 'bn' ? 'পিক/সলভ প্রতি' : 'per pick / solve'}</span>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #3B82F6' }}>
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="#3B82F6" /> {lang === 'bn' ? 'অর্ডার পয়েন্ট' : 'Order Points'}</span>
                    <span className="stat-value">{rates.ORDER_BONUS} pts</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{lang === 'bn' ? 'প্রতি ডেলিভারি' : 'per delivered order'}</span>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #60A5FA' }}>
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="#60A5FA" /> {lang === 'bn' ? 'এটেনডেন্স পয়েন্ট' : 'Attendance Points'}</span>
                    <span className="stat-value">{rates.ATTENDANCE_BONUS} pts</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{lang === 'bn' ? 'প্রতি দিন' : 'per present day'}</span>
                </div>
            </motion.div>

            {/* Grand Total */}
            <motion.div variants={item} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)', borderRadius: '12px', border: '1px solid #FBBF2430' }}>
                    <span style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 600 }}>{lang === 'bn' ? 'গ্র্যান্ড টোটাল' : 'Total Points'}</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconTrophy size={20} color="#F59E0B" /> {grandTotal.toLocaleString()} pts
                    </div>
                </div>
            </motion.div>

            {/* Points Table */}
            <motion.div className="card" variants={item} style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>{lang === 'bn' ? 'নাম' : 'Name'}</th>
                                <th>{lang === 'bn' ? 'ডিপার্টমেন্ট' : 'Dept'}</th>
                                <th style={{ textAlign: 'right' }}>{lang === 'bn' ? 'ডেলিভারি' : 'Delivered'}</th>
                                <th style={{ textAlign: 'right' }}>{lang === 'bn' ? 'প্রবলেম পয়েন্ট' : 'Problem Pts'}</th>
                                <th style={{ textAlign: 'right' }}>{lang === 'bn' ? 'উপস্থিতি' : 'Present'}</th>
                                <th style={{ textAlign: 'right' }}>{lang === 'bn' ? 'অর্ডার পয়েন্ট' : 'Order Pts'}</th>
                                <th style={{ textAlign: 'right' }}>{lang === 'bn' ? 'এটেনডেন্স পয়েন্ট' : 'Attend Pts'}</th>
                                <th style={{ textAlign: 'right', fontWeight: 700 }}>{lang === 'bn' ? 'টোটাল' : 'Total Pts'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</td></tr>
                            ) : pointsData.length === 0 ? (
                                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>{lang === 'bn' ? 'কোন ডেটা নেই' : 'No data for this month'}</td></tr>
                            ) : pointsData.map((c, i) => (
                                <tr key={c.id}>
                                    <td>
                                        <span style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, background: i < 3 ? `${medalColors[i]}20` : 'var(--color-bg-secondary)', color: i < 3 ? medalColors[i] : 'var(--color-text-secondary)' }}>
                                            {i < 3 ? <IconAward size={14} color={medalColors[i]} /> : i + 1}
                                        </span>
                                    </td>
                                    <td><strong>{c.name}</strong></td>
                                    <td><span className="badge badge-neutral">{c.department}</span></td>
                                    <td style={{ textAlign: 'right' }}>{c.delivered}/{c.orders}</td>
                                    <td style={{ textAlign: 'right', color: '#2563EB', fontWeight: 600 }}>{c.problemPoints}</td>
                                    <td style={{ textAlign: 'right' }}>{c.presentDays}</td>
                                    <td style={{ textAlign: 'right', color: '#16A34A' }}>{c.orderPoints}</td>
                                    <td style={{ textAlign: 'right', color: '#CA8A04' }}>{c.attendancePoints}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9375rem', color: '#F59E0B' }}>{c.totalPoints} pts</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    )
}
