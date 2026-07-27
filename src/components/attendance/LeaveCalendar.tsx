'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LeaveRecord {
    id: string
    employee_id: string
    leave_date: string
    status: string
    employee: {
        id: string
        name: string
        avatar_url: string | null
        designation?: string
    } | null
}

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function LeaveCalendar({ records }: { records: LeaveRecord[] }) {
    // Only approved leaves count toward the calendar / leaderboard.
    const approved = useMemo(() => records.filter(r => r.status === 'approved' && r.leave_date), [records])

    const [cursor, setCursor] = useState(() => {
        const t = new Date()
        return { year: t.getFullYear(), month: t.getMonth() } // month 0-indexed
    })
    const [selectedDate, setSelectedDate] = useState<string | null>(null)

    const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`

    // Leaves that fall in the visible month.
    const monthLeaves = useMemo(() => approved.filter(r => r.leave_date.startsWith(monthPrefix)), [approved, monthPrefix])

    // Map day-of-month -> list of leave records.
    const byDay = useMemo(() => {
        const map: Record<number, LeaveRecord[]> = {}
        monthLeaves.forEach(r => {
            const day = parseInt(r.leave_date.slice(8, 10), 10)
            if (!map[day]) map[day] = []
            map[day].push(r)
        })
        return map
    }, [monthLeaves])

    // Leave summary: who took the most approved days this month.
    const leaveSummary = useMemo(() => {
        const tally: Record<string, { id: string; name: string; avatar_url: string | null; days: number }> = {}
        monthLeaves.forEach(r => {
            const name = r.employee?.name || 'Unknown'
            const eid = r.employee?.id || r.employee_id
            if (!tally[eid]) tally[eid] = { id: eid, name, avatar_url: r.employee?.avatar_url || null, days: 0 }
            tally[eid].days++
        })
        return Object.values(tally).sort((a, b) => b.days - a.days)
    }, [monthLeaves])

    const maxDays = leaveSummary[0]?.days || 0
    const totalDays = leaveSummary.reduce((acc, p) => acc + p.days, 0)
    
    const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const todayKey = localKey(new Date())

    const cells: (number | null)[] = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    const prevMonth = () => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })
    const nextMonth = () => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })
    const thisMonth = () => { const t = new Date(); setCursor({ year: t.getFullYear(), month: t.getMonth() }) }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)', gap: '20px', alignItems: 'start' }}>
            {/* Calendar */}
            <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ fontSize: '1.0625rem', fontWeight: 700 }}>{MONTHS[cursor.month]} {cursor.year}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={prevMonth} style={{ borderRadius: '8px' }} title="Previous month">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={thisMonth} style={{ fontSize: '0.75rem' }}>Today</button>
                        <button className="btn btn-ghost btn-icon" onClick={nextMonth} style={{ borderRadius: '8px' }} title="Next month">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {WEEKDAYS.map(w => (
                        <div key={w} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', padding: '4px 0' }}>{w}</div>
                    ))}
                    {cells.map((day, i) => {
                        if (day === null) return <div key={`empty-${i}`} />
                        const dayKey = `${monthPrefix}-${String(day).padStart(2, '0')}`
                        const leaves = byDay[day] || []
                        const isToday = dayKey === todayKey
                        return (
                            <div key={day} 
                                onClick={() => leaves.length > 0 ? setSelectedDate(dayKey) : null}
                                style={{
                                minHeight: '64px', borderRadius: '8px', padding: '4px',
                                border: isToday ? '1.5px solid #2563EB' : '1px solid var(--color-border-light)',
                                background: leaves.length ? 'rgba(124,58,237,0.05)' : 'var(--color-surface)',
                                display: 'flex', flexDirection: 'column', gap: '3px',
                                cursor: leaves.length ? 'pointer' : 'default',
                                transition: 'background 0.2s'
                            }}>
                                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: isToday ? '#2563EB' : 'var(--color-text-tertiary)' }}>{day}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {leaves.slice(0, 3).map(l => (
                                        <div key={l.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                            <div className="avatar" style={{ width: 20, height: 20, fontSize: '0.5625rem', background: getAvatarColor(l.employee?.name || '?'), overflow: 'hidden', flexShrink: 0 }}>
                                                {l.employee?.avatar_url
                                                    ? <img src={l.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : (l.employee?.name?.[0]?.toUpperCase() || '?')}
                                            </div>
                                            <span style={{ fontSize: '0.5rem', color: 'var(--color-text-tertiary)', lineHeight: 1, maxWidth: '32px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                {l.employee?.name?.split(' ')[0] || '?'}
                                            </span>
                                        </div>
                                    ))}
                                    {leaves.length > 3 && (
                                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-bg-secondary)', fontSize: '0.5625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>+{leaves.length - 3}</div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Leave Summary */}
            <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Leave Summary</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '14px' }}>
                    {MONTHS[cursor.month]} · {totalDays} day{totalDays === 1 ? '' : 's'} across {leaveSummary.length} member{leaveSummary.length === 1 ? '' : 's'}
                </div>
                {leaveSummary.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>No approved leaves this month</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {leaveSummary.map((p, i) => (
                            <motion.div key={p.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: 14, textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                                    {i + 1}.
                                </div>
                                <div className="avatar avatar-sm" style={{ background: getAvatarColor(p.name), overflow: 'hidden', flexShrink: 0 }}>
                                    {p.avatar_url
                                        ? <img src={p.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : (p.name[0]?.toUpperCase() || '?')}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                    <div style={{ height: 5, borderRadius: 3, background: 'var(--color-bg-secondary)', marginTop: '4px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${maxDays ? (p.days / maxDays) * 100 : 0}%`, background: 'var(--color-primary)', borderRadius: 3, transition: 'width 0.4s' }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', flexShrink: 0 }}>{p.days}<span style={{ fontSize: '0.625rem', fontWeight: 500, color: 'var(--color-text-tertiary)', marginLeft: '2px' }}>d</span></div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Popup Modal for selected date */}
            <AnimatePresence>
                {selectedDate && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDate(null)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} 
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            style={{ 
                                position: 'relative', 
                                background: 'var(--color-surface)', 
                                padding: '24px', 
                                borderRadius: '12px', 
                                width: '100%', 
                                maxWidth: '360px', 
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                zIndex: 1
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                                        {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                                        {byDay[parseInt(selectedDate.split('-')[2], 10)]?.length || 0} members on leave
                                    </p>
                                </div>
                                <button onClick={() => setSelectedDate(null)} className="btn btn-ghost btn-icon" style={{ padding: '8px' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
                                {byDay[parseInt(selectedDate.split('-')[2], 10)]?.map(l => (
                                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                        <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.875rem', background: getAvatarColor(l.employee?.name || '?'), overflow: 'hidden', flexShrink: 0 }}>
                                            {l.employee?.avatar_url
                                                ? <img src={l.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : (l.employee?.name?.[0]?.toUpperCase() || '?')}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{l.employee?.name}</div>
                                            {l.employee?.designation && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{l.employee.designation}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
