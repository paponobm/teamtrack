'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { getLocalDateString, getMonthRangeFromString } from '@/lib/dateRange'
import {
    IconWallet, IconBanknote, IconCheckCircle, IconClock, IconPlus, IconX,
    IconSearch, IconEdit, IconTrash, IconShieldAlert,
} from '@/components/icons/Icons'

interface ProductBuy {
    id: string
    employee_id: string
    amount: number
    product_price: number | null
    discount_price: number
    purchase_date: string
    item: string | null
    note: string | null
    payment_status: 'Paid' | 'Unpaid'
    created_at: string
    employee: { id: string; name: string; employee_id: string | null; avatar_url: string | null } | null
    created_by_employee: { id: string; name: string } | null
}

interface EmployeeOption {
    id: string
    name: string
    employee_id: string | null
    avatar_url: string | null
}

function currentMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || 'U').charCodeAt(0) % colors.length]
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Product Buy — a distinct deduction type from Advance (Finance Hub → Advance tab): money
// the company fronted for a product an employee purchased/received on credit, recovered via
// payroll. Its own table (product_buys), API (/api/product-buys), and Salary Sheet column —
// never merged with Advance's data or calculation.
export default function ProductBuyPage() {
    const { data, isLoading: permsLoading } = usePermissions()
    const { success: toastSuccess, error: toastError } = useToast()

    const [productBuys, setProductBuys] = useState<ProductBuy[]>([])
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Unpaid'>('all')
    const [month, setMonth] = useState(currentMonth)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<ProductBuy | null>(null)

    const isAdmin = data.is_admin || data.is_super

    const fetchProductBuys = useCallback(async () => {
        setLoading(true)
        try {
            const { start, end } = getMonthRangeFromString(month)
            const params = new URLSearchParams({ start_date: start, end_date: end })
            const res = await fetch(`/api/product-buys?${params}`)
            if (res.ok) {
                const json = await res.json()
                setProductBuys(json.productBuys || [])
            }
        } finally {
            setLoading(false)
        }
    }, [month])

    useEffect(() => { fetchProductBuys() }, [fetchProductBuys])

    useEffect(() => {
        fetch('/api/members?status=active').then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployees(d) })
    }, [])

    const filtered = productBuys.filter(p => {
        if (statusFilter !== 'all' && p.payment_status !== statusFilter) return false
        if (!search) return true
        const q = search.toLowerCase()
        return (p.employee?.name || '').toLowerCase().includes(q) || (p.employee?.employee_id || '').toLowerCase().includes(q)
    })

    // Computed from the same filtered set the table shows, so Total Paid + Total Unpaid
    // always equals Total Amount for whatever combination of date + employee filters is active.
    const summary = filtered.reduce((acc, p) => {
        acc.count++
        acc.totalAmount += p.amount
        if (p.payment_status === 'Paid') acc.totalPaid += p.amount
        else acc.totalUnpaid += p.amount
        return acc
    }, { count: 0, totalAmount: 0, totalPaid: 0, totalUnpaid: 0 })

    const handleDelete = async (pb: ProductBuy) => {
        if (!confirm(`Delete this product buy record for ${pb.employee?.name || 'this employee'}?`)) return
        const res = await fetch(`/api/product-buys/${pb.id}`, { method: 'DELETE' })
        if (res.ok) {
            setProductBuys(prev => prev.filter(p => p.id !== pb.id))
            toastSuccess('Product buy record deleted')
        } else {
            const err = await res.json()
            toastError(err.error || 'Failed to delete')
        }
    }

    if (permsLoading) return null

    if (!isAdmin) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--color-text-tertiary)' }}>
                <IconShieldAlert size={32} />
                <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Access restricted to Admins</div>
            </div>
        )
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Product Buy Management</h1>
                    <p className="page-subtitle">Manage employee product purchases and payment records</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowModal(true) }}>
                    <IconPlus size={16} /> Add Product Buy
                </button>
            </motion.div>

            <motion.div variants={item} className="grid grid-4" style={{ gap: '14px', marginBottom: '20px' }}>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconWallet size={14} color="var(--color-text-tertiary)" /> Total Product Buys</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>{summary.count}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconBanknote size={14} color="var(--color-text-tertiary)" /> Total Amount</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#2563EB' }}>৳{summary.totalAmount.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconCheckCircle size={14} color="var(--color-text-tertiary)" /> Total Paid</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#16A34A' }}>৳{summary.totalPaid.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconClock size={14} color="var(--color-text-tertiary)" /> Total Unpaid</span>
                    <span className="stat-value" style={{ fontSize: '1.5rem', color: '#DC2626' }}>৳{summary.totalUnpaid.toLocaleString()}</span>
                </div>
            </motion.div>

            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Month</label>
                    <input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.8125rem', width: 'auto' }} />
                </div>
                <div style={{ position: 'relative', width: '240px' }}>
                    <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                    <input className="form-input" type="text" placeholder="Search by employee ID or name..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: '34px', height: '34px', fontSize: '0.8125rem', width: '100%' }} />
                </div>
                <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'Paid' | 'Unpaid')}
                    style={{ height: '34px', fontSize: '0.8125rem', width: 'auto' }}>
                    <option value="all">All Status</option>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                </select>
            </motion.div>

            <motion.div variants={item} className="card" style={{ overflowX: 'auto', padding: 0 }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>SL</th>
                            <th>Employee</th>
                            <th>Item</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Note</th>
                            <th>Payment Status</th>
                            <th>Created By</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && filtered.map((p, i) => (
                            <tr key={p.id}>
                                <td>{i + 1}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="avatar avatar-sm" style={{ background: getAvatarColor(p.employee?.name || 'U'), overflow: 'hidden', flexShrink: 0, width: 28, height: 28, fontSize: '0.75rem' }}>
                                            {p.employee?.avatar_url ? (
                                                <img src={p.employee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (p.employee?.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{p.employee?.name || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{p.employee?.employee_id || '—'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>{p.item || '—'}</td>
                                <td style={{ fontWeight: 700 }}>৳{p.amount.toLocaleString()}</td>
                                <td>{formatDate(p.purchase_date)}</td>
                                <td style={{ maxWidth: '220px', whiteSpace: 'normal', color: 'var(--color-text-secondary)' }}>{p.note || '—'}</td>
                                <td>
                                    <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: p.payment_status === 'Paid' ? '#16A34A' : '#DC2626', background: p.payment_status === 'Paid' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)' }}>
                                        {p.payment_status}
                                    </span>
                                </td>
                                <td style={{ color: 'var(--color-text-tertiary)' }}>{p.created_by_employee?.name || '—'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => { setEditing(p); setShowModal(true) }} title="Edit"><IconEdit size={15} /></button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(p)} title="Delete" style={{ color: '#DC2626' }}><IconTrash size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>No product buy records found.</td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '24px' }}>Loading...</td></tr>
                        )}
                    </tbody>
                </table>
            </motion.div>

            <AnimatePresence>
                {showModal && (
                    <ProductBuyModal
                        productBuy={editing}
                        employees={employees}
                        onClose={() => setShowModal(false)}
                        onSaved={(saved, isNew) => {
                            setProductBuys(prev => isNew ? [saved, ...prev] : prev.map(p => p.id === saved.id ? saved : p))
                            setShowModal(false)
                        }}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function ProductBuyModal({ productBuy, employees, onClose, onSaved }: {
    productBuy: ProductBuy | null
    employees: EmployeeOption[]
    onClose: () => void
    onSaved: (productBuy: ProductBuy, isNew: boolean) => void
}) {
    const { success: toastSuccess, error: toastError } = useToast()
    const [employeeId, setEmployeeId] = useState(productBuy?.employee_id || '')
    const [item, setItem] = useState(productBuy?.item || '')
    // Records created before Product Price/Discount Price existed as separate fields have no
    // stored breakdown — product_price falls back to the record's own amount (its net,
    // pre-split figure) and discount_price to 0, the best available reconstruction.
    const [productPrice, setProductPrice] = useState(productBuy?.product_price ?? productBuy?.amount ?? 0)
    const [discountPrice, setDiscountPrice] = useState(productBuy?.discount_price ?? 0)
    const [purchaseDate, setPurchaseDate] = useState(productBuy?.purchase_date || getLocalDateString())
    const [note, setNote] = useState(productBuy?.note || '')
    const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid'>(productBuy?.payment_status || 'Unpaid')
    const [saving, setSaving] = useState(false)

    const isEdit = !!productBuy

    // The amount actually deducted via payroll (what the Salary Sheet's Product Buy column and
    // every other consumer reads) — mirrors the same product_price - discount_price the API
    // computes server-side (see POST/PUT /api/product-buys), shown live here for confirmation.
    const amount = Math.max(0, productPrice - discountPrice)

    const handleSave = async () => {
        if (!employeeId) { toastError('Please select an employee'); return }
        if (!Number.isFinite(productPrice) || productPrice <= 0) { toastError('Product Price must be greater than 0'); return }
        if (!Number.isFinite(discountPrice) || discountPrice < 0) { toastError('Discount Price must be 0 or greater'); return }
        if (discountPrice > productPrice) { toastError('Discount Price cannot exceed Product Price'); return }

        setSaving(true)
        try {
            if (isEdit) {
                const res = await fetch(`/api/product-buys/${productBuy.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: employeeId, product_price: productPrice, discount_price: discountPrice, purchase_date: purchaseDate, item, note, payment_status: paymentStatus }),
                })
                if (res.ok) {
                    const selectedEmployee = employees.find(e => e.id === employeeId)
                    onSaved({
                        ...productBuy, employee_id: employeeId, amount, product_price: productPrice, discount_price: discountPrice, purchase_date: purchaseDate, item, note, payment_status: paymentStatus,
                        employee: selectedEmployee ? { id: selectedEmployee.id, name: selectedEmployee.name, employee_id: selectedEmployee.employee_id, avatar_url: selectedEmployee.avatar_url } : productBuy.employee,
                    }, false)
                    toastSuccess('Product buy updated')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to update')
                }
            } else {
                const res = await fetch('/api/product-buys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: employeeId, product_price: productPrice, discount_price: discountPrice, purchase_date: purchaseDate, item, note, payment_status: paymentStatus }),
                })
                if (res.ok) {
                    const json = await res.json()
                    onSaved(json.productBuy, true)
                    toastSuccess('Product buy added')
                } else {
                    const err = await res.json()
                    toastError(err.error || 'Failed to add product buy')
                }
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">{isEdit ? 'Edit Product Buy' : 'Add Product Buy'}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}><IconX size={18} /></button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label className="form-label">Employee *</label>
                        <select className="form-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                            <option value="">Select employee...</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}{emp.employee_id ? ` (${emp.employee_id})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="form-label">Item</label>
                        <input className="form-input" placeholder="e.g. Mobile phone" value={item} onChange={e => setItem(e.target.value)} />
                    </div>

                    <div>
                        <label className="form-label">Product Price (৳) *</label>
                        <input className="form-input" type="number" min={1} value={productPrice}
                            onFocus={e => e.target.select()}
                            onChange={e => setProductPrice(Math.max(0, Number(e.target.value) || 0))} />
                    </div>

                    <div>
                        <label className="form-label">Discount Price (৳)</label>
                        <input className="form-input" type="number" min={0} value={discountPrice}
                            onFocus={e => e.target.select()}
                            onChange={e => setDiscountPrice(Math.max(0, Number(e.target.value) || 0))} />
                    </div>

                    {productPrice > 0 && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', background: 'rgba(37,99,235,0.08)', borderRadius: '8px', padding: '10px 12px' }}>
                            Amount (Product Price − Discount): <strong style={{ color: '#2563EB' }}>৳{amount.toLocaleString()}</strong>
                        </div>
                    )}

                    <div>
                        <label className="form-label">Purchase Date *</label>
                        <input className="form-input" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                    </div>

                    <div>
                        <label className="form-label">Note</label>
                        <textarea className="form-input" rows={3} placeholder="Additional details" value={note} onChange={e => setNote(e.target.value)} />
                    </div>

                    <div>
                        <label className="form-label">Payment Status</label>
                        <select className="form-input" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'Paid' | 'Unpaid')}>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Paid">Paid</option>
                        </select>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
            </motion.div>
        </div>
    )
}
