'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import ModernDatePicker from '@/components/ui/ModernDatePicker'
import { useToast } from '@/lib/ToastContext'
import FundPanel from '@/components/expenses/FundPanel'
import DatePicker from '@/components/ui/DatePicker'
import TransactionsList from '@/components/finance/TransactionsList'
import CategoriesManager from '@/components/finance/CategoriesManager'
import BudgetsManager from '@/components/finance/BudgetsManager'
import ReportsView from '@/components/finance/ReportsView'
import FundsManager from '@/components/finance/FundsManager'
import AdvanceManager from '@/components/finance/AdvanceManager'
import ProvidentFundManager from '@/components/finance/ProvidentFundManager'

interface Expense {
    id: string
    date: string
    category: string | null
    description: string | null
    amount: string | number
    payment_method: string | null
    fund_id?: string | null
    payment_status: 'pending' | 'paid' | 'rejected'
    // Independent of payment_status above — only set for Salary Advance/Employee Loan
    // expenses, tracking whether the EMPLOYEE has repaid it (see /api/expenses). "Paid" or
    // "Pending"/"Pending X/N" for EMI installment progress; null for every other expense.
    receiving_status: string | null
    note: string | null
    submitter: { id: string; name: string } | null
    approver: { id: string; name: string } | null
    created_at: string
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    paid: { label: 'Paid', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
    rejected: { label: 'Rejected', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
}

const categories = [
    'Office Rent', 'Electricity Bill', 'Internet Bill', 'Telephone Bills',
    'Employee Snacks Bill', 'Office Supplies', 'Product Purchase', 'Delivery Charges',
    'Travel and Transportation', 'Marketing', 'Advertising', 'Maintenance',
    'Salaries', 'Bonus & Commission', 'Taxes', 'Development', 'Subscriptions', 'Donations',
    'Family', 'Personal', 'Miscellaneous',
]

// Removed categoryOptions to use pure string categories

const paymentMethods = ['bKash', 'Rocket', 'Nagad', 'Bank', 'Cash']

const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'paid', label: 'Paid' },
]

const getLocalDateString = (d: Date = new Date()) => {
    const local = new Date(d)
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
    return local.toISOString().split('T')[0]
}

const emptyForm = {
    date: getLocalDateString(),
    category: '',
    description: '',
    amount: '',
    payment_method: '',
    fund_id: '',
    invoice_id: '',
    note: '',
    business_name: '',
}

const emptyIncomeForm = {
    date: getLocalDateString(),
    description: '',
    amount: '',
    source: '',
    fund_id: '',
    invoice_id: '',
    note: '',
    business_name: '',
}

interface IncomeEntry {
    id: string
    date: string
    description: string | null
    amount: string | number
    source: string | null
    fund_id?: string | null
    note: string | null
    business_name: string | null
    adder: { id: string; name: string } | null
    created_at: string
}

