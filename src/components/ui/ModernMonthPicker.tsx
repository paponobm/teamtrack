'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ModernMonthPicker({
    value,
    onChange,
    placeholder = 'Select month',
    disabled = false,
    direction = 'down'
}: {
    value: string // Format: 'YYYY-MM'
    onChange: (val: string) => void
    placeholder?: string
    disabled?: boolean
    direction?: 'up' | 'down'
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [viewYear, setViewYear] = useState(() => {
        return value ? parseInt(value.split('-')[0]) : new Date().getFullYear()
    })

    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const fullMonthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    const handleSelectMonth = (monthIndex: number) => {
        const mm = String(monthIndex + 1).padStart(2, '0')
        onChange(`${viewYear}-${mm}`)
        setIsOpen(false)
    }

    const getDisplayValue = () => {
        if (!value) return placeholder
        try {
            const [y, m] = value.split('-')
            return `${fullMonthNamesEn[parseInt(m) - 1]} ${y}`
        } catch {
            return value
        }
    }

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '200px' }}>
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
                            width: '260px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)',
                            borderRadius: '12px', boxShadow: 'var(--shadow-lg)', padding: '16px', zIndex: 1000, userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <button type="button" onClick={() => setViewYear(y => y - 1)} className="btn btn-ghost btn-icon" style={{ padding: '4px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{viewYear}</span>
                            <button type="button" onClick={() => setViewYear(y => y + 1)} className="btn btn-ghost btn-icon" style={{ padding: '4px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            {monthNamesEn.map((month, idx) => {
                                const isSelected = value && value === `${viewYear}-${String(idx + 1).padStart(2, '0')}`
                                
                                return (
                                    <button key={idx} type="button" onClick={() => handleSelectMonth(idx)}
                                        style={{
                                            padding: '8px', borderRadius: '8px', background: isSelected ? 'var(--color-primary)' : 'transparent',
                                            color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                                            fontWeight: isSelected ? 600 : 500, fontSize: '0.875rem', cursor: 'pointer',
                                            border: 'none', transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-secondary)' }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                                    >
                                        {month}
                                    </button>
                                )
                            })}
                        </div>
                    </motion.div>
                </>
            )}
            </AnimatePresence>
        </div>
    )
}
