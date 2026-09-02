'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'

const PAYMENT_GATEWAYS = ['bKash', 'Rocket', 'Nagad', 'Bank', 'Cash']
const BUSINESS_NAMES = ['OBM BN', 'OBM EN', 'Adishad', 'PGM', 'Premium Shukti', 'Premium Achar']
const ORDER_TYPES = [
    { key: 'normal', label: 'Normal' },
    { key: 'suggested', label: 'Suggested' },
    { key: '2000_plus', label: '2000+ Order' },
    { key: '3000_plus', label: '3000+ Order' },
    { key: '5000_plus', label: '5000+ Order' },
    { key: 'upsell', label: 'Upsell' },
    { key: 'incomplete', label: 'Incomplete Order' },
    { key: 'exchange', label: 'Exchange' },
]

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
        order_type: string[]
        delivery_status: string
        payment_gateway: string | null
        transaction_id: string | null
        business_name: string | null
        advance_verified?: boolean
        verified_at?: string | null
        verifier?: { id: string; name: string } | null
        employee: { id: string } | null
    } | null
    date: string
    employees: { id: string; name: string; employee_id: string }[]
    currentUser: { employee_id: string; name: string; is_super: boolean; role: string } | null
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
        order_type: entry?.order_type || [] as string[],
        delivery_status: entry?.delivery_status || 'confirmed',
        payment_gateway: entry?.payment_gateway || '',
        transaction_id: entry?.transaction_id || '',
        // Defaults to the primary business page for a brand-new entry — editing an existing
        // entry always keeps whatever it already has (even if that's blank).
        business_name: entry ? (entry.business_name || '') : 'OBM BN',
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const toast = useToast()

    // Advance payment verification — Admin/Super Admin/Manager only (Manager isn't
    // included in the page's own `isAdmin`, so this is checked separately here).
    const canVerifyAdvance = !!currentUser && (currentUser.is_super || ['Owner', 'Super Admin', 'Admin', 'Manager'].includes(currentUser.role))
    const [advanceVerified, setAdvanceVerified] = useState(entry?.advance_verified || false)
    const [verifiedInfo, setVerifiedInfo] = useState<{ name: string; at: string | null }>(
        entry?.advance_verified ? { name: entry.verifier?.name || '', at: entry.verified_at || null } : { name: '', at: null }
    )
    const [showVerifyConfirm, setShowVerifyConfirm] = useState(false)
    const [verifying, setVerifying] = useState(false)

    const handleVerifyAdvance = async () => {
        if (!entry) return
        setVerifying(true)
        try {
            const res = await fetch(`/api/work-log/${entry.id}/verify-advance`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Failed to verify advance payment')
                return
            }
            setAdvanceVerified(true)
            setVerifiedInfo({ name: currentUser?.name || 'You', at: data.verified_at || new Date().toISOString() })
            setShowVerifyConfirm(false)
            toast.success('Advance payment verified')
        } catch {
            toast.error('Failed to verify advance payment')
        } finally {
            setVerifying(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const totalAmount = (parseFloat(form.amount) || 0) + (parseFloat(form.suggested_amount) || 0)
    const hasAdvance = parseFloat(form.advance) > 0

    const toggleOrderType = (key: string) => {
        setForm(prev => ({
            ...prev,
            order_type: prev.order_type.includes(key)
                ? prev.order_type.filter(k => k !== key)
                : [...prev.order_type, key],
        }))
    }

    // Typing a Suggested amount implies the order is (at least in part) a suggested one — kept
    // in sync both ways, so clearing the amount back out un-ticks it again too.
    useEffect(() => {
        const shouldHave = (parseFloat(form.suggested_amount) || 0) > 0
        setForm(prev => {
            const has = prev.order_type.includes('suggested')
            if (shouldHave === has) return prev
            return { ...prev, order_type: shouldHave ? [...prev.order_type, 'suggested'] : prev.order_type.filter(t => t !== 'suggested') }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.suggested_amount])

    // Same idea for the amount tiers — only the single highest tier that's cleared is tagged
    // (not every lower one it also technically clears) — dropping back below a threshold
    // un-tags it, same as Suggested above.
    useEffect(() => {
        const tier = totalAmount >= 5000 ? '5000_plus' : totalAmount >= 3000 ? '3000_plus' : totalAmount >= 2000 ? '2000_plus' : null
        const shouldHave: Record<string, boolean> = {
            '2000_plus': tier === '2000_plus',
            '3000_plus': tier === '3000_plus',
            '5000_plus': tier === '5000_plus',
        }
        setForm(prev => {
            let next = prev.order_type
            let changed = false
            for (const key of Object.keys(shouldHave)) {
                const has = next.includes(key)
                if (shouldHave[key] && !has) { next = [...next, key]; changed = true }
                else if (!shouldHave[key] && has) { next = next.filter(t => t !== key); changed = true }
            }
            return changed ? { ...prev, order_type: next } : prev
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalAmount])

    // "Normal" is the fallback baseline type — it's only meaningful when nothing more specific
    // is tagged, so it's auto-added when the list would otherwise be empty and auto-removed the
    // moment any other type (auto or manual) is present.
    useEffect(() => {
        setForm(prev => {
            const hasOthers = prev.order_type.some(t => t !== 'normal')
            const shouldHaveNormal = !hasOthers
            const has = prev.order_type.includes('normal')
            if (shouldHaveNormal === has) return prev
            return { ...prev, order_type: shouldHaveNormal ? [...prev.order_type, 'normal'] : prev.order_type.filter(t => t !== 'normal') }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.order_type])

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
        if (form.order_type.length === 0) { setError('Order Type is required'); setLoading(false); return }
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
                transaction_id: form.transaction_id || null,
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

                    {/* Transaction ID — only relevant once a gateway is picked */}
                    {form.payment_gateway && (
                        <div className="input-group" style={{ marginBottom: '16px' }}>
                            <label className="input-label">Transaction ID / last 4 digits</label>
                            <input className="input" name="transaction_id" type="text" value={form.transaction_id} onChange={handleChange} placeholder="e.g. 8N7A2K9XYZ" />
                        </div>
                    )}

                    {/* Advance Payment Verification — editing an existing entry only */}
                    {isEdit && (
                        <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '14px', marginBottom: '16px', background: 'var(--color-surface)' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '10px' }}>Advance Payment</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Advance Amount</div>
                                    <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>৳{(parseFloat(form.advance) || 0).toLocaleString()}</div>
                                </div>
                                {advanceVerified ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, color: '#16A34A', background: 'rgba(22,163,74,0.1)' }}>
                                        ✅ Verified
                                    </span>
                                ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 600, color: '#DC2626', background: 'rgba(220,38,38,0.1)' }}>
                                        ❌ Not Verified
                                    </span>
                                )}
                            </div>
                            {advanceVerified && verifiedInfo.name && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '6px' }}>
                                    Verified by {verifiedInfo.name}{verifiedInfo.at && ` on ${new Date(verifiedInfo.at).toLocaleString()}`}
                                </div>
                            )}
                            {canVerifyAdvance && !advanceVerified && (parseFloat(form.advance) || 0) > 0 && (
                                <div style={{ marginTop: '12px' }}>
                                    {!showVerifyConfirm ? (
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowVerifyConfirm(true)}>
                                            Verify Advance
                                        </button>
                                    ) : (
                                        <div style={{ padding: '12px', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Verify this advance payment?</div>
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
                                                Amount: ৳{(parseFloat(form.advance) || 0).toLocaleString()}
                                                {form.transaction_id && <><br />Transaction ID: {form.transaction_id}</>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowVerifyConfirm(false)} disabled={verifying}>Cancel</button>
                                                <button type="button" className="btn btn-primary btn-sm" onClick={handleVerifyAdvance} disabled={verifying}>
                                                    {verifying ? 'Verifying...' : 'Verify'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Business Name + Delivery Status */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className="input-group">
                            <label className="input-label">Business / Page Name<RequiredStar /></label>
                            <select className="input" name="business_name" value={form.business_name} onChange={handleChange}>
                                <option value="">Select business</option>
                                {BUSINESS_NAMES.map(b => <option key={b} value={b}>{b}</option>)}
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

                    {/* Order Type — multi-select: an order can be e.g. both Suggested and 2000+ */}
                    <div className="input-group" style={{ marginBottom: '16px' }}>
                        <label className="input-label">Order Type<RequiredStar /></label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {ORDER_TYPES.map(ot => {
                                const checked = form.order_type.includes(ot.key)
                                return (
                                    <label key={ot.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border-light)'}`, background: checked ? 'rgba(37,99,235,0.08)' : 'transparent', cursor: 'pointer', fontSize: '0.8125rem' }}>
                                        <input type="checkbox" checked={checked} onChange={() => toggleOrderType(ot.key)} />
                                        {ot.label}
                                    </label>
                                )
                            })}
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
