'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'

interface EmployeeReport {
    id: string; name: string; employeeId: string; department: string; avatar_url?: string | null
    totalOrders: number; totalAmount: number; delivered: number; cancelled: number
    deliveryRate: number; cancelRate: number; totalPoints: number
    attendanceRate: number; presentDays: number
    lifetimePoints?: number
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } } }

const getAvatarColor = (name: string) => {
    const colors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5', '#0D9488', '#E11D48', '#1D4ED8']
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
}

const medalIcons = ['🥇', '🥈', '🥉']

function ProgressBar({ value, color, bg }: { value: number; color: string; bg: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: bg, overflow: 'hidden' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(value, 100)}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    style={{ height: '100%', borderRadius: '3px', background: color }}
                />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color, minWidth: '32px', textAlign: 'right' }}>{value}%</span>
        </div>
    )
}

function getDeliveryColor(rate: number) {
    if (rate >= 80) return { color: '#16A34A', bg: 'rgba(22,163,74,0.1)' }
    if (rate >= 50) return { color: '#CA8A04', bg: 'rgba(202,138,4,0.1)' }
    return { color: '#DC2626', bg: 'rgba(220,38,38,0.1)' }
}

function getAttendanceColor(rate: number) {
    if (rate >= 80) return { color: '#0891B2', bg: 'rgba(8,145,178,0.1)' }
    if (rate >= 60) return { color: '#D97706', bg: 'rgba(217,119,6,0.1)' }
    return { color: '#DC2626', bg: 'rgba(220,38,38,0.1)' }
}

