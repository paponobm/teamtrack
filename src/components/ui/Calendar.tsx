'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface CalendarProps {
    startDate: Date | null
    endDate: Date | null
    onChange: (start: Date | null, end: Date | null) => void
    maxDays?: number
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Calendar({ startDate, endDate, onChange, maxDays }: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = startDate || new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [direction, setDirection] = useState(0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const nextMonth = () => {
        setDirection(1)
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    const prevMonth = () => {
        setDirection(-1)
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    const { days, blanks } = useMemo(() => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        
        return {
            blanks: Array.from({ length: firstDay }, (_, i) => i),
            days: Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
        }
    }, [currentMonth])

    const handleDateClick = (date: Date) => {
        if (date < today) return // Disable past dates

        if (!startDate || (startDate && endDate) || date < startDate) {
            onChange(date, null)
        } else {
            // Check max days constraint
            const diffTime = Math.abs(date.getTime() - startDate.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
            
            if (maxDays && diffDays > maxDays) {
                // If they picked too far, just set it as the new start date
                onChange(date, null)
            } else {
                onChange(startDate, date)
            }
        }
    }

    // Compare by calendar day, not exact timestamp — robust even if a parent passes a
    // date parsed from an ISO string (UTC midnight) instead of a local-midnight Date.
    const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

    const isSelected = (date: Date) => {
        if (!startDate) return false
        if (!endDate) return sameDay(date, startDate)
        return date >= startDate && date <= endDate
    }

    const isStart = (date: Date) => startDate && sameDay(date, startDate)
    const isEnd = (date: Date) => endDate && sameDay(date, endDate)

    const variants = {
        enter: (dir: number) => ({ x: dir > 0 ? 20 : -20, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir < 0 ? 20 : -20, opacity: 0 })
    }

    return (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '16px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <button type="button" onClick={prevMonth} className="btn btn-ghost btn-icon" style={{ width: '32px', height: '32px', minHeight: '0' }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </div>
                <button type="button" onClick={nextMonth} className="btn btn-ghost btn-icon" style={{ width: '32px', height: '32px', minHeight: '0' }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
            </div>

            {/* Days of Week */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', columnGap: 0, marginBottom: '8px', textAlign: 'center' }}>
                {DAYS.map(day => (
                    <div key={day} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{day}</div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div style={{ position: 'relative', height: '240px' }}>
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={currentMonth.toISOString()}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', rowGap: '6px' }}>
                            {blanks.map(i => (
                                <div key={`blank-${i}`} />
                            ))}
                            {days.map(date => {
                                const disabled = date < today
                                const selected = isSelected(date)
                                const start = isStart(date)
                                const end = isEnd(date)
                                const inRange = selected && !start && !end

                                return (
                                    <button
                                        key={date.toISOString()}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => handleDateClick(date)}
                                        style={{
                                            height: '34px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.875rem',
                                            fontWeight: selected ? 600 : 500,
                                            border: 'none',
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                            color: disabled ? 'var(--color-text-tertiary)' : selected ? '#fff' : 'var(--color-text-primary)',
                                            background: selected ? '#2563EB' : 'transparent',
                                            borderRadius: '8px',
                                            opacity: disabled ? 0.3 : 1,
                                            position: 'relative',
                                            width: '100%'
                                        }}
                                        className={!disabled && !selected ? 'hover-bg' : ''}
                                    >
                                        <span style={{ zIndex: 2 }}>
                                            {date.getDate()}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
            <style jsx>{`
                .hover-bg:hover {
                    background: var(--color-bg-primary) !important;
                }
            `}</style>
        </div>
    )
}
