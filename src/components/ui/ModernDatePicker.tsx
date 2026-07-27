'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function getCalendarDays(date: Date) {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const prevTotalDays = new Date(year, month, 0).getDate()
    const days: { day: number; monthOffset: number; dateString: string }[] = []
    
    // Padding from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = prevTotalDays - i
        const m = month === 0 ? 11 : month - 1
        const y = month === 0 ? year - 1 : year
        days.push({
            day: d,
            monthOffset: -1,
            dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        })
    }
    
    // Days of current month
    for (let i = 1; i <= totalDays; i++) {
        days.push({
            day: i,
            monthOffset: 0,
            dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        })
    }
    
    // Padding from next month
    const remainingCells = 42 - days.length
    for (let i = 1; i <= remainingCells; i++) {
        const m = month === 11 ? 0 : month + 1
        const y = month === 11 ? year + 1 : year
        days.push({
            day: i,
            monthOffset: 1,
            dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        })
    }
    return days
}

export default function ModernDatePicker({
    value,
    onChange,
    placeholder = 'Select date',
    disabled = false,
    direction = 'down'
}: {
    value: string
    onChange: (val: string) => void
    placeholder?: string
    disabled?: boolean
    direction?: 'up' | 'down'
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [viewDate, setViewDate] = useState(() => {
        return value ? new Date(value) : new Date()
    })

    const days = getCalendarDays(viewDate)
    const currentYear = viewDate.getFullYear()
    const currentMonth = viewDate.getMonth()

    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const monthName = monthNamesEn[currentMonth]

    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1))
    const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1))

    const handleSelectDay = (dateString: string) => {
        onChange(dateString)
        setIsOpen(false)
    }

    const handleClear = () => {
        onChange('')
        setIsOpen(false)
    }

    const handleToday = () => {
        const todayStr = new Date().toISOString().split('T')[0]
        onChange(todayStr)
        setIsOpen(false)
    }

    const getDisplayValue = () => {
        if (!value) return placeholder
        try {
            const dateObj = new Date(value)
            if (isNaN(dateObj.getTime())) return placeholder
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        } catch {
            return value
        }
    }

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '100%' }}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="form-input"
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', textAlign: 'left', background: 'var(--color-bg-elevated, var(--color-surface))',
                    cursor: disabled ? 'not-allowed' : 'pointer', userSelect: 'none',
                    width: '100%',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '10px',
                    height: '38px' // Consistent height
                }}
            >
                <span style={{ color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                    {getDisplayValue()}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
            </button>

            <AnimatePresence>
            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'transparent' }} onClick={() => setIsOpen(false)} />
                    <motion.div
                        initial={{ opacity: 0, y: direction === 'up' ? 5 : -5, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: direction === 'up' ? 5 : -5, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                            position: 'absolute', top: direction === 'up' ? 'auto' : '100%', bottom: direction === 'up' ? '100%' : 'auto', left: 0,
                            marginTop: direction === 'up' ? '0' : '8px', marginBottom: direction === 'up' ? '8px' : '0',
                            width: '280px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)',
                            borderRadius: '12px', boxShadow: 'var(--shadow-lg)', padding: '12px', zIndex: 1000, userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <button type="button" onClick={handlePrevMonth} className="btn btn-ghost btn-icon" style={{ padding: '4px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{monthName} {currentYear}</span>
                            <button type="button" onClick={handleNextMonth} className="btn btn-ghost btn-icon" style={{ padding: '4px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
                            {weekdays.map((day, idx) => (
                                <span key={idx} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{day}</span>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                            {days.map((item, idx) => {
                                const isSelected = item.dateString === value
                                const isCurrentMonth = item.monthOffset === 0
                                const todayStr = new Date().toISOString().split('T')[0]
                                const isToday = item.dateString === todayStr
                                return (
                                    <button key={idx} type="button" onClick={() => handleSelectDay(item.dateString)}
                                        style={{
                                            height: '32px', borderRadius: '50%', background: isSelected ? 'var(--color-primary)' : 'transparent',
                                            color: isSelected ? '#fff' : isCurrentMonth ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                            fontWeight: isSelected || isToday ? 600 : 400, fontSize: '0.8125rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: isToday && !isSelected ? '1px solid var(--color-primary)' : 'none',
                                            transition: 'all 0.15s ease', opacity: isCurrentMonth ? 1 : 0.5
                                        }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-secondary)' }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                                    >
                                        {item.day}
                                    </button>
                                )
                            })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', marginTop: '12px', paddingTop: '8px' }}>
                            <button type="button" onClick={handleClear} style={{ border: 'none', background: 'transparent', color: '#EF4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}>Clear</button>
                            <button type="button" onClick={handleToday} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}>Today</button>
                        </div>
                    </motion.div>
                </>
            )}
            </AnimatePresence>
        </div>
    )
}