export default function ExpensesPage() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0, rejected: 0, count: 0 })
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [showExtraFields, setShowExtraFields] = useState(false)
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    // Date filtering
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today')
    const [refDate, setRefDate] = useState(() => getLocalDateString())
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    // Income
    const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([])
    const [totalIncome, setTotalIncome] = useState(0)
    const [showIncomeModal, setShowIncomeModal] = useState(false)
    const [incomeForm, setIncomeForm] = useState(emptyIncomeForm)
    const [incomeSaving, setIncomeSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'categories' | 'budgets' | 'reports' | 'funds' | 'advance' | 'providentFund'>('overview')
    const [funds, setFunds] = useState<{ id: string; name: string }[]>([])
    // Bulk-approve pending expenses (Super Admin only)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [bulkApproving, setBulkApproving] = useState(false)
    // Admin filter (Super Admin only) — who submitted the expenses being viewed
    const [filterSubmitter, setFilterSubmitter] = useState('')

    const getWeekRange = (d: Date) => {
        const day = d.getDay()
        const start = new Date(d); start.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
        const end = new Date(start); end.setDate(start.getDate() + 6)
        return { start: getLocalDateString(start), end: getLocalDateString(end) }
    }
    const getMonthRange = (d: Date) => {
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        return { start: getLocalDateString(start), end: getLocalDateString(end) }
    }

    const fetchExpenses = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (dateRange === 'today') {
                params.set('start_date', refDate)
                params.set('end_date', refDate)
            } else if (dateRange === 'week') {
                const r = getWeekRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRange === 'month') {
                const r = getMonthRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRange === 'custom' && customStart && customEnd) {
                params.set('start_date', customStart)
                params.set('end_date', customEnd)
            }
            if (filterSubmitter) params.set('submitted_by', filterSubmitter)
            const url = `/api/expenses?${params}`
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setExpenses(data.expenses || [])
                setStats(data.stats || { total: 0, pending: 0, paid: 0, rejected: 0, count: 0 })
            }
            // Fetch income with same date range
            const incRes = await fetch(`/api/income?${params}`)
            if (incRes.ok) {
                const incData = await incRes.json()
                setIncomeEntries(incData.entries || [])
                setTotalIncome(incData.totalIncome || 0)
            }
        } catch { console.error('Failed to fetch') }
        finally { setLoading(false) }
    }, [dateRange, refDate, customStart, customEnd, filterSubmitter])

    useEffect(() => {
        fetchExpenses()
    }, [fetchExpenses])

    // Drop any bulk-approve selection that's no longer visible after a tab/filter switch.
    useEffect(() => {
        setSelectedIds([])
    }, [activeFilter])

    useEffect(() => {
        const fetchFunds = async () => {
            try {
                const res = await fetch('/api/finance/funds')
                if (res.ok) {
                    const data = await res.json()
                    setFunds(data)
                }
            } catch (e) {
                console.error(e)
            }
        }
        fetchFunds()
    }, [])

    useEffect(() => {
        setIsAdmin(perms.is_admin || perms.is_super)
        setIsSuperAdmin(perms.is_super)
    }, [perms])


    const openAddModal = () => { setEditingExpense(null); setForm(emptyForm); setShowExtraFields(false); setShowModal(true) }
    const openEditModal = (e: Expense) => {
        setEditingExpense(e)
        setForm({
            date: e.date || emptyForm.date,
            category: e.category || '',
            description: e.description || '',
            amount: String(e.amount || ''),
            payment_method: e.payment_method || '',
            fund_id: (e as any).fund_id || '',
            invoice_id: (e as unknown as { invoice_id?: string }).invoice_id || '',
            note: e.note || '',
            business_name: (e as unknown as { business_name?: string }).business_name || '',
        })
        setShowExtraFields(!!(e.payment_method || (e as unknown as { invoice_id?: string }).invoice_id || e.note))
        setShowModal(true)
    }

    const isExpenseFormValid = form.date && form.amount && form.category && form.description.trim()

    const handleSave = async () => {
        if (!isExpenseFormValid) return
        setSaving(true)
        try {
            const method = editingExpense ? 'PUT' : 'POST'
            const body = editingExpense ? { id: editingExpense.id, ...form, amount: Number(form.amount) } : { ...form, amount: Number(form.amount) }
            const res = await fetch('/api/expenses', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            if (res.ok) {
                await fetchExpenses()
                setShowModal(false)
            } else {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to save expense')
            }
        } catch { toast.error('Failed to save expense') }
        finally { setSaving(false) }
    }

    const handleApproval = async (id: string, status: string) => {
        const res = await fetch('/api/expenses', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, payment_status: status }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to update expense'); return }
        toast.success(`Expense ${status}`)
        await fetchExpenses()
    }

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return
        if (!confirm(`Approve ${selectedIds.length} selected expense(s)?`)) return
        setBulkApproving(true)
        try {
            const res = await fetch('/api/expenses/bulk-approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
            })
            if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to approve expenses'); return }
            const result = await res.json()
            if (result.skipped?.length > 0) {
                toast.error(`Approved ${result.approved}, skipped ${result.skipped.length} (exceeded available fund)`)
            } else {
                toast.success(`Approved ${result.approved} expense(s)`)
            }
            setSelectedIds([])
            await fetchExpenses()
        } catch {
            toast.error('Failed to approve expenses')
        } finally {
            setBulkApproving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this expense?')) return
        const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to delete expense'); return }
        toast.success('Expense deleted')
        await fetchExpenses()
    }

    const handleIncomeDelete = async (id: string) => {
        if (!confirm('Delete this income entry?')) return
        await fetch(`/api/income?id=${id}`, { method: 'DELETE' })
        await fetchExpenses()
    }

    const filtered = expenses.filter(e => {
        if (activeFilter !== 'all' && e.payment_status !== activeFilter) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (!(e.description || '').toLowerCase().includes(q) && !(e.category || '').toLowerCase().includes(q)) return false
        }
        return true
    })

    // Only the pending rows currently on screen are selectable for bulk-approve.
    const pendingVisibleIds = filtered.filter(e => e.payment_status === 'pending').map(e => e.id)
    const allPendingSelected = pendingVisibleIds.length > 0 && pendingVisibleIds.every(id => selectedIds.includes(id))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getName = (obj: any) => {
        if (!obj) return null
        return Array.isArray(obj) ? obj[0]?.name : obj.name
    }

    const handleIncomeSave = async () => {
        if (!incomeForm.amount || !incomeForm.description.trim()) return
        setIncomeSaving(true)
        try {
            const res = await fetch('/api/income', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...incomeForm, amount: Number(incomeForm.amount) }) })
            if (res.ok) { await fetchExpenses(); setShowIncomeModal(false); setIncomeForm(emptyIncomeForm) }
            else { const d = await res.json(); alert(d.error || 'Failed') }
        } catch { console.error('Failed') }
        finally { setIncomeSaving(false) }
    }

    const [showBudgetModal, setShowBudgetModal] = useState(false)
    const [budgetAmount, setBudgetAmount] = useState('')

    const handleBudgetSave = async () => {
        if (!budgetAmount) return
        setIncomeSaving(true)
        try {
            // Update the existing budget row if one is already shown, instead of inserting a duplicate.
            const existingBudget = incomeEntries.find(e => e.source === 'Monthly_Budget')
            const res = existingBudget
                ? await fetch('/api/income', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: existingBudget.id, amount: Number(budgetAmount) }) })
                : await fetch('/api/income', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: refDate, amount: Number(budgetAmount), description: 'Monthly Budget allocation', source: 'Monthly_Budget', note: 'System Budget' }) })
            if (res.ok) { await fetchExpenses(); setShowBudgetModal(false); setBudgetAmount('') }
            else { const d = await res.json(); alert(d.error || 'Failed') }
        } catch { console.error('Failed') }
        finally { setIncomeSaving(false) }
    }

    const regularIncome = incomeEntries.filter(e => e.source !== 'Monthly_Budget')
    const budgetEntries = incomeEntries.filter(e => e.source === 'Monthly_Budget')
    
    const totalRealIncome = regularIncome.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const totalBudget = budgetEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0)

    // Rejected expenses are denied money and must NOT count against budget or net balance.
    // "Committed" = paid + pending (everything actually owed/spent).
    const committedExpenses = stats.paid + stats.pending
    const netBalance = totalRealIncome - committedExpenses
    const remainingBudget = totalBudget - committedExpenses

    const statCards = [
        { label: 'Budget', value: `৳${totalBudget.toLocaleString()}`, sub: `Remaining: ৳${remainingBudget.toLocaleString()}`, color: '#3B82F6' },
        { label: 'Total Income', value: `৳${totalRealIncome.toLocaleString()}`, sub: `${regularIncome.length} entries`, color: '#10B981' },
        { label: 'Total Expenses', value: `৳${committedExpenses.toLocaleString()}`, sub: `${stats.count} entries`, color: '#DC2626' },
        { label: 'Net Balance', value: `৳${Math.abs(netBalance).toLocaleString()}`, sub: netBalance >= 0 ? 'Profit' : 'Loss', color: netBalance >= 0 ? '#10B981' : '#DC2626' },
        { label: 'Pending', value: `৳${stats.pending.toLocaleString()}`, sub: 'Awaiting approval', color: '#F59E0B' },
    ]

    return (
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Finance Hub</h1>
                    <p className="page-subtitle">All-in-one financial management, budgets, and reporting.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                            const now = new Date()
                            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                            const link = document.createElement('a')
                            link.href = `/api/export?type=expenses&month=${month}`
                            link.download = `expenses-${month}.csv`
                            link.click()
                        }}
                        title="Export this month's expenses"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export
                    </button>
                    {isAdmin && (
                        <>
                            <button className="btn btn-sm" style={{ background: '#3B82F6', color: '#fff', border: 'none' }} onClick={() => { setBudgetAmount(''); setShowBudgetModal(true) }}>
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                Add Budget
                            </button>
                            <button className="btn btn-sm" style={{ background: '#10B981', color: '#fff', border: 'none' }} onClick={() => { setIncomeForm(emptyIncomeForm); setShowIncomeModal(true) }}>
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                Add Income
                            </button>
                        </>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Add Expense
                    </button>
                </div>
            </motion.div>

            {/* Tab Navigation */}
            <motion.div variants={item} style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--color-border-light)', marginBottom: '24px', paddingBottom: '0' }}>
                {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'transactions', label: 'Transactions' },
                    { id: 'categories', label: 'Categories' },
                    { id: 'budgets', label: 'Budgets' },
                    { id: 'reports', label: 'Reports' },
                    { id: 'funds', label: 'Funds' },
                    ...(isAdmin ? [{ id: 'advance', label: 'Salary Advance & EMI' }] : []),
                    ...(isAdmin ? [{ id: 'providentFund', label: 'Provident Fund' }] : []),
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            background: 'none', border: 'none', padding: '0 0 12px 0',
                            fontSize: '0.9375rem', fontWeight: activeTab === tab.id ? 600 : 500,
                            color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            cursor: 'pointer', position: 'relative'
                        }}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div layoutId="activeFinanceTab" style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', background: '#0070f3', borderRadius: '2px' }} />
                        )}
                    </button>
                ))}
            </motion.div>

            {activeTab === 'transactions' && <TransactionsList />}
            {activeTab === 'categories' && <CategoriesManager />}
            {activeTab === 'budgets' && <BudgetsManager />}
            {activeTab === 'advance' && isAdmin && <AdvanceManager />}
            {activeTab === 'providentFund' && isAdmin && <ProvidentFundManager />}
            {activeTab === 'reports' && <ReportsView />}

            {activeTab === 'overview' && (
                <>
            {/* Stats */}
            <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {statCards.map(s => (
                    <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>{s.label}</div>
                        <div style={{ fontSize: '1.375rem', fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s.sub}</div>
                    </div>
                ))}
            </motion.div>

            {/* Fund system (#18/#19) — admins see the transparent gamified fund overview.
                Super Admin can click an admin's card to filter the expense list/charts to
                just their expenses (click again to clear). */}
            {isAdmin && (
                <FundPanel
                    activeEmployeeId={isSuperAdmin ? (filterSubmitter || null) : undefined}
                    onSelectEmployee={isSuperAdmin ? (id) => setFilterSubmitter(id || '') : undefined}
                />
            )}

            {/* Date Range Filter */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {([{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }] as const).map(opt => (
                        <button key={opt.key} onClick={() => setDateRange(opt.key)}
                            style={{ position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '0.8125rem', fontWeight: 500, background: 'transparent', color: dateRange === opt.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', transition: 'color 0.2s', zIndex: 1 }}>
                            {dateRange === opt.key && (
                                <motion.div layoutId="expDateTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
                        </button>
                    ))}
                </div>
                {(dateRange === 'today' || dateRange === 'week' || dateRange === 'month') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => {
                            const d = new Date(refDate); d.setDate(d.getDate() - (dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 1)); setRefDate(getLocalDateString(d))
                        }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <div style={{ width: '160px' }}>
                            <ModernDatePicker value={refDate} onChange={setRefDate} />
                        </div>
                        <button className="btn btn-ghost btn-icon" onClick={() => {
                            const d = new Date(refDate); d.setDate(d.getDate() + (dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 1)); setRefDate(getLocalDateString(d))
                        }} style={{ borderRadius: '8px' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                )}
                {dateRange === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '150px' }}><ModernDatePicker value={customStart} onChange={setCustomStart} placeholder="Start Date" /></div>
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>to</span>
                        <div style={{ width: '150px' }}><ModernDatePicker value={customEnd} onChange={setCustomEnd} placeholder="End Date" /></div>
                    </div>
                )}
            </motion.div>

            {/* Segmented Control + Search */}
            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                    {filterTabs.map(tab => (
                        <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                            style={{
                                position: 'relative', padding: '7px 16px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                color: activeFilter === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                            }}>
                            {activeFilter === tab.key && (
                                <motion.div layoutId="expenseTab" style={{
                                    position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                    borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                    <div style={{ position: 'relative' }}>
                        <svg width="15" height="15" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                        <input className="form-input" type="text" placeholder="Search expenses..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '34px', height: '36px', fontSize: '0.8125rem', background: 'rgba(118,118,128,0.08)', border: 'none', borderRadius: '10px' }}
                        />
                    </div>
                </div>
                {isSuperAdmin && selectedIds.length > 0 && (
                    <button className="btn btn-primary btn-sm" onClick={handleBulkApprove} disabled={bulkApproving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ✓ {bulkApproving ? 'Approving...' : `Approve Selected (${selectedIds.length})`}
                    </button>
                )}
            </motion.div>

            {/* Donut Charts: By Category & By User */}
            {expenses.length > 0 && (
                <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    {/* Gamified Budget Analytics Card */}
                    {totalBudget > 0 && isAdmin && (() => {
                        const usedPct = Math.min(committedExpenses / totalBudget, 1)
                        const overBudget = committedExpenses > totalBudget
                        const remaining = totalBudget - committedExpenses

                        let statusColor = '#10B981' // Green
                        let statusText = 'On Track 🎯'
                        let trackColor = 'rgba(16, 185, 129, 0.1)'
                        if (usedPct >= 0.9) {
                            statusColor = '#EF4444' // Red
                            statusText = 'Over Budget 🚨'
                            trackColor = 'rgba(239, 68, 68, 0.1)'
                        } else if (usedPct >= 0.75) {
                            statusColor = '#F59E0B' // Orange
                            statusText = 'Nearing Limit ⚠️'
                            trackColor = 'rgba(245, 158, 11, 0.1)'
                        }

                        if (overBudget) {
                            statusText = 'Limit Exceeded ❌'
                        }

                        const r = 70, cx = 90, cy = 90, stroke = 20
                        const circumference = Math.PI * r
                        const dashLen = usedPct * circumference
                        const dashOffset = circumference - dashLen

                        return (
                            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Budget Analytics</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: trackColor, color: statusColor }}>
                                        {Math.round((committedExpenses / totalBudget) * 100)}% Used
                                    </div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <div style={{ position: 'relative', width: '180px', height: '100px', overflow: 'hidden' }}>
                                        <svg width="180" height="100" viewBox="0 0 180 100">
                                            {/* Background track */}
                                            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(118,118,128,0.15)" strokeWidth={stroke} strokeLinecap="round" />
                                            {/* Foreground track */}
                                            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={statusColor} strokeWidth={stroke} strokeLinecap="round" 
                                                strokeDasharray={circumference}
                                                strokeDashoffset={dashOffset}
                                                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                                            />
                                        </svg>
                                        <div style={{ position: 'absolute', bottom: '0px', left: '0', right: '0', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>৳{committedExpenses.toLocaleString()}</div>
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '-2px' }}>of ৳{totalBudget.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '0.875rem', fontWeight: 600, color: statusColor }}>
                                        {statusText}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                        {remaining >= 0 ? `৳${remaining.toLocaleString()} remaining` : `Over by ৳${Math.abs(remaining).toLocaleString()}`}
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                    {/* By Category */}
                    {(() => {
                        const catBreakdown: Record<string, number> = {}
                        expenses.forEach(e => {
                            const cat = e.category || 'Other'
                            catBreakdown[cat] = (catBreakdown[cat] || 0) + Number(e.amount || 0)
                        })
                        const sorted = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1])
                        const total = sorted.reduce((s, [, v]) => s + v, 0)
                        const chartColors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#A855F7', '#06B6D4', '#D946EF', '#78716C', '#64748B', '#DC2626', '#16A34A', '#CA8A04', '#9333EA', '#0891B2']
                        const r = 70, cx = 90, cy = 90, stroke = 28
                        const circumference = 2 * Math.PI * r
                        let offset = 0
                        return (
                            <div className="card" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary)' }}>Expenses by Category</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <svg width="180" height="180" viewBox="0 0 180 180">
                                            {sorted.map(([cat, amount], i) => {
                                                const pct = total > 0 ? amount / total : 0
                                                const dashLen = pct * circumference
                                                const dashOffset = -offset
                                                offset += dashLen
                                                return (
                                                    <circle key={cat} cx={cx} cy={cy} r={r} fill="none"
                                                        stroke={chartColors[i % chartColors.length]}
                                                        strokeWidth={stroke}
                                                        strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                                                        strokeDashoffset={dashOffset}
                                                        transform={`rotate(-90 ${cx} ${cy})`}
                                                        style={{ transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease' }}
                                                    />
                                                )
                                            })}
                                        </svg>
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>Total</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>৳{total.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, maxHeight: '180px', overflowY: 'auto' }}>
                                        {sorted.map(([cat, amount], i) => (
                                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: chartColors[i % chartColors.length], flexShrink: 0 }} />
                                                <span style={{ flex: 1, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat} ({expenses.filter(e => (e.category || 'Other') === cat).length})</span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>৳{amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {/* By User */}
                    {(() => {
                        const userBreakdown: Record<string, number> = {}
                        expenses.forEach(e => {
                            const name = getName(e.submitter) || 'Unknown'
                            userBreakdown[name] = (userBreakdown[name] || 0) + Number(e.amount || 0)
                        })
                        const sorted = Object.entries(userBreakdown).sort((a, b) => b[1] - a[1])
                        const total = sorted.reduce((s, [, v]) => s + v, 0)
                        const chartColors = ['#10B981', '#2563EB', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9', '#14B8A6', '#F97316', '#6366F1', '#84CC16']
                        const r = 70, cx = 90, cy = 90, stroke = 28
                        const circumference = 2 * Math.PI * r
                        let offset = 0
                        return (
                            <div className="card" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary)' }}>Expenses by User</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <svg width="180" height="180" viewBox="0 0 180 180">
                                            {sorted.map(([name, amount], i) => {
                                                const pct = total > 0 ? amount / total : 0
                                                const dashLen = pct * circumference
                                                const dashOffset = -offset
                                                offset += dashLen
                                                return (
                                                    <circle key={name} cx={cx} cy={cy} r={r} fill="none"
                                                        stroke={chartColors[i % chartColors.length]}
                                                        strokeWidth={stroke}
                                                        strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                                                        strokeDashoffset={dashOffset}
                                                        transform={`rotate(-90 ${cx} ${cy})`}
                                                        style={{ transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease' }}
                                                    />
                                                )
                                            })}
                                        </svg>
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>{sorted.length} Users</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>৳{total.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, maxHeight: '180px', overflowY: 'auto' }}>
                                        {sorted.map(([name, amount], i) => (
                                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: chartColors[i % chartColors.length], flexShrink: 0 }} />
                                                <span style={{ flex: 1, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name} ({expenses.filter(e => (getName(e.submitter) || 'Unknown') === name).length})</span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>৳{amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                </motion.div>
            )}

            {/* Expenses Table */}
            {loading ? (
                <motion.div variants={item} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0 }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div className="skeleton" style={{ width: '55%', height: 14 }} />
                                <div className="skeleton" style={{ width: '35%', height: 10 }} />
                            </div>
                            <div className="skeleton" style={{ width: 70, height: 14 }} />
                        </div>
                    ))}
                </motion.div>
            ) : filtered.length === 0 ? (
                <motion.div variants={item} className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
                        <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '8px' }}>No expenses yet</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Click &quot;Add Expense&quot; to record one.</p>
                </motion.div>
            ) : (
                <motion.div variants={item} className="card" style={{ overflow: 'hidden', padding: 0 }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    {isSuperAdmin && (
                                        <th style={{ padding: '12px 16px', width: '32px' }}>
                                            {pendingVisibleIds.length > 0 && (
                                                <input type="checkbox" checked={allPendingSelected}
                                                    onChange={e => setSelectedIds(e.target.checked ? pendingVisibleIds : [])}
                                                    title="Select all pending" style={{ cursor: 'pointer' }} />
                                            )}
                                        </th>
                                    )}
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receiving Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>By</th>
                                    {isAdmin && <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((e, i) => {
                                    const sc = statusConfig[e.payment_status] || statusConfig.pending
                                    return (
                                        <tr key={e.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border-light)' : 'none', transition: 'background 0.15s' }}
                                            onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(118,118,128,0.04)')}
                                            onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                                            {isSuperAdmin && (
                                                <td style={{ padding: '10px 16px' }}>
                                                    {e.payment_status === 'pending' && (
                                                        <input type="checkbox" checked={selectedIds.includes(e.id)}
                                                            onChange={ev => setSelectedIds(ev.target.checked ? [...selectedIds, e.id] : selectedIds.filter(id => id !== e.id))}
                                                            style={{ cursor: 'pointer' }} />
                                                    )}
                                                </td>
                                            )}
                                            <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                                                {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 500, background: 'rgba(118,118,128,0.08)', color: 'var(--color-text-secondary)' }}>
                                                    {e.category || 'Other'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 16px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {e.description || '-'}
                                            </td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                                                ৳{Number(e.amount).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '10px 16px', color: 'var(--color-text-tertiary)' }}>{e.payment_method || '-'}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, color: sc.color, background: sc.bg }}>{sc.label}</span>
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                {/* Independent of Status above — tracks employee
                                                    repayment of the linked Salary Advance/
                                                    Employee Loan, not the company's own paid/
                                                    pending approval. Only set for those two
                                                    categories; every other expense shows '-'. */}
                                                {e.receiving_status ? (
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600,
                                                        color: e.receiving_status.startsWith('Paid') ? '#16A34A' : '#B45309',
                                                        background: e.receiving_status.startsWith('Paid') ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.12)',
                                                    }}>
                                                        {e.receiving_status}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 16px', color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>
                                                {getName(e.submitter) || '-'}
                                            </td>
                                            {isAdmin && (
                                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                        {e.payment_status === 'pending' && isSuperAdmin && (
                                                            <button className="btn btn-ghost btn-sm" onClick={() => handleApproval(e.id, 'paid')} title="Approve" style={{ padding: '4px', color: '#10B981' }}>✓</button>
                                                        )}
                                                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(e)} style={{ padding: '4px' }} title="Edit">
                                                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                        </button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(e.id)} style={{ padding: '4px', color: '#DC2626' }} title="Remove">
                                                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%' }}>
                            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0, justifyContent: 'center', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(118,118,128,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 12h.01M17 12h.01" /><circle cx="12" cy="12" r="2" />
                                        </svg>
                                    </div>
                                    <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{editingExpense ? 'Edit Expense' : 'New Expense'}</h2>
                                </div>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '24px' }}>
                                
                                {/* Amount Input - Minimal */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(118,118,128,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Amount Spent</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>৳</span>
                                        <input 
                                            type="number" 
                                            value={form.amount} 
                                            onChange={e => setForm({ ...form, amount: e.target.value })} 
                                            placeholder="0" 
                                            style={{ 
                                                fontSize: '3rem', fontWeight: 700, color: 'var(--color-text-primary)', 
                                                background: 'transparent', border: 'none', outline: 'none', 
                                                width: '160px', textAlign: 'center', padding: 0 
                                            }} 
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            Date
                                        </label>
                                        <ModernDatePicker value={form.date} onChange={val => setForm({ ...form, date: val })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                                            Category
                                        </label>
                                        <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ padding: '10px 14px', borderRadius: '10px' }}>
                                            <option value="">Select category...</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        Description
                                    </label>
                                    <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Bought some snacks for the team..." required style={{ padding: '12px 14px', borderRadius: '10px', fontSize: '1rem' }} />
                                </div>
                                
                                <AnimatePresence>
                                    {showExtraFields ? (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px', borderTop: '1px dashed var(--color-border-light)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                    <div className="form-group">
                                                        <label className="form-label">Fund (Method)</label>
                                                        <select className="form-input" value={form.fund_id || form.payment_method} onChange={e => {
                                                            const fund = funds.find(f => f.id === e.target.value)
                                                            if (fund) {
                                                                setForm({ ...form, fund_id: fund.id, payment_method: fund.name })
                                                            } else {
                                                                setForm({ ...form, fund_id: '', payment_method: e.target.value })
                                                            }
                                                        }}>
                                                            <option value="">Select Fund...</option>
                                                            {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                            {/* Fallback for legacy methods */}
                                                            {paymentMethods.filter(pm => !funds.some(f => f.name === pm)).map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">Invoice ID</label>
                                                        <input className="form-input" value={form.invoice_id} onChange={e => setForm({ ...form, invoice_id: e.target.value })} placeholder="#INV-001" />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Additional Note</label>
                                                    <input className="form-input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Any extra details..." />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <button className="btn btn-ghost" onClick={() => setShowExtraFields(true)} style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', marginTop: '-8px' }}>
                                            + Add method, invoice, or notes
                                        </button>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleSave} 
                                    disabled={saving || !isExpenseFormValid}
                                    style={{ width: '100%', padding: '14px', fontSize: '1rem', borderRadius: '12px', background: isExpenseFormValid ? '#0070f3' : 'var(--color-bg-secondary)', color: isExpenseFormValid ? 'white' : 'var(--color-text-tertiary)', transition: 'all 0.2s ease', border: 'none', fontWeight: 600 }}
                                >
                                    {saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Record Expense'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Income Modal */}
            <AnimatePresence>
                {showIncomeModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowIncomeModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="#10B981"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                    Add Income
                                </h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowIncomeModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Date *</label>
                                        <ModernDatePicker value={incomeForm.date} onChange={val => setIncomeForm({ ...incomeForm, date: val })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Amount (৳) *</label>
                                        <input className="form-input" type="number" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} placeholder="Enter amount" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description *</label>
                                    <input className="form-input" value={incomeForm.description} onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })} placeholder="Income source description..." />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Source</label>
                                        <input className="form-input" value={incomeForm.source} onChange={e => setIncomeForm({ ...incomeForm, source: e.target.value })} placeholder="e.g. Sales, Investment" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fund (Deposit To)</label>
                                        <select className="form-input" value={incomeForm.fund_id} onChange={e => setIncomeForm({ ...incomeForm, fund_id: e.target.value })}>
                                            <option value="">Select Fund...</option>
                                            {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Invoice ID</label>
                                        <input className="form-input" value={incomeForm.invoice_id} onChange={e => setIncomeForm({ ...incomeForm, invoice_id: e.target.value })} placeholder="Enter invoice ID" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Business / Page</label>
                                    <select className="form-input" value={incomeForm.business_name} onChange={e => setIncomeForm({ ...incomeForm, business_name: e.target.value })}>
                                        <option value="">Select business</option>
                                        <option value="OBM BN">OBM BN</option><option value="OBM EN">OBM EN</option><option value="Adishad">Adishad</option><option value="PGM">PGM</option><option value="Premium Shukti">Premium Shukti</option><option value="Premium Achar">Premium Achar</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Note</label>
                                    <input className="form-input" value={incomeForm.note} onChange={e => setIncomeForm({ ...incomeForm, note: e.target.value })} placeholder="Additional notes..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowIncomeModal(false)}>Cancel</button>
                                <button className="btn btn-sm" style={{ background: '#10B981', color: '#fff', border: 'none' }} onClick={handleIncomeSave} disabled={incomeSaving || !incomeForm.amount || !incomeForm.description.trim()}>
                                    {incomeSaving ? 'Saving...' : 'Add Income'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Budget Modal */}
            <AnimatePresence>
                {showBudgetModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBudgetModal(false)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="#3B82F6"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                    Set Monthly Budget
                                </h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowBudgetModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="form-group">
                                    <label className="form-label">Budget Amount (৳) *</label>
                                    <input className="form-input" type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} placeholder="Enter budget for this period" />
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                                    This will add a budget entry to the current period. To adjust the budget, you can add another entry or delete the existing one from the Income Entries table below.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowBudgetModal(false)}>Cancel</button>
                                <button className="btn btn-sm" style={{ background: '#3B82F6', color: '#fff', border: 'none' }} onClick={handleBudgetSave} disabled={incomeSaving || !budgetAmount}>
                                    {incomeSaving ? 'Saving...' : 'Set Budget'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Income Entries (Admin only) */}
            {isAdmin && incomeEntries.length > 0 && (
                <motion.div variants={item} style={{ marginTop: '24px' }}>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="#10B981"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                        Income Entries
                    </h3>
                    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Date</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Description</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Source</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Amount</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-tertiary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {incomeEntries.map((inc, idx) => (
                                        <tr key={inc.id} style={{ borderBottom: idx < incomeEntries.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                                            <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)' }}>{new Date(inc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                            <td style={{ padding: '10px 16px' }}>{inc.description || '-'}</td>
                                            <td style={{ padding: '10px 16px', color: 'var(--color-text-tertiary)' }}>{inc.source || '-'}</td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#10B981', fontFamily: 'monospace' }}>+৳{Number(inc.amount).toLocaleString()}</td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleIncomeDelete(inc.id)} style={{ padding: '4px', color: '#DC2626' }}>
                                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            )}
            </>
            )}

            {activeTab === 'funds' && (
                <FundsManager />
            )}
        </motion.div>
    )
}
