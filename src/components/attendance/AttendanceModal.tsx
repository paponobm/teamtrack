'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Employee {
    id: string
    name: string
    employee_id: string
    department: { name: string } | null
}

interface AttendanceModalProps {
    onClose: () => void
    onSave: () => void
    date: string
    existingEmployeeIds: string[]
}

export default function AttendanceModal({ onClose, onSave, date, existingEmployeeIds }: AttendanceModalProps) {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [employeeId, setEmployeeId] = useState('')
    const [status, setStatus] = useState('present')
    const [clockIn, setClockIn] = useState('')
    const [notes, setNotes] = useState('')

    useEffect(() => {
        const fetchEmployees = async () => {
            const res = await fetch('/api/members?status=active')
            const data = await res.json()
            if (Array.isArray(data)) {
                // Filter out employees who already have attendance today
                const available = data.filter(
                    (emp: Employee) => !existingEmployeeIds.includes(emp.id)
                )
                setEmployees(available)
                if (available.length > 0) setEmployeeId(available[0].id)
            }
            setLoading(false)
        }
        fetchEmployees()
    }, [existingEmployeeIds])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!employeeId) return

        setSaving(true)

        const body: Record<string, unknown> = {
            employee_id: employeeId,
            date,
            status,
            notes: notes || null,
        }

        if (clockIn) {
            // Combine date + time into a proper timestamptz
            body.clock_in = `${date}T${clockIn}:00+06:00`
        }

        const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        setSaving(false)

        if (res.ok) {
            onSave()
        }
    }

    return (
        <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="modal"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2 className="modal-title">Mark Attendance</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                    Date: <strong>{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <div className="spinner" />
                    </div>
                ) : employees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)' }}>
                        <p>All active members already have attendance marked for this date.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="input-group">
                                <label className="input-label">Employee</label>
                                <select
                                    className="input"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    id="attendance-employee-select"
                                >
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} {emp.department ? `- ${emp.department.name}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Status</label>
                                <select
                                    className="input"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    id="attendance-status-select"
                                >
                                    <option value="present">Present</option>
                                    <option value="late">Late</option>
                                    <option value="absent">Absent</option>
                                    {/* <option value="half_day">Half Day</option> */}
                                    {/* <option value="leave">On Leave</option> */}
                                    {/* <option value="on_duty">On Duty</option> */}
                                </select>
                            </div>

                            {(status === 'present' || status === 'late' || status === 'half_day') && (
                                <div className="input-group">
                                    <label className="input-label">Clock In Time</label>
                                    <input
                                        type="time"
                                        className="input"
                                        value={clockIn}
                                        onChange={(e) => setClockIn(e.target.value)}
                                        id="attendance-clock-in"
                                    />
                                </div>
                            )}

                            <div className="input-group">
                                <label className="input-label">Notes (optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Any additional notes..."
                                    id="attendance-notes"
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving || !employeeId}
                                id="attendance-submit-btn"
                            >
                                {saving ? (
                                    <>
                                        <div className="spinner" style={{ width: '14px', height: '14px' }} />
                                        Saving...
                                    </>
                                ) : (
                                    'Mark Attendance'
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </motion.div>
        </motion.div>
    )
}
