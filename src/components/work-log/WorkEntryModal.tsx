'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'

const PAYMENT_GATEWAYS = ['bKash', 'Rocket', 'Nagad', 'Bank', 'Cash']
const BUSINESS_NAMES = ['OBM BN', 'OBM EN', 'Adishad', 'PGM', 'Premium Shukti', 'Premium Achar']

interface WorkEntryModalProps {
    entry: {
        id: string
        customer_phone: string
        customer_name: string
        invoice_no: string
        courier_id: string
        source: string
        amount: number
        suggested_amount: number | null
        advance: number | null
        note: string
        order_type: string
        delivery_status: string
        payment_gateway: string | null
        business_name: string | null
        employee: { id: string } | null
    } | null
    date: string
    employees: { id: string; name: string; employee_id: string }[]
    currentUser: { employee_id: string; name: string; is_super: boolean } | null
    onClose: () => void
    onSave: () => void
}

// Required field star component
function RequiredStar() {
    return <span style={{ color: '#DC2626', marginLeft: '2px', fontSize: '0.875rem' }}>*</span>
}

export default function WorkEntryModal({ entry, date, employees, currentUser, onClose, onSave }: WorkEntryModalProps) {
    const isEdit = !!entry
    const isMember = currentUser && !currentUser.is_super

    const [form, setForm] = useState({
        employee_id: entry?.employee?.id || (isMember ? currentUser.employee_id : ''),
        customer_phone: entry?.customer_phone || '',
        customer_name: entry?.customer_name || '',
        invoice_no: entry?.invoice_no || '',
        courier_id: entry?.courier_id || '',
        source: entry?.source || '',
        amount: entry?.amount?.toString() || '',
        suggested_amount: entry?.suggested_amount?.toString() || '',
        advance: entry?.advance?.toString() || '',
        note: entry?.note || '',
        order_type: entry?.order_type || '',
        delivery_status: entry?.delivery_status || 'confirmed',
        payment_gateway: entry?.payment_gateway || '',
        business_name: entry?.business_name || '',
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const toast = useToast()

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const totalAmount = (parseFloat(form.amount) || 0) + (parseFloat(form.suggested_amount) || 0)
    const hasAdvance = parseFloat(form.advance) > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        // Validate required fields (#5)
        if (!form.employee_id) { setError('Please select a member'); setLoading(false); return }
        if (!form.customer_phone.trim()) { setError('Customer Phone is required'); setLoading(false); return }
        if (!form.customer_name.trim()) { setError('Customer Name is required'); setLoading(false); return }
        if (!form.source) { setError('Source is required'); setLoading(false); return }
        if (!form.amount || parseFloat(form.amount) <= 0) { setError('Base Amount is required'); setLoading(false); return }
        if (!form.order_type) { setError('Order Type is required'); setLoading(false); return }
        if (!form.delivery_status) { setError('Delivery Status is required'); setLoading(false); return }
        if (!form.business_name) { setError('Business / Page Name is required'); setLoading(false); return }

        // #6: If advance has value, payment gateway is required
        if (hasAdvance && !form.payment_gateway) {
            setError('Payment Gateway is required when Advance has a value')
            setLoading(false)
            return
        }

        try {
            const url = isEdit ? `/api/work-log/${entry.id}` : '/api/work-log'
            const method = isEdit ? 'PATCH' : 'POST'

            const body = {
                ...form,
                date,
                amount: parseFloat(form.amount) || 0,
                suggested_amount: form.suggested_amount ? parseFloat(form.suggested_amount) : null,
                advance: form.advance ? parseFloat(form.advance) : null,
                payment_gateway: form.payment_gateway || null,
                business_name: form.business_name || null,
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Something went wrong')
                setLoading(false)
                return
            }
            
            const data = await res.json()
            if (data.awardedPoints && data.awardedPoints > 0) {
                toast.success(`Awesome! You earned ${data.awardedPoints} points for this delivered order! 🌟`)
            }

            onSave()
        } catch {
            setError('Network error')
            setLoading(false)
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
                style={{ maxWidth: '580px' }}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'Edit Entry' : 'Add Work Entry'}</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Member + Source */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className="input-group">
                            <label className="input-label">Member<RequiredStar /></label>
                            {isMember ? (
                                <div style={{ padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                    {currentUser.name}
                                </div>
                            ) : (
                                <select className="input" name="employee_id" value={form.employee_id} onChange={handleChange} required>
                                    <option value="">Select member</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            )}
                        </div>
                        <div className="input-group">
                            <label className="input-label">Source<RequiredStar /></label>
                            <select className="input" name="source" value={form.source} onChange={handleChange}>
                                <option value="" disabled>Select source</option>
                                <option value="facebook">Facebook</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="web">Web</option>
                                <option value="instagram">Instagram</option>
                                <option value="tiktok">TikTok</option>
                                <option value="direct">Direct</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Customer Name + Phone */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className="input-group">
                            <label className="input-label">Customer Name<RequiredStar /></label>
                            <input className="input" name="customer_name" value={form.customer_name} onChange={handleChange} placeholder="Customer name..." />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Customer Phone<RequiredStar /></label>
                            <input className="input" name="customer_phone" value={form.customer_phone} onChange={handleChange} placeholder="01XXXXXXXXX" />
                        </div>
                    </div>



                    {/* Amount + Suggested + Total */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className="input-group">
                            <label className="input-label">Base Amount (৳)<RequiredStar /></label>
                            <input className="input" name="amount" type="number" step="0.01" value={form.amount} onChange={handleChange} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Suggested (৳)</label>
                            <input className="input" name="suggested_amount" type="number" step="0.01" value={form.suggested_amount} onChange={handleChange} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label className="input-label" style={{ color: '#2563EB', fontWeight: 600 }}>Total (৳)</label>
                            <div style={{
                                padding: '8px 12px',
                                background: 'rgba(37,99,235,0.06)',
                                border: '1px solid rgba(37,99,235,0.15)',
                                borderRadius: '8px',
                                fontSize: '0.9375rem',
                                fontWeight: 700,
                                color: '#2563EB',
                                textAlign: 'right',
                                fontFamily: 'monospace',
                            }}>
                                ৳{totalAmount.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Advance + Payment Gateway */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className="input-group">
                            <label className="input-label">Advance (৳)</label>
                            <input className="input" name="advance" type="number" step="0.01" value={form.advance} onChange={handleChange} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">
                                Payment Gateway
                                {hasAdvance && <RequiredStar />}
                            </label>
                            <select
                                className="input"
                                name="payment_gateway"
                                value={form.payment_gateway}
                                onChange={handleChange}
                                style={hasAdvance && !form.payment_gateway ? { borderColor: '#DC2626', background: 'rgba(220,38,38,0.04)' } : undefined}
                            >
                                <option value="">Select gateway</option>
                                {PAYMENT_GATEWAYS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            {hasAdvance && !form.payment_gateway && (
                                <div style={{ fontSize: '0.6875rem', color: '#DC2626', marginTop: '2px' }}>Required when advance has a value</div>
                            )}
                        </div>
                    </div>

                    {/* Business Name + Order Type + Delivery Status */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className="input-group">
                            <label className="input-label">Business / Page Name<RequiredStar /></label>
                            <select className="input" name="business_name" value={form.business_name} onChange={handleChange}>
                                <option value="">Select business</option>
                                {BUSINESS_NAMES.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Order Type<RequiredStar /></label>
                            <select className="input" name="order_type" value={form.order_type} onChange={handleChange}>
                                <option value="" disabled>Select order type</option>
                                <option value="normal">Normal</option>
                                <option value="suggested">Suggested</option>
                                <option value="2000_plus">2000+ Order</option>
                                <option value="3000_plus">3000+ Order</option>
                                <option value="5000_plus">5000+ Order</option>
                                <option value="upsell">Upsell</option>
                                <option value="incomplete">Incomplete Order</option>
                                <option value="exchange">Exchange</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Delivery Status<RequiredStar /></label>
                            <select className="input" name="delivery_status" value={form.delivery_status} onChange={handleChange}>
                                <option value="confirmed">Confirmed</option>
                                <option value="pending">Pending</option>
                                <option value="delivered">Delivered</option>
                                <option value="returned">Returned</option>
                                <option value="exchanged">Exchanged</option>
                                <option value="refunded">Refunded</option>
                                <option value="partial_refunded">Partial Refund</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Note */}
                    <div className="input-group" style={{ marginBottom: '20px' }}>
                        <label className="input-label">Note</label>
                        <input className="input" name="note" value={form.note} onChange={handleChange} placeholder="Optional note..." />
                    </div>

                    {error && (
                        <div style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '0.8125rem', background: '#FEE2E2', color: '#991B1B', marginBottom: '16px', border: '1px solid #FCA5A5' }}>
                            {error}
                        </div>
                    )}

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Entry'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    )
}