export default function ReportsPage() {
    const { lang } = useLanguage()
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
    const [report, setReport] = useState<EmployeeReport[]>([])
    const [totals, setTotals] = useState({ totalOrders: 0, totalAmount: 0, avgDeliveryRate: 0, avgAttendance: 0, totalPoints: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetch(`/api/reports/monthly?month=${month}`)
            .then(r => r.json())
            .then(data => {
                setReport(data.report || [])
                setTotals(data.teamTotals || { totalOrders: 0, totalAmount: 0, avgDeliveryRate: 0, avgAttendance: 0, totalPoints: 0 })
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [month])

    const prevMonth = () => {
        const d = new Date(month + '-01')
        d.setMonth(d.getMonth() - 1)
        setMonth(d.toISOString().slice(0, 7))
    }
    const nextMonth = () => {
        const d = new Date(month + '-01')
        d.setMonth(d.getMonth() + 1)
        setMonth(d.toISOString().slice(0, 7))
    }
    const monthLabel = new Date(month + '-01').toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' })

    const handleExport = () => {
        const headers = ['Name', 'Department', 'Orders', 'Amount', 'Delivered', 'Cancelled', 'Delivery%', 'Cancel%', 'Month Pts', 'Lifetime Pts', 'Attendance%', 'Present Days']
        const rows = report.map(r => [r.name, r.department, r.totalOrders, r.totalAmount, r.delivered, r.cancelled, r.deliveryRate + '%', r.cancelRate + '%', r.totalPoints, r.lifetimePoints || 0, r.attendanceRate + '%', r.presentDays])
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `report-${month}.csv`; a.click()
    }

    const teamPoints = report.reduce((s, r) => s + r.totalPoints, 0)

    const statCards = [
        {
            label: lang === 'bn' ? 'টোটাল অর্ডার' : 'Total Orders',
            value: totals.totalOrders,
            accent: '#2563EB',
            gradBg: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.02) 100%)',
            icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="#2563EB"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>,
        },
        {
            label: lang === 'bn' ? 'টোটাল এমাউন্ট' : 'Total Amount',
            value: `৳${totals.totalAmount.toLocaleString()}`,
            accent: '#059669',
            gradBg: 'linear-gradient(135deg, rgba(5,150,105,0.08) 0%, rgba(5,150,105,0.02) 100%)',
            icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="#059669"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>,
        },
        {
            label: lang === 'bn' ? 'গড় ডেলিভারি' : 'Avg Delivery',
            value: `${totals.avgDeliveryRate}%`,
            accent: '#D97706',
            gradBg: 'linear-gradient(135deg, rgba(217,119,6,0.08) 0%, rgba(217,119,6,0.02) 100%)',
            icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="#D97706"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm7 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M0 4a1 1 0 011-1h9a1 1 0 011 1v7h2V8a1 1 0 011-1h2.382l1.894 3.789A1 1 0 0118.618 11H18v3h-2a3 3 0 01-6 0H8a3 3 0 01-6 0H1a1 1 0 01-1-1V4z" /></svg>,
        },
        {
            label: lang === 'bn' ? 'গড় এটেনডেন্স' : 'Avg Attendance',
            value: `${totals.avgAttendance}%`,
            accent: '#0891B2',
            gradBg: 'linear-gradient(135deg, rgba(8,145,178,0.08) 0%, rgba(8,145,178,0.02) 100%)',
            icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="#0891B2"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>,
        },
        {
            label: lang === 'bn' ? 'টোটাল পয়েন্ট' : 'Total Points',
            value: teamPoints,
            accent: '#7C3AED',
            gradBg: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.02) 100%)',
            icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="#7C3AED"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.967.744L14.146 7.2 17.5 7.512a1 1 0 01.576 1.765l-2.552 2.19.785 3.297a1 1 0 01-1.506 1.094L12 13.783l-2.803 2.075a1 1 0 01-1.506-1.094l.785-3.297-2.552-2.19a1 1 0 01.576-1.765l3.354-.312 1.179-3.456A1 1 0 0112 2z" clipRule="evenodd" /></svg>,
        },
    ]

    const thStyle: React.CSSProperties = {
        padding: '14px 16px', fontWeight: 600, fontSize: '0.6875rem',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--color-border-light)',
        background: 'var(--color-bg-secondary)',
    }
    const tdStyle: React.CSSProperties = {
        padding: '14px 16px', fontSize: '0.8125rem',
        borderBottom: '1px solid var(--color-border-light)',
        whiteSpace: 'nowrap',
    }

    return (
        <motion.div variants={container} animate="show">
            {/* Header */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="page-title">{lang === 'bn' ? 'মান্থলি রিপোর্ট' : 'Monthly Reports'}</h1>
                    <p className="page-subtitle">{lang === 'bn' ? 'সকল মেম্বারের মাসিক পারফরম্যান্স' : 'Team performance overview by month'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Month Nav */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', background: 'rgba(118,118,128,0.08)', borderRadius: '10px' }}>
                        <button onClick={prevMonth} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all 0.15s' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <span style={{ padding: '6px 16px', fontWeight: 600, fontSize: '0.875rem', minWidth: '140px', textAlign: 'center' }}>{monthLabel}</span>
                        <button onClick={nextMonth} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all 0.15s' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleExport} style={{ gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        Export CSV
                    </button>
                </div>
            </motion.div>

            {/* Stat Cards */}
            <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '28px' }}>
                {statCards.map(card => (
                    <motion.div
                        key={card.label}
                        whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                        transition={{ duration: 0.2 }}
                        style={{
                            background: card.gradBg,
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '14px',
                            padding: '20px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: card.accent, borderRadius: '0 3px 3px 0' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${card.accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {card.icon}
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em' }}>{card.label}</span>
                        </div>
                        <div style={{ fontSize: '1.625rem', fontWeight: 700, color: card.accent, letterSpacing: '-0.03em', lineHeight: 1 }}>
                            {card.value}
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Table */}
            <motion.div variants={item} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, width: '48px', textAlign: 'center' }}>#</th>
                                <th style={{ ...thStyle, minWidth: '180px' }}>{lang === 'bn' ? 'নাম' : 'Employee'}</th>
                                <th style={thStyle}>{lang === 'bn' ? 'ডিপার্টমেন্ট' : 'Dept'}</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'bn' ? 'অর্ডার' : 'Orders'}</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'bn' ? 'এমাউন্ট' : 'Amount'}</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'bn' ? 'ডেলিভারি' : 'Delivered'}</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'bn' ? 'ক্যান্সেল' : 'Cancel'}</th>
                                <th style={{ ...thStyle, minWidth: '150px' }}>{lang === 'bn' ? 'ডেলিভারি রেট' : 'Delivery Rate'}</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'bn' ? 'পয়েন্ট' : 'Points'}</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>{lang === 'bn' ? 'লাইফটাইম' : 'Lifetime'}</th>
                                <th style={{ ...thStyle, minWidth: '140px' }}>{lang === 'bn' ? 'এটেনডেন্স' : 'Attendance'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td style={tdStyle}><div className="skeleton" style={{ width: 22, height: 22, borderRadius: '6px' }} /></td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                                                <div className="skeleton" style={{ width: 100, height: 14 }} />
                                            </div>
                                        </td>
                                        <td style={tdStyle}><div className="skeleton" style={{ width: 50, height: 20, borderRadius: '10px' }} /></td>
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <td key={j} style={tdStyle}><div className="skeleton" style={{ width: 40, height: 14, marginLeft: 'auto' }} /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : report.length === 0 ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '60px 24px' }}>
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.5 }}>
                                            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>{lang === 'bn' ? 'কোন ডেটা নেই' : 'No data for this month'}</div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{lang === 'bn' ? 'ভিন্ন মাস সিলেক্ট করুন' : 'Try selecting a different month'}</div>
                                    </td>
                                </tr>
                            ) : report.map((r, i) => {
                                const deliveryC = getDeliveryColor(r.deliveryRate)
                                const attendC = getAttendanceColor(r.attendanceRate)
                                return (
                                    <tr key={r.id}
                                        style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(118,118,128,0.02)', transition: 'background 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.03)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(118,118,128,0.02)')}
                                    >
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            {i < 3 ? (
                                                <span style={{ fontSize: '1.125rem', lineHeight: 1 }}>{medalIcons[i]}</span>
                                            ) : (
                                                <span style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 600, background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}>{i + 1}</span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: getAvatarColor(r.name),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)', overflow: 'hidden',
                                                }}>
                                                    {r.avatar_url ? (
                                                        <img src={r.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : r.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.3 }}>{r.name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ padding: '3px 10px', borderRadius: '8px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(37,99,235,0.06)', color: '#2563EB' }}>
                                                {r.department}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontSize: '0.875rem' }}>{r.totalOrders}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>৳{r.totalAmount.toLocaleString()}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: '#16A34A', fontWeight: 600 }}>{r.delivered}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: '#DC2626', fontWeight: 600 }}>{r.cancelled}</td>
                                        <td style={tdStyle}>
                                            <ProgressBar value={r.deliveryRate} color={deliveryC.color} bg={deliveryC.bg} />
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <span style={{ fontWeight: 700, color: '#2563EB', fontSize: '0.875rem' }}>{r.totalPoints}</span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <span style={{ fontWeight: 600, color: '#7C3AED', fontSize: '0.8125rem' }}>{r.lifetimePoints || r.totalPoints}</span>
                                        </td>
                                        <td style={tdStyle}>
                                            <ProgressBar value={r.attendanceRate} color={attendC.color} bg={attendC.bg} />
                                        </td>
                                    </tr>
                                )
                            })}
                            {/* Total Row */}
                            {report.length > 0 && (
                                <tr style={{ background: 'var(--color-bg-secondary)', borderTop: '2px solid var(--color-border-light)' }}>
                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'center' }} />
                                    <td style={{ ...tdStyle, borderBottom: 'none', fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.04em' }} colSpan={2}>
                                        {lang === 'bn' ? 'মোট' : 'TOTAL'}
                                    </td>
                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', fontWeight: 700, fontSize: '0.875rem' }}>{report.reduce((s, r) => s + r.totalOrders, 0)}</td>
                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>৳{report.reduce((s, r) => s + r.totalAmount, 0).toLocaleString()}</td>
                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>{report.reduce((s, r) => s + r.delivered, 0)}</td>
                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>{report.reduce((s, r) => s + r.cancelled, 0)}</td>
                                    <td style={{ ...tdStyle, borderBottom: 'none' }}>
                                        <ProgressBar value={totals.avgDeliveryRate} color={getDeliveryColor(totals.avgDeliveryRate).color} bg={getDeliveryColor(totals.avgDeliveryRate).bg} />
                                    </td>
                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', fontWeight: 700, color: '#2563EB', fontSize: '0.875rem' }}>{teamPoints}</td>
                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', fontWeight: 700, color: '#7C3AED' }}>{report.reduce((s, r) => s + (r.lifetimePoints || r.totalPoints), 0)}</td>
                                    <td style={{ ...tdStyle, borderBottom: 'none' }}>
                                        <ProgressBar value={totals.avgAttendance} color={getAttendanceColor(totals.avgAttendance).color} bg={getAttendanceColor(totals.avgAttendance).bg} />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Responsive override for stat cards */}
            <style jsx>{`
                @media (max-width: 900px) {
                    :global(.reports-stats-grid) {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                @media (max-width: 500px) {
                    :global(.reports-stats-grid) {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </motion.div>
    )
}
