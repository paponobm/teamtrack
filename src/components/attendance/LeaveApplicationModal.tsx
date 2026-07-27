'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconCheckCircle } from '@/components/icons/Icons'
import Calendar from '@/components/ui/Calendar'

interface LeaveApplicationModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function LeaveApplicationModal({ isOpen, onClose, onSuccess }: LeaveApplicationModalProps) {
    const [startDate, setStartDate] = useState<Date | null>(null)
    const [endDate, setEndDate] = useState<Date | null>(null)
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        
        if (!startDate || !endDate || !reason) {
            setError('Please fill in all fields')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/leaves/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    startDate: startDate.toLocaleDateString('en-CA'), // YYYY-MM-DD
                    endDate: endDate.toLocaleDateString('en-CA'),
                    reason 
                })
            })
            
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Failed to submit application')
            } else {
                setStartDate(null)
                setEndDate(null)
                setReason('')
                onSuccess()
                onClose()
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Calculate days for UI feedback
    let daysDiff = 0
    if (startDate && endDate) {
        if (startDate <= endDate) {
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
            daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
                    <motion.div 
                        className="modal"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2 className="modal-title">Apply for Leave</h2>
                            <button className="btn btn-ghost btn-icon" onClick={onClose}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && (
                                    <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>
                                        {error}
                                    </div>
                                )}

                                <div style={{ marginBottom: '16px' }}>
                                    <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Select Date Range</label>
                                    <Calendar 
                                        startDate={startDate} 
                                        endDate={endDate} 
                                        onChange={(start, end) => {
                                            setStartDate(start)
                                            setEndDate(end)
                                        }}
                                        maxDays={3}
                                    />
                                </div>
                                
                                {daysDiff > 0 && (
                                    <div style={{ fontSize: '0.875rem', color: daysDiff > 3 ? '#DC2626' : '#10B981', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <IconCheckCircle size={16} color={daysDiff > 3 ? '#DC2626' : '#10B981'} />
                                        {daysDiff} day(s) selected {daysDiff > 3 && '(Maximum 3 days allowed)'}
                                    </div>
                                )}

                                <div className="input-group">
                                    <label className="input-label">Reason</label>
                                    <textarea 
                                        className="input" 
                                        rows={4} 
                                        placeholder="Please provide a brief reason for your leave..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        required
                                        style={{ resize: 'none' }}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading || daysDiff > 3 || daysDiff < 1}>
                                    {loading ? (
                                        <>
                                            <div className="spinner" style={{ width: '14px', height: '14px' }} />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit Application'
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
