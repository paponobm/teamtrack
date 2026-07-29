'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { IconClock, IconCheckCircle } from '@/components/icons/Icons'
import { useLanguage } from '@/lib/LanguageContext'

interface AttendanceRecord {
    id: string
    date: string
    clock_in: string | null
    clock_out: string | null
    status: string
    notes: string | null
}

interface BreakRecord {
    id: string
    attendance_id: string
    start_time: string
    end_time: string | null
}

const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

export default function AttendanceHistory() {
    const { lang } = useLanguage()
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [breaks, setBreaks] = useState<BreakRecord[]>([])
    const [loading, setLoading] = useState(true)

    const [now, setNow] = useState(Date.now())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000)
        return () => clearInterval(interval)
    }, [])

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/attendance/me/history?month=${month}&year=${year}`)
            if (res.ok) {
                const data = await res.json()
                setRecords(data.records || [])
                setBreaks(data.breaks || [])
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [month, year])

    useEffect(() => { fetchData() }, [fetchData])

    const formatTimeOnly = (ts: string | null) => {
        if (!ts) return '--:--'
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    const formatDuration = (ms: number) => {
        if (ms < 0) ms = 0
        const hrs = Math.floor(ms / 3600000)
        const mins = Math.floor((ms % 3600000) / 60000)
        return `${hrs}h ${mins}m`
    }

    // Process aggregated data
    let totalMonthNetMs = 0
    let totalMonthBreakMs = 0
    let daysPresent = 0

    const dailyData = records.map(record => {
        const hasClockedIn = !!record.clock_in
        const hasClockedOut = !!record.clock_out

        let totalMs = 0
        if (hasClockedIn) {
            const start = new Date(record.clock_in!).getTime()
            const end = hasClockedOut ? new Date(record.clock_out!).getTime() : now
            totalMs = Math.max(0, end - start)
        }

        const dayBreaks = breaks.filter(b => b.attendance_id === record.id)
        let breakMs = 0
        dayBreaks.forEach(b => {
            const start = new Date(b.start_time).getTime()
            const end = b.end_time ? new Date(b.end_time).getTime() : now
            breakMs += Math.max(0, end - start)
        })

        const netMs = Math.max(0, totalMs - breakMs)

        if (hasClockedIn) {
            totalMonthNetMs += netMs
            totalMonthBreakMs += breakMs
            daysPresent++
        }

        return {
            ...record,
            totalMs,
            breakMs,
            netMs,
            dayBreaks
        }
    })

    return (
        <motion.div variants={item} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select className="input" value={month} onChange={(e) => setMonth(parseInt(e.target.value))} style={{ width: '140px' }}>
                        {Array.from({ length: 12 }).map((_, i) => {
                            const d = new Date(2000, i, 1)
                            return <option key={i} value={i + 1}>{d.toLocaleString('en-US', { month: 'long' })}</option>
                        })}
                    </select>
                    <select className="input" value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={{ width: '100px' }}>
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>Total Net Hours</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2563EB' }}>{formatDuration(totalMonthNetMs)}</div>
                </div>
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>Total Break Time</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B' }}>{formatDuration(totalMonthBreakMs)}</div>
                </div>
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>Days Present</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10B981' }}>{daysPresent} <span style={{ fontSize: '1rem', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>days</span></div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Check In</th>
                                <th>Check Out</th>
                                <th>Breaks</th>
                                <th>Break Time</th>
                                <th>Net Hours</th>
                                <th>Status</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>Loading history...</td>
                                </tr>
                            ) : dailyData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-tertiary)' }}>No records found for this month</td>
                                </tr>
                            ) : (
                                dailyData.map(d => {
                                    const dateStr = new Date(d.date + 'T00:00:00').toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                    return (
                                        <tr key={d.id}>
                                            <td style={{ fontWeight: 500 }}>{dateStr}</td>
                                            <td>{formatTimeOnly(d.clock_in)}</td>
                                            <td>{formatTimeOnly(d.clock_out)}</td>
                                            <td>{d.dayBreaks.length} break(s)</td>
                                            <td style={{ color: '#F59E0B' }}>{d.breakMs > 0 ? formatDuration(d.breakMs) : '--'}</td>
                                            <td style={{ fontWeight: 600, color: '#2563EB' }}>{formatDuration(d.netMs)}</td>
                                            <td>
                                                <span className={`badge ${d.status === 'present' ? 'badge-success' : d.status === 'leave' ? 'badge-warning' : 'badge-danger'}`}>
                                                    {d.status}
                                                </span>
                                            </td>
                                            {/* <td style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8125rem', maxWidth: '180px' }}> */}
                                            <td style={{ color: '#f51b0b', fontSize: '0.8125rem', maxWidth: '180px' }}>
                                                <span className="truncate" style={{ display: 'block' }}>{d.notes || '-'}</span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    )
}
