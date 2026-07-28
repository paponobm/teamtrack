'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconClock, IconCheckCircle, IconPlay } from '@/components/icons/Icons'
import { useLanguage } from '@/lib/LanguageContext'

interface BreakRecord {
    id: string
    start_time: string
    end_time: string | null
}

interface SelfAttendanceData {
    id: string
    clock_in: string | null
    clock_out: string | null
    status: string
}

const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

export default function SelfAttendance() {
    const { lang } = useLanguage()
    const [record, setRecord] = useState<SelfAttendanceData | null>(null)
    const [breaks, setBreaks] = useState<BreakRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [now, setNow] = useState(Date.now())
    const [date] = useState(() => new Date().toISOString().split('T')[0])
    const [dutyStartTime, setDutyStartTime] = useState<string | null>(null)

    // Update the 'now' timer every second to keep live counters ticking
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [])

    // Fetch the employee's duty start time so we can flag lateness before clock-in too
    useEffect(() => {
        fetch('/api/members/me').then(r => r.json()).then(d => setDutyStartTime(d?.duty_start_time || null)).catch(() => { })
    }, [])

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/attendance/me?date=${date}`)
            if (res.ok) {
                const data = await res.json()
                setRecord(data.record)
                setBreaks(data.breaks || [])
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [date])

    useEffect(() => { fetchData() }, [fetchData])

    const handleAction = async (action: 'clock_in' | 'clock_out' | 'start_break' | 'end_break') => {
        setActionLoading(true)
        try {
            const res = await fetch('/api/attendance/me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, date })
            })
            if (res.ok) {
                const data = await res.json()
                setRecord(data.record)
                setBreaks(data.breaks || [])
            }
        } catch { /* ignore */ }
        finally { setActionLoading(false) }
    }

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

    const formatBreakDuration = (ms: number) => {
        if (ms < 0) ms = 0
        const totalSeconds = Math.floor(ms / 1000)
        const hrs = Math.floor(totalSeconds / 3600)
        const mins = Math.floor((totalSeconds % 3600) / 60)
        const secs = totalSeconds % 60
        
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // Calculations
    const hasClockedIn = !!record?.clock_in
    const hasClockedOut = !!record?.clock_out
    const activeBreak = breaks.find(b => !b.end_time)

    let activeBreakMs = 0
    if (activeBreak) {
        activeBreakMs = Math.max(0, now - new Date(activeBreak.start_time).getTime())
    }

    let totalMs = 0
    if (hasClockedIn) {
        const start = new Date(record.clock_in!).getTime()
        const end = hasClockedOut ? new Date(record.clock_out!).getTime() : now
        totalMs = Math.max(0, end - start)
    }

    let breakMs = 0
    breaks.forEach(b => {
        const start = new Date(b.start_time).getTime()
        const end = b.end_time ? new Date(b.end_time).getTime() : now
        breakMs += Math.max(0, end - start)
    })

    const netMs = Math.max(0, totalMs - breakMs)

    const isOnLeave = record?.status === 'leave'

    // Before clock-in, compare live against duty_start_time (fallback 09:00), mirroring
    // the same threshold /api/attendance/me applies once they do clock in: 15 min grace
    // shows "late", and 2+ hours with still no clock-in is treated as an on-leave/no-show day.
    let minutesLateBeforeClockIn = 0
    if (!hasClockedIn && !isOnLeave) {
        const startTime = dutyStartTime || '09:00:00'
        const [dutyH, dutyM] = startTime.split(':').map(Number)
        const shiftStart = new Date(`${date}T00:00:00`)
        shiftStart.setHours(dutyH, dutyM, 0, 0)
        minutesLateBeforeClockIn = (now - shiftStart.getTime()) / 60000
    }
    const isAutoLeave = minutesLateBeforeClockIn > 120
    const isLateBeforeClockIn = minutesLateBeforeClockIn > 15 && !isAutoLeave

    const isLate = record?.status === 'late' || isLateBeforeClockIn

    let currentStatus = 'Not Checked In'
    let statusColor = '#6B7280'
    let statusBg = 'rgba(107,114,128,0.08)'

    if (isOnLeave || isAutoLeave) {
        currentStatus = 'On Leave'
        statusColor = '#7C3AED'
        statusBg = 'rgba(124,58,237,0.08)'
    } else if (hasClockedIn) {
        if (hasClockedOut) {
            currentStatus = 'Clocked Out'
            statusColor = '#DC2626'
            statusBg = 'rgba(220,38,38,0.08)'
        } else if (activeBreak) {
            currentStatus = 'On Break'
            statusColor = '#F59E0B'
            statusBg = 'rgba(245,158,11,0.08)'
        } else {
            currentStatus = 'Working'
            statusColor = '#10B981'
            statusBg = 'rgba(16,185,129,0.08)'
        }
    }

    const todayStr = new Date(date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    })

    if (loading) return null

    return (
        <motion.div variants={item} style={{ marginBottom: '32px' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header section inside card */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                            <IconClock size={16} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Attendance</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{todayStr}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isLate && (
                            <span style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600, color: '#F59E0B', background: 'rgba(245,158,11,0.08)' }}>
                                You are late
                            </span>
                        )}
                        <span style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600, color: statusColor, background: statusBg }}>
                            {currentStatus}
                        </span>
                    </div>
                </div>

                {/* Main Action Area */}
                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Check In</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: hasClockedIn ? 'var(--color-text-primary)' : '#2563EB' }}>
                                {formatTimeOnly(record?.clock_in || null)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Check Out</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: hasClockedOut ? 'var(--color-text-primary)' : '#DC2626' }}>
                                {formatTimeOnly(record?.clock_out || null)}
                            </div>
                        </div>
                    </div>

                    {/* Break Animation Popup */}
                    <AnimatePresence>
                        {activeBreak && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                exit={{ opacity: 0 }}
                                style={{
                                    position: 'fixed',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.4)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '24px'
                                }}
                            >
                                <motion.div 
                                    initial={{ scale: 0.9, y: 20 }}
                                    animate={{ scale: 1, y: 0 }}
                                    exit={{ scale: 0.9, y: 20 }}
                                    style={{ 
                                        background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', 
                                        borderRadius: '24px', 
                                        padding: '48px 32px', 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid #FDE68A',
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                        maxWidth: '400px',
                                        width: '100%'
                                    }}
                                >
                                    <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', padding: '12px 24px', borderRadius: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Break Time</span>
                                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#92400E', fontVariantNumeric: 'tabular-nums' }}>
                                            {formatBreakDuration(activeBreakMs)}
                                        </span>
                                    </div>
                                    <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                                        <motion.svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="#D97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            {/* Steam (wavy and hot) */}
                                            <motion.path 
                                                d="M35 30 C30 20, 45 15, 40 5" 
                                                animate={{ 
                                                    d: ["M35 30 C30 20, 45 15, 40 5", "M35 30 C45 20, 30 15, 40 5", "M35 30 C30 20, 45 15, 40 5"],
                                                    opacity: [0.3, 0.8, 0.3],
                                                    y: [0, -5, 0]
                                                }} 
                                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} 
                                            />
                                            <motion.path 
                                                d="M50 30 C45 20, 60 15, 55 5" 
                                                animate={{ 
                                                    d: ["M50 30 C45 20, 60 15, 55 5", "M50 30 C60 20, 45 15, 55 5", "M50 30 C45 20, 60 15, 55 5"],
                                                    opacity: [0.3, 0.8, 0.3],
                                                    y: [0, -5, 0]
                                                }} 
                                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} 
                                            />
                                            <motion.path 
                                                d="M65 30 C60 20, 75 15, 70 5" 
                                                animate={{ 
                                                    d: ["M65 30 C60 20, 75 15, 70 5", "M65 30 C75 20, 60 15, 70 5", "M65 30 C60 20, 75 15, 70 5"],
                                                    opacity: [0.3, 0.8, 0.3],
                                                    y: [0, -5, 0]
                                                }} 
                                                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }} 
                                            />
                                            
                                            {/* Coffee Cup */}
                                            <motion.path 
                                                d="M20 35 Q50 45 80 35 L72 80 Q50 95 28 80 Z" 
                                                fill="#FDE68A"
                                            />
                                            <path d="M80 45 Q95 45 90 65 Q80 70 76 65" />
                                            {/* Hot Tea Liquid inside rim */}
                                            <ellipse cx="50" cy="35" rx="30" ry="10" fill="#92400E" stroke="none" />
                                            <ellipse cx="50" cy="35" rx="30" ry="10" stroke="#D97706" fill="none" />
                                            
                                            {/* Biscuit */}
                                            <motion.g animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                                                <circle cx="85" cy="85" r="14" fill="#F59E0B" />
                                                <circle cx="82" cy="82" r="1.5" fill="#B45309" stroke="none" />
                                                <circle cx="88" cy="84" r="1.5" fill="#B45309" stroke="none" />
                                                <circle cx="84" cy="89" r="1.5" fill="#B45309" stroke="none" />
                                                <circle cx="90" cy="88" r="1.5" fill="#B45309" stroke="none" />
                                                <circle cx="80" cy="86" r="1.5" fill="#B45309" stroke="none" />
                                            </motion.g>
                                        </motion.svg>
                                    </div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400E', marginTop: '24px', marginBottom: '12px' }}>You're on a break!</h3>
                                    <p style={{ color: '#B45309', fontSize: '1rem', textAlign: 'center', maxWidth: '300px', marginBottom: '32px', lineHeight: 1.5 }}>
                                        The tea is hot! Take your time, relax, and recharge. We'll be right here.
                                    </p>
                                    <button 
                                        className="btn" 
                                        style={{ padding: '16px 32px', fontSize: '1.0625rem', fontWeight: 700, background: '#D97706', color: '#FFF', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)', cursor: 'pointer' }}
                                        onClick={() => handleAction('end_break')} 
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Ending Break...' : 'End Break & Get to Work'}
                                    </button>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Progress Bar / Work Hours */}
                    <div style={{ background: 'rgba(118,118,128,0.05)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            <IconClock size={16} />
                            Work Hours
                        </div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{formatDuration(totalMs)}</div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {isOnLeave || isAutoLeave ? (
                            <div style={{ flex: 1, padding: '12px', fontSize: '0.9375rem', textAlign: 'center', borderRadius: '10px', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontWeight: 600 }}>
                                You are on leave today
                            </div>
                        ) : !hasClockedIn ? (
                            <button className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '0.9375rem' }}
                                onClick={() => handleAction('clock_in')} disabled={actionLoading}>
                                {actionLoading ? 'Clocking in...' : 'Clock In'}
                            </button>
                        ) : (
                            <>
                                {!hasClockedOut && (
                                    <>
                                        {activeBreak ? (
                                            <button className="btn" style={{ flex: 1, padding: '12px', fontSize: '0.9375rem', background: '#FFFBEB', color: '#B45309', border: '1px solid #FCD34D' }}
                                                onClick={() => handleAction('end_break')} disabled={actionLoading}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                    <IconPlay size={18} /> End Break
                                                </div>
                                            </button>
                                        ) : (
                                            <button className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '0.9375rem' }}
                                                onClick={() => handleAction('start_break')} disabled={actionLoading}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                    <IconClock size={18} /> Start Break
                                                </div>
                                            </button>
                                        )}
                                        <button className="btn" style={{ flex: 1, padding: '12px', fontSize: '0.9375rem', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                                            onClick={() => handleAction('clock_out')} disabled={actionLoading || !!activeBreak}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                Check Out
                                            </div>
                                        </button>
                                    </>
                                )}
                                {hasClockedOut && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }} 
                                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                                        style={{ 
                                            width: '100%', 
                                            padding: '24px', 
                                            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', 
                                            borderRadius: '16px', 
                                            border: '1px solid #BBF7D0', 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            gap: '12px' 
                                        }}
                                    >
                                        <motion.div 
                                            initial={{ rotate: 0 }} 
                                            animate={{ rotate: [0, 20, -10, 20, 0] }} 
                                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                                            style={{ fontSize: '3rem', transformOrigin: 'bottom right' }}
                                        >
                                            👋
                                        </motion.div>
                                        <div style={{ textAlign: 'center' }}>
                                            <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>Great job today!</h4>
                                            <p style={{ fontSize: '0.875rem', color: '#15803D' }}>Your shift has ended. See you next time!</p>
                                        </div>
                                    </motion.div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Summary Row */}
                {hasClockedIn && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', background: 'var(--color-border-light)', borderTop: '1px solid var(--color-border-light)' }}>
                        <div style={{ background: 'var(--color-surface)', padding: '16px 24px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Check-in Time <IconCheckCircle size={12} color="var(--color-text-tertiary)" />
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatTimeOnly(record?.clock_in || null)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>On time</div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', padding: '16px 24px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Total Hours
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatDuration(totalMs)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                                {hasClockedOut ? 'Shift ended' : 'Still working'}
                            </div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', padding: '16px 24px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Break Time
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatDuration(breakMs)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                                {breaks.length} break(s) taken
                            </div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', padding: '16px 24px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Net Work Hours
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563EB' }}>{formatDuration(netMs)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Total - Breaks</div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
