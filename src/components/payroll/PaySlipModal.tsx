'use client'

import { motion } from 'framer-motion'
import type { SalaryEntry } from './SalarySheet'
import { IconX, IconPrinter } from '@/components/icons/Icons'

interface PaySlipModalProps {
    entry: SalaryEntry
    month: string
    totalDays: number
    onClose: () => void
}

const PAYMENT_METHOD_COLORS: Record<string, string> = {
    'bKash': '#E2136E', 'Rocket': '#8C3494', 'Nagad': '#F7941D', 'Bank': '#2563EB', 'Cash': '#10B981',
}

// No company address/phone/logo is stored anywhere in the system yet — rather than invent
// business details that would print on a real payroll document, only the name (already used
// app-wide, e.g. src/app/layout.tsx metadata and the Settings page) is shown; the others are
// wired to render the moment that data exists.
const COMPANY = { name: 'Online Burmese Market', address: '', phone: '' }

function formatMonthLabel(month: string) {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PaySlipModal({ entry, month, totalDays, onClose }: PaySlipModalProps) {
    const totalEarnings = entry.basic_salary + entry.extra_duty + entry.transportation_bill + entry.snacks_bill
        + entry.performance_bonus + entry.festival_bonus
    const totalDeductions = entry.fine + entry.advance + entry.product_buy + entry.loan + entry.other_deduction
    const netPay = totalEarnings - totalDeductions

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                className="modal payslip-printable" style={{ maxWidth: '640px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                <div className="payslip-no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Pay Slip Preview</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                            <IconPrinter size={15} /> Print
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}><IconX size={18} /></button>
                    </div>
                </div>

                {/* Printable document — hardcoded to a light paper look regardless of app theme,
                    since this is a physical/downloadable document, not a themed UI panel. */}
                <div style={{ background: '#ffffff', color: '#111827', padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E5E7EB', paddingBottom: '16px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                                <rect width="48" height="48" rx="12" fill="url(#payslip-logo-gradient)" />
                                <path d="M14 20h20M14 28h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="33" cy="28" r="3" fill="white" />
                                <defs><linearGradient id="payslip-logo-gradient" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#1E40AF" /><stop offset="1" stopColor="#2563EB" /></linearGradient></defs>
                            </svg>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>{COMPANY.name}</div>
                                {COMPANY.address && <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{COMPANY.address}</div>}
                                {COMPANY.phone && <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Phone: {COMPANY.phone}</div>}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>Pay Slip</div>
                            <div style={{ fontSize: '0.8125rem', color: '#6B7280' }}>{formatMonthLabel(month)}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px', marginBottom: '20px', fontSize: '0.8125rem' }}>
                        <PayslipRow label="Employee ID" value={entry.employee.employee_id || '—'} />
                        <PayslipRow label="Total Working Days" value={String(totalDays)} />
                        <PayslipRow label="Employee Name" value={entry.employee.name} />
                        <PayslipRow label="Present Days" value={String(entry.attendance.present)} />
                        <PayslipRow label="Department" value={entry.employee.department || '—'} />
                        <PayslipRow label="Pay Date" value={formatDate(entry.payment_date)} />
                        <PayslipRow label="Joining Date" value={formatDate(entry.employee.joining_date)} />
                        <PayslipRow label="Payment Method" value={entry.payment_method || '—'} valueColor={entry.payment_method ? PAYMENT_METHOD_COLORS[entry.payment_method] : undefined} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '20px' }}>
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#111827', marginBottom: '10px' }}>Earnings</div>
                            <PayslipLine label="Basic Salary" value={entry.basic_salary} />
                            <PayslipLine label="Extra Duty" value={entry.extra_duty} />
                            <PayslipLine label="Transportation Bill" value={entry.transportation_bill} />
                            <PayslipLine label="Snacks Bill" value={entry.snacks_bill} />
                            <PayslipLine label="Performance Bonus" value={entry.performance_bonus} />
                            <PayslipLine label="Festival Bonus" value={entry.festival_bonus} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E5E7EB', fontWeight: 700 }}>
                                <span>Total Earnings</span>
                                <span style={{ color: '#16A34A' }}>৳{totalEarnings.toLocaleString()}</span>
                            </div>
                        </div>
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#111827', marginBottom: '10px' }}>Deductions</div>
                            <PayslipLine label="Advance" value={entry.advance} negative />
                            <PayslipLine label="Product Buy" value={entry.product_buy} negative />
                            <PayslipLine label="Loan" value={entry.loan} negative />
                            <PayslipLine label="Monthly Fine" value={entry.fine} negative />
                            <PayslipLine label="Other Deduction" value={entry.other_deduction} negative />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E5E7EB', fontWeight: 700 }}>
                                <span>Total Deductions</span>
                                <span style={{ color: '#DC2626' }}>৳{totalDeductions.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: '10px', background: 'rgba(22,163,74,0.08)' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>Net Pay / Net Payable</span>
                        <span style={{ fontWeight: 700, fontSize: '1.5rem', color: '#16A34A' }}>৳{netPay.toLocaleString()}</span>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

function PayslipRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6B7280' }}>{label}</span>
            <span style={{ fontWeight: 600, color: valueColor || '#111827' }}>{value}</span>
        </div>
    )
}

function PayslipLine({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', padding: '3px 0' }}>
            <span style={{ color: '#6B7280' }}>{label}</span>
            <span style={{ fontWeight: 600, color: negative && value > 0 ? '#DC2626' : '#111827' }}>৳{value.toLocaleString()}</span>
        </div>
    )
}
