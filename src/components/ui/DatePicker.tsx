'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface DatePickerProps {
    value: string
    onChange: (date: string) => void
    max?: string
    min?: string
    align?: 'left' | 'right'
}

export default function DatePicker({ value, onChange, max, min, align = 'left' }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date(value || new Date()))
    const containerRef = useRef<HTMLDivElement>(null)

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
    
    const days = []
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null) // Empty slots for previous month
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i)
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    
    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }
    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }
    const handleDateSelect = (day: number) => {
        const year = currentMonth.getFullYear()
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0')
        const dayStr = String(day).padStart(2, '0')
        const selectedDate = `${year}-${month}-${dayStr}`
        
        // Basic min/max validation
        if (max && selectedDate > max) return
        if (min && selectedDate < min) return
        
        onChange(selectedDate)
        setIsOpen(false)
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Select date'
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const todayStr = new Date().toISOString().split('T')[0]

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '6px 12px',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '10px',
                    background: 'var(--color-bg-primary)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                    minWidth: '135px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-text-tertiary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border-light)'}
            >
                {formatDate(value)}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: align === 'left' ? 0 : 'auto',
                            right: align === 'right' ? 0 : 'auto',
                            zIndex: 100,
                            background: 'var(--color-bg-primary)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '12px',
                            padding: '16px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                            width: '280px',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <button type="button" onClick={handlePrevMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: 'var(--color-text-secondary)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </span>
                            <button type="button" onClick={handleNextMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: 'var(--color-text-secondary)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(0,0,0,0.05)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>

                        {/* Days of week */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px', textAlign: 'center' }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <div key={day} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{day}</div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                            {days.map((day, idx) => {
                                if (!day) return <div key={`empty-${idx}`} />
                                
                                const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                const isSelected = value === dateStr
                                const isToday = todayStr === dateStr
                                const isDisabled = Boolean((max && dateStr > max) || (min && dateStr < min))

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        disabled={isDisabled}
                                        onClick={() => handleDateSelect(day)}
                                        style={{
                                            aspectRatio: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.8125rem',
                                            fontWeight: isSelected || isToday ? 600 : 400,
                                            color: isSelected ? '#fff' : isDisabled ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                                            background: isSelected ? 'var(--color-primary)' : isToday ? 'rgba(0,112,243,0.1)' : 'transparent',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            opacity: isDisabled ? 0.5 : 1,
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseOver={e => { if (!isSelected && !isDisabled) e.currentTarget.style.background = 'rgba(0,0,0,0.05)' }}
                                        onMouseOut={e => { if (!isSelected && !isDisabled) e.currentTarget.style.background = isToday ? 'rgba(0,112,243,0.1)' : 'transparent' }}
                                    >
                                        {day}
                                    </button>
                                )
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
