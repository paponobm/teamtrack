'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MemberModalProps {
    member: {
        id: string
        employee_id: string
        name: string
        email: string
        designation: string
        personal_contact: string
        whatsapp_number: string
        address: string
        nid_no: string
        blood_group: string
        family_contact_1: string
        family_contact_2: string
        department_id: string
        role_id: string
        joining_date: string
        gender?: string | null
        date_of_birth?: string | null
        cv_url?: string | null
        duty_start_time?: string | null
        duty_end_time?: string | null
        avatar_url?: string | null
        payroll_basic_salary?: number | null
        payroll_transportation_bill?: number | null
        payroll_snacks_bill?: number | null
        basic_salary_effective_month?: string | null
        salary_increment_amount?: number | null
        salary_increment_effective_month?: string | null
        festival_bonus_percentage?: number | null
        festival_bonus_months?: number[] | null
    } | null
    departments: { id: string; name: string }[]
    roles: { id: string; name: string }[]
    onClose: () => void
    onSave: () => void
    isAdmin?: boolean
    isSuperAdmin?: boolean
    initialTab?: 'profile' | 'access' | 'logs' | 'performance' | 'points' | 'payroll'
}

const MONTHS = [
    { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' }, { value: 4, label: 'Apr' },
    { value: 5, label: 'May' }, { value: 6, label: 'Jun' }, { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' },
    { value: 9, label: 'Sep' }, { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
]

// Page definitions - configurable pages for member access control.
// Admin-only pages (Members, Attendance, Reports, Expenses, Settings) are NEVER shown here.
const PAGE_DEFINITIONS = [
    {
        section: 'Overview',
        pages: [
            { name: 'Notice Board', slug: 'notice-board', desc: 'View company notices and announcements' },
        ]
    },
    {
        section: 'Work',
        pages: [
            { name: 'Work Log', slug: 'work-log', desc: 'Submit and track daily work orders' },
            { name: 'PR Management', slug: 'pr-sending', desc: 'Manage influencer PR sends and follow-ups' },
            { name: 'Problem Box', slug: 'problem-box', desc: 'Report and resolve team problems' },
            { name: 'Tasks', slug: 'tasks', desc: 'View and manage assigned tasks' },
        ]
    },
    {
        section: 'Operations',
        pages: [
            { name: 'Courier', slug: 'courier', desc: 'Courier tracking and management' },
            // Finance and Payroll Management expose salary/compensation data, so — unlike every
            // other grantable page here — only a Super Admin can see or toggle these two when
            // editing someone's Access tab; a plain Admin editor doesn't see them at all.
            { name: 'Finance', slug: 'finance', desc: 'View and manage expenses and income', superOnly: true },
            { name: 'Product Buy', slug: 'product-buy', desc: 'Track product purchases and payments' },
            { name: 'Payroll Management', slug: 'payroll-management', desc: 'View and manage monthly salary sheets', superOnly: true },
            { name: 'Requisitions', slug: 'requisitions', desc: 'Submit requisition requests' },
            { name: 'Ideas', slug: 'idea-sharing', desc: 'Share and upvote ideas' },
            { name: 'Content', slug: 'content', desc: 'Draft and manage content' },
            { name: 'Memories', slug: 'memories', desc: 'Team photos and memories' },
        ]
    },
]

interface Feature {
    id: string
    name: string
    name_bn: string
    category: string
    slug: string
    sort_order: number
}

export default function MemberModal({ member, departments, roles, onClose, onSave, isAdmin = false, isSuperAdmin = false, initialTab }: MemberModalProps) {
    const isEdit = !!member
    const [activeTab, setActiveTab] = useState<'profile' | 'access' | 'logs' | 'performance' | 'points' | 'payroll'>(initialTab || 'profile')

    const [form, setForm] = useState({
        employee_id: member?.employee_id || '',
        name: member?.name || '',
        email: member?.email || '',
        password: '',
        designation: member?.designation || '',
        personal_contact: member?.personal_contact || '',
        whatsapp_number: member?.whatsapp_number || '',
        address: member?.address || '',
        nid_no: member?.nid_no || '',
        blood_group: member?.blood_group || '',
        family_contact_1: member?.family_contact_1 || '',
        family_contact_2: member?.family_contact_2 || '',
        department_id: member?.department_id || '',
        role_id: member?.role_id || '',
        joining_date: member?.joining_date || '',
        gender: member?.gender || '',
        date_of_birth: member?.date_of_birth || '',
        duty_start_time: member?.duty_start_time || '',
        duty_end_time: member?.duty_end_time || '',
        cv_url: member?.cv_url || '',
        avatar_url: member?.avatar_url || '',
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [avatarUploading, setAvatarUploading] = useState(false)

    // Password reset state
    const [showResetPwdForm, setShowResetPwdForm] = useState(false)
    const [resetPassword, setResetPassword] = useState('')
    const [resetPwdLoading, setResetPwdLoading] = useState(false)
    const [resetPwdMsg, setResetPwdMsg] = useState('')

    const handleResetPassword = async () => {
        if (!member || resetPassword.length < 8) return
        setResetPwdLoading(true)
        setResetPwdMsg('')
        const res = await fetch(`/api/members/${member.id}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_password: resetPassword }),
        })
        const data = await res.json()
        setResetPwdLoading(false)
        if (res.ok) {
            setResetPwdMsg('Password reset successfully')
            setResetPassword('')
            setShowResetPwdForm(false)
        } else {
            setResetPwdMsg(data.error || 'Reset failed')
        }
    }

    // Access tab state
    // accessMap key = page slug (e.g. 'notice-board', 'work-log')
    const [featureSlugToId, setFeatureSlugToId] = useState<Record<string, string>>({})
    const [accessMap, setAccessMap] = useState<Record<string, 'admin' | 'member' | 'no_access'>>({})
    const [accessLoading, setAccessLoading] = useState(false)

    // Logs tab state
    interface LogEntry { id: string; module: string; action: string; old_value: string | null; new_value: string | null; details: Record<string, unknown> | null; created_at: string; actor: { id: string; name: string } | null }
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [logsLoading, setLogsLoading] = useState(false)

    // Performance tab state
    interface PerfStats { orders: number; amount: number; deliveryRate: number; attendance: number; points: number; problemsSolved: number }
    const [perfStats, setPerfStats] = useState<PerfStats | null>(null)
    const [perfLoading, setPerfLoading] = useState(false)

    // Points tab state
    interface PointTransaction {
        id: string; points: number; source: string; category: string | null;
        description: string | null; created_at: string;
        awarder: { id: string; name: string } | null;
    }
    const [pointTransactions, setPointTransactions] = useState<PointTransaction[]>([])
    const [pointsLoading, setPointsLoading] = useState(false)
    const [manualPointForm, setManualPointForm] = useState({ points: 5, category: 'discipline', description: '' })
    const [showManualForm, setShowManualForm] = useState(false)
    const [awardingPoints, setAwardingPoints] = useState(false)

    // Payroll tab state — seeded straight from `member` (already returned by GET
    // /api/members, no separate fetch needed). Held as strings so an emptied "0" field
    // doesn't immediately snap back (same pattern as the Salary Sheet's amount inputs).
    const [payrollForm, setPayrollForm] = useState({
        basic_salary: String(member?.payroll_basic_salary ?? 0),
        basic_salary_effective_month: member?.basic_salary_effective_month || '',
        transportation_bill: String(member?.payroll_transportation_bill ?? 0),
        snacks_bill: String(member?.payroll_snacks_bill ?? 0),
        increment_amount: String(member?.salary_increment_amount ?? 0),
        increment_effective_month: member?.salary_increment_effective_month || '',
    })
    const [savingPayroll, setSavingPayroll] = useState(false)
    const [payrollError, setPayrollError] = useState('')

    // Festival Bonus tab state
    const [festivalBonusForm, setFestivalBonusForm] = useState({
        percentage: String(member?.festival_bonus_percentage ?? 0),
        months: member?.festival_bonus_months || [] as number[],
    })

    // Load features and permissions when switching to access tab
    useEffect(() => {
        if (activeTab === 'access' && isEdit && member) {
            setAccessLoading(true)
            Promise.all([
                fetch('/api/features').then(r => r.json()),
                fetch(`/api/permissions?employee_id=${member.id}`).then(r => r.json()),
            ]).then(([featData, permData]) => {
                // Build slug -> id map from all features
                const slugToId: Record<string, string> = {}
                if (Array.isArray(featData)) {
                    featData.forEach((f: Feature) => { slugToId[f.slug] = f.id })
                }
                setFeatureSlugToId(slugToId)
                // Build slug -> access_level map for this member
                const map: Record<string, 'admin' | 'member' | 'no_access'> = {}
                if (Array.isArray(permData)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    permData.forEach((p: any) => {
                        const slug = Array.isArray(p.feature) ? p.feature[0]?.slug : p.feature?.slug
                        if (slug) map[slug] = p.access_level
                    })
                }
                setAccessMap(map)
                setAccessLoading(false)
            }).catch(() => setAccessLoading(false))
        }

        // Fetch logs
        if (activeTab === 'logs' && isEdit && member) {
            setLogsLoading(true)
            fetch(`/api/activity-log?actor_id=${member.id}`).then(r => r.json()).then(data => {
                if (Array.isArray(data)) setLogs(data)
                setLogsLoading(false)
            }).catch(() => setLogsLoading(false))
        }

        // Fetch performance
        if (activeTab === 'performance' && isEdit && member) {
            setPerfLoading(true)
            const now = new Date()
            const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
            const today = now.toISOString().split('T')[0]
            Promise.all([
                fetch(`/api/reports/monthly?month=${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).then(r => r.json()),
                fetch(`/api/activity-log?actor_id=${member.id}&module=problems`).then(r => r.json()),
                fetch(`/api/attendance?employee_id=${member.id}&start_date=${monthStart}&end_date=${today}`).then(r => r.json()).catch(() => []),
            ]).then(([reportData, problemLogs, attendanceData]) => {
                const empReport = reportData?.employees?.find((e: { employee_id: string }) => e.employee_id === member.id)
                const solveCount = Array.isArray(problemLogs) ? problemLogs.filter((l: LogEntry) => l.action === 'solve').length : 0
                const attendanceDays = Array.isArray(attendanceData) ? attendanceData.length : 0
                const workingDays = Math.max(1, Math.floor((now.getTime() - new Date(monthStart).getTime()) / (1000 * 60 * 60 * 24)) + 1)
                setPerfStats({
                    orders: empReport?.total_orders || 0,
                    amount: empReport?.total_amount || 0,
                    deliveryRate: empReport?.delivery_rate || 0,
                    attendance: Math.round((attendanceDays / workingDays) * 100),
                    points: empReport?.total_points || 0,
                    problemsSolved: solveCount,
                })
                setPerfLoading(false)
            }).catch(() => setPerfLoading(false))
        }

        // Fetch point transactions
        if (activeTab === 'points' && isEdit && member) {
            setPointsLoading(true)
            fetch(`/api/points?employee_id=${member.id}&limit=100`)
                .then(r => r.json())
                .then(data => {
                    if (Array.isArray(data)) setPointTransactions(data)
                    setPointsLoading(false)
                })
                .catch(() => setPointsLoading(false))
        }
    }, [activeTab, isEdit, member])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        if (!form.name.trim()) {
            setError('Name is required')
            setLoading(false)
            return
        }

        if (!isEdit && !form.email.trim()) {
            setError('Email is required for new members')
            setLoading(false)
            return
        }

        try {
            const url = isEdit ? `/api/members/${member.id}` : '/api/members'
            const method = isEdit ? 'PATCH' : 'POST'

            const body = isEdit
                ? {
                    employee_id: form.employee_id || null,
                    name: form.name,
                    designation: form.designation || null,
                    personal_contact: form.personal_contact || null,
                    whatsapp_number: form.whatsapp_number || null,
                    address: form.address || null,
                    nid_no: form.nid_no || null,
                    blood_group: form.blood_group || null,
                    family_contact_1: form.family_contact_1 || null,
                    family_contact_2: form.family_contact_2 || null,
                    department_id: form.department_id || null,
                    role_id: form.role_id || null,
                    joining_date: form.joining_date || null,
                    gender: form.gender || null,
                    date_of_birth: form.date_of_birth || null,
                    duty_start_time: form.duty_start_time || null,
                    duty_end_time: form.duty_end_time || null,
                    cv_url: form.cv_url || null,
                    avatar_url: form.avatar_url || null,
                }
                : form

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Something went wrong')
                setLoading(false)
                return
            }

            onSave()
        } catch {
            setError('Network error. Please try again.')
            setLoading(false)
        }
    }

    // Set page access by slug - auto-creates feature record if not in DB yet
    const setPageAccess = async (slug: string, level: 'no_access' | 'member' | 'admin') => {
        if (!member) return
        setAccessMap(prev => ({ ...prev, [slug]: level }))

        // Ensure feature exists in DB for this slug
        let featureId = featureSlugToId[slug]
        if (!featureId) {
            // Upsert the feature for this page slug - always returns the id (no conflict errors)
            const pageDef = PAGE_DEFINITIONS.flatMap(s => s.pages).find(p => p.slug === slug)
            const createRes = await fetch('/api/features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: pageDef?.name || slug, category: 'Pages', slug }),
            })
            if (!createRes.ok) return
            const feat = await createRes.json()
            featureId = feat.id
            setFeatureSlugToId(prev => ({ ...prev, [slug]: featureId }))
        }

        await fetch('/api/permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                permissions: [{ employee_id: member.id, feature_id: featureId, access_level: level }],
            }),
        })
    }

    // Scoped to whoever is currently editing — a plain Admin never sees the superOnly (Finance,
    // Payroll Management) slugs at all, so they're excluded from every count shown to them too,
    // not just hidden from the list below.
    const visiblePageSlugs = PAGE_DEFINITIONS.flatMap(s => s.pages.filter(p => !p.superOnly || isSuperAdmin).map(p => p.slug))
    const accessCount = visiblePageSlugs.filter(slug => accessMap[slug] && accessMap[slug] !== 'no_access').length

    const sectionStyle: React.CSSProperties = { marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--color-border-light)' }
    const sectionTitle: React.CSSProperties = { fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.04em' }

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
                style={{ maxWidth: '1120px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="modal-header" style={{ flexShrink: 0 }}>
                    <h2 className="modal-title">{isEdit ? 'Edit Member' : 'Add New Member'}</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                {isEdit && (
                    <div className="member-modal-tabs" style={{ display: 'flex', gap: '2px', padding: '0 24px', flexShrink: 0, borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-bg-secondary)', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
                        {[
                            { key: 'profile' as const, label: 'Profile', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
                            { key: 'access' as const, label: 'Access', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg> },
                            { key: 'logs' as const, label: 'Logs', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg> },
                            { key: 'performance' as const, label: 'Performance', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg> },
                            { key: 'points' as const, label: 'Points', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
                            // Payroll & Bonus (Basic Salary/Increase/Transportation/Snacks plus
                            // Festival Bonus, all in one tab) is Super-Admin-only, both to show
                            // and to edit (server-side enforced too, see
                            // src/app/api/members/[id]/route.ts).
                            ...(isSuperAdmin ? [
                                { key: 'payroll' as const, label: 'Payroll & Bonus', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20" /></svg> },
                            ] : []),
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    position: 'relative',
                                    padding: '12px 20px',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '0.8125rem',
                                    fontWeight: activeTab === tab.key ? 600 : 400,
                                    color: activeTab === tab.key ? 'var(--color-primary, #2563EB)' : 'var(--color-text-tertiary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <span style={{ fontSize: '0.875rem' }}>{tab.icon}</span>
                                {tab.label}
                                {tab.key === 'access' && accessCount > 0 && (
                                    <span style={{
                                        fontSize: '0.625rem', fontWeight: 700,
                                        background: 'var(--color-primary, #2563EB)', color: '#fff',
                                        padding: '1px 6px', borderRadius: '10px', minWidth: '18px', textAlign: 'center',
                                    }}>
                                        {accessCount}
                                    </span>
                                )}
                                {activeTab === tab.key && (
                                    <motion.div
                                        layoutId="memberModalTab"
                                        style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', background: 'var(--color-primary, #2563EB)', borderRadius: '2px 2px 0 0' }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                )}

                <style jsx>{`
                    .member-modal-tabs::-webkit-scrollbar {
                        height: 4px;
                    }
                    .member-modal-tabs::-webkit-scrollbar-thumb {
                        background: var(--color-border-light);
                        border-radius: 4px;
                    }
                    .member-modal-tabs::-webkit-scrollbar-track {
                        background: transparent;
                    }
                `}</style>

                {/* Scrollable content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                    <AnimatePresence mode="wait">
                        {activeTab === 'profile' ? (
                            <motion.div key="profile" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                                <form id="member-form" onSubmit={handleSubmit}>
                                    {/* Avatar Upload */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--color-border-light)' }}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{
                                                width: '72px', height: '72px', borderRadius: '50%',
                                                overflow: 'hidden', border: '3px solid var(--color-border-light)',
                                                background: form.name ? (() => { const colors = ['#2563EB','#1D4ED8','#1E40AF','#3B82F6','#7C3AED','#059669']; return colors[form.name.charCodeAt(0) % colors.length] })() : '#E2E8F0',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', fontSize: '1.5rem', fontWeight: 700,
                                            }}>
                                                {form.avatar_url ? (
                                                    <img src={form.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    form.name ? form.name[0]?.toUpperCase() : '?'
                                                )}
                                            </div>
                                            <label style={{
                                                position: 'absolute', bottom: '-2px', right: '-2px',
                                                width: '26px', height: '26px', borderRadius: '50%',
                                                background: 'var(--color-primary, #2563EB)', border: '2px solid var(--color-bg-primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: avatarUploading ? 'wait' : 'pointer',
                                                transition: 'transform 0.15s',
                                            }}>
                                                {avatarUploading ? (
                                                    <div className="spinner" style={{ width: '12px', height: '12px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                                ) : (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                                                        <circle cx="12" cy="13" r="4" />
                                                    </svg>
                                                )}
                                                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                                                    disabled={avatarUploading}
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0]
                                                        if (!file) return
                                                        setAvatarUploading(true)
                                                        try {
                                                            const fd = new FormData()
                                                            fd.append('file', file)
                                                            fd.append('bucket', 'avatars')
                                                            fd.append('folder', 'members')
                                                            if (member?.id) fd.append('employee_id', member.id)
                                                            const res = await fetch('/api/upload', { method: 'POST', body: fd })
                                                            const data = await res.json()
                                                            if (data.url) setForm(prev => ({ ...prev, avatar_url: data.url }))
                                                            else setError(data.error || 'Upload failed')
                                                        } catch { setError('Upload failed') }
                                                        finally { setAvatarUploading(false) }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{form.name || 'New Member'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>Click the camera icon to upload a photo</div>
                                            {form.avatar_url && (
                                                <button type="button" onClick={() => setForm(prev => ({ ...prev, avatar_url: '' }))}
                                                    style={{ fontSize: '0.6875rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px', padding: 0 }}>
                                                    Remove photo
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Section: Basic Info */}
                                    <div style={sectionStyle}>
                                        <div style={sectionTitle}>Basic Information</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="name">Full Name *</label>
                                                <input className="input" id="name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Fahmida Islam" required />
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="employee_id">Employee ID</label>
                                                <input className="input" id="employee_id" name="employee_id" value={form.employee_id} onChange={handleChange} placeholder="e.g. 101" />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="gender">Gender</label>
                                                <select className="input" id="gender" name="gender" value={form.gender} onChange={handleChange}>
                                                    <option value="">Select</option>
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="date_of_birth">Date of Birth</label>
                                                <input className="input" id="date_of_birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} />
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="joining_date">Joining Date</label>
                                                <input className="input" id="joining_date" name="joining_date" type="date" value={form.joining_date} onChange={handleChange} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section: Account */}
                                    <div style={sectionStyle}>
                                        <div style={sectionTitle}>Account</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="email">Email {!isEdit && '*'}</label>
                                                <input className="input" id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" required={!isEdit} disabled={isEdit} style={isEdit ? { opacity: 0.6, cursor: 'not-allowed' } : {}} />
                                            </div>
                                            {!isEdit && (
                                                <div className="input-group">
                                                    <label className="input-label" htmlFor="password">Password</label>
                                                    <input className="input" id="password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Default: Teamtrack@2026" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Section: Role & Department */}
                                    <div style={sectionStyle}>
                                        <div style={sectionTitle}>Organization</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="role_id">Role</label>
                                                <select className="input" id="role_id" name="role_id" value={form.role_id} onChange={handleChange}>
                                                    <option value="">Select</option>
                                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="department_id">Department</label>
                                                <select className="input" id="department_id" name="department_id" value={form.department_id} onChange={handleChange}>
                                                    <option value="">Select</option>
                                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="designation">Designation</label>
                                                <input className="input" id="designation" name="designation" value={form.designation} onChange={handleChange} placeholder="e.g. Sr. Sales" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section: Schedule */}
                                    <div style={sectionStyle}>
                                        <div style={sectionTitle}>Duty Schedule</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="duty_start_time">Start Time</label>
                                                <input className="input" id="duty_start_time" name="duty_start_time" type="time" value={form.duty_start_time} onChange={handleChange} />
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="duty_end_time">End Time</label>
                                                <input className="input" id="duty_end_time" name="duty_end_time" type="time" value={form.duty_end_time} onChange={handleChange} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section: Contact */}
                                    <div style={sectionStyle}>
                                        <div style={sectionTitle}>Contact</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="personal_contact">Phone</label>
                                                <input className="input" id="personal_contact" name="personal_contact" value={form.personal_contact} onChange={handleChange} placeholder="01XXXXXXXXX" />
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="whatsapp_number">WhatsApp</label>
                                                <input className="input" id="whatsapp_number" name="whatsapp_number" value={form.whatsapp_number} onChange={handleChange} placeholder="01XXXXXXXXX" />
                                            </div>
                                            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                                <label className="input-label" htmlFor="address">Address</label>
                                                <input className="input" id="address" name="address" value={form.address} onChange={handleChange} placeholder="Full address" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section: Documents */}
                                    <div style={sectionStyle}>
                                        <div style={sectionTitle}>Documents</div>
                                        <div className="input-group">
                                            <label className="input-label" htmlFor="cv_url">CV / Document URL</label>
                                            <input className="input" id="cv_url" name="cv_url" value={form.cv_url} onChange={handleChange} placeholder="https://drive.google.com/... or upload link" />
                                            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '2px', display: 'block' }}>Paste a link to the CV or uploaded document</span>
                                        </div>
                                    </div>

                                    {/* Section: Personal Details */}
                                    <div style={sectionStyle}>
                                        <div style={sectionTitle}>Personal Details</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="nid_no">NID No.</label>
                                                <input className="input" id="nid_no" name="nid_no" value={form.nid_no} onChange={handleChange} />
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="blood_group">Blood Group</label>
                                                <select className="input" id="blood_group" name="blood_group" value={form.blood_group} onChange={handleChange}>
                                                    <option value="">Select</option>
                                                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                                        <option key={bg} value={bg}>{bg}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section: Family Contacts */}
                                    <div style={sectionStyle}>
                                        <div style={sectionTitle}>Emergency Contacts</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="family_contact_1">Contact 1</label>
                                                <input className="input" id="family_contact_1" name="family_contact_1" value={form.family_contact_1} onChange={handleChange} placeholder="01XXXXXXXXX" />
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label" htmlFor="family_contact_2">Contact 2</label>
                                                <input className="input" id="family_contact_2" name="family_contact_2" value={form.family_contact_2} onChange={handleChange} placeholder="01XXXXXXXXX" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Error */}
                                    {error && (
                                        <div style={{
                                            padding: '10px 14px', borderRadius: '10px', fontSize: '0.8125rem',
                                            background: '#E0EAFF', color: '#1E3A5F', marginBottom: '16px'
                                        }}>
                                            {error}
                                        </div>
                                    )}
                                </form>
                            </motion.div>
                        ) : activeTab === 'access' ? (
                            <motion.div key="access" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                                {/* Access Summary Banner */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '14px 18px', borderRadius: '14px', marginBottom: '20px',
                                    background: 'linear-gradient(135deg, rgba(37,99,235,0.07) 0%, rgba(37,99,235,0.02) 100%)',
                                    border: '1px solid rgba(37,99,235,0.12)',
                                    flexWrap: 'wrap', gap: '10px',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pages Accessible</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary, #2563EB)', lineHeight: 1 }}>{accessCount}</span>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>/ {visiblePageSlugs.length} pages</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {([
                                            { label: 'No Access', color: '#94A3B8', count: visiblePageSlugs.filter(s => !accessMap[s] || accessMap[s] === 'no_access').length },
                                            { label: 'Member', color: '#2563EB', count: visiblePageSlugs.filter(s => accessMap[s] === 'member').length },
                                            { label: 'Admin', color: '#059669', count: visiblePageSlugs.filter(s => accessMap[s] === 'admin').length },
                                        ] as const).map(stat => (
                                            <div key={stat.label} style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                padding: '6px 10px', borderRadius: '8px',
                                                background: stat.count > 0 ? stat.color + '10' : 'var(--color-surface)',
                                                border: `1px solid ${stat.count > 0 ? stat.color + '25' : 'var(--color-border-light)'}`,
                                                minWidth: '42px',
                                            }}>
                                                <span style={{ fontSize: '1rem', fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.count}</span>
                                                <span style={{ fontSize: '0.5625rem', color: 'var(--color-text-tertiary)', marginTop: '2px', fontWeight: 500 }}>{stat.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Admin-only notice */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '9px 12px', borderRadius: '9px', marginBottom: '18px',
                                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
                                    fontSize: '0.75rem', color: '#B45309',
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                    <span><strong>Members, Attendance, Reports</strong> are admin-only , not configurable per member.</span>
                                </div>

                                {accessLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '11px', border: '1px solid var(--color-border-light)' }}>
                                                <div className="skeleton" style={{ width: 36, height: 20, borderRadius: '10px', flexShrink: 0 }} />
                                                <div style={{ flex: 1 }}><div className="skeleton" style={{ width: '50%', height: 13, marginBottom: 5 }} /><div className="skeleton" style={{ width: '70%', height: 11 }} /></div>
                                                <div className="skeleton" style={{ width: 64, height: 24, borderRadius: '8px', flexShrink: 0 }} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {PAGE_DEFINITIONS.map(section => {
                                            const visiblePages = section.pages.filter(p => !p.superOnly || isSuperAdmin)
                                            const sectionGranted = visiblePages.filter(p => accessMap[p.slug] && accessMap[p.slug] !== 'no_access').length
                                            return (
                                                <div key={section.section}>
                                                    {/* Section Header */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                        <div style={{
                                                            fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-tertiary)',
                                                            textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
                                                        }}>
                                                            {section.section}
                                                        </div>
                                                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border-light)' }} />
                                                        <div style={{
                                                            fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
                                                            background: sectionGranted > 0 ? 'rgba(37,99,235,0.1)' : 'var(--color-surface)',
                                                            color: sectionGranted > 0 ? 'var(--color-primary, #2563EB)' : 'var(--color-text-tertiary)',
                                                            border: `1px solid ${sectionGranted > 0 ? 'rgba(37,99,235,0.2)' : 'var(--color-border-light)'}`,
                                                        }}>
                                                            {sectionGranted}/{visiblePages.length}
                                                        </div>
                                                    </div>

                                                    {/* Page Cards - 2 per row */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {visiblePages.map(page => {
                                                            const level = accessMap[page.slug] || 'no_access'
                                                            const isOn = level !== 'no_access'
                                                            const isAdminLevel = level === 'admin'
                                                            const canEdit = isAdmin || isSuperAdmin
                                                            const accentColor = isAdminLevel ? '#059669' : 'var(--color-primary, #2563EB)'
                                                            const accentRgb = isAdminLevel ? '5,150,105' : '37,99,235'

                                                            const handleToggle = (e: React.MouseEvent) => {
                                                                e.stopPropagation()
                                                                if (!canEdit) return
                                                                setPageAccess(page.slug, isOn ? 'no_access' : 'member')
                                                            }

                                                            const handleRoleClick = (e: React.MouseEvent) => {
                                                                e.stopPropagation()
                                                                if (!canEdit || !isOn) return
                                                                setPageAccess(page.slug, level === 'member' ? 'admin' : 'member')
                                                            }

                                                            return (
                                                                <div
                                                                    key={page.slug}
                                                                    style={{
                                                                        borderRadius: '12px',
                                                                        border: `1px solid ${isOn ? `rgba(${accentRgb},0.2)` : 'var(--color-border-light)'}`,
                                                                        background: isOn ? `rgba(${accentRgb},0.04)` : 'var(--color-surface)',
                                                                        overflow: 'hidden',
                                                                        transition: 'all 0.2s ease',
                                                                    }}
                                                                >
                                                                    {/* Card top bar - accent line when on */}
                                                                    {isOn && (
                                                                        <div style={{
                                                                            height: '3px',
                                                                            background: `linear-gradient(90deg, ${accentColor}, transparent)`,
                                                                        }} />
                                                                    )}

                                                                    <div style={{ padding: '12px 14px' }}>
                                                                        {/* Row 1: name + toggle */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                                            <div style={{
                                                                                fontSize: '0.875rem', fontWeight: isOn ? 600 : 500,
                                                                                color: isOn ? accentColor : 'var(--color-text-secondary)',
                                                                                transition: 'all 0.15s',
                                                                            }}>
                                                                                {page.name}
                                                                            </div>
                                                                            {/* Toggle */}
                                                                            <button
                                                                                onClick={handleToggle}
                                                                                disabled={!canEdit}
                                                                                aria-label={isOn ? `Disable ${page.name}` : `Enable ${page.name}`}
                                                                                style={{
                                                                                    position: 'relative', flexShrink: 0,
                                                                                    width: '32px', height: '18px', borderRadius: '9px', border: 'none',
                                                                                    padding: 0,
                                                                                    background: isOn ? accentColor : '#CBD5E1',
                                                                                    transition: 'background 0.2s ease',
                                                                                    cursor: canEdit ? 'pointer' : 'not-allowed',
                                                                                    boxShadow: isOn ? `0 2px 6px rgba(${accentRgb},0.35)` : 'none',
                                                                                }}
                                                                            >
                                                                                <div style={{
                                                                                    position: 'absolute', top: '2px',
                                                                                    left: isOn ? '16px' : '2px',
                                                                                    width: '14px', height: '14px', borderRadius: '50%',
                                                                                    background: '#fff',
                                                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                                                                    transition: 'left 0.2s ease',
                                                                                    pointerEvents: 'none',
                                                                                }} />
                                                                            </button>
                                                                        </div>

                                                                        {/* Row 2: desc + role badge */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                                                            <div style={{
                                                                                fontSize: '0.6875rem',
                                                                                color: 'var(--color-text-tertiary)',
                                                                                lineHeight: 1.4,
                                                                                flex: 1, minWidth: 0,
                                                                            }}>
                                                                                {page.desc}
                                                                            </div>
                                                                            {isOn && (
                                                                                <button
                                                                                    onClick={handleRoleClick}
                                                                                    disabled={!canEdit}
                                                                                    title={canEdit ? 'Click to toggle Member / Admin' : undefined}
                                                                                    style={{
                                                                                        padding: '3px 8px', borderRadius: '6px', border: 'none',
                                                                                        fontSize: '0.625rem', fontWeight: 700, flexShrink: 0,
                                                                                        cursor: canEdit ? 'pointer' : 'default',
                                                                                        background: isAdminLevel ? 'rgba(5,150,105,0.15)' : 'rgba(37,99,235,0.1)',
                                                                                        color: accentColor,
                                                                                        letterSpacing: '0.04em', transition: 'all 0.15s',
                                                                                        textTransform: 'uppercase',
                                                                                    }}
                                                                                >
                                                                                    {isAdminLevel ? 'Admin' : 'Member'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {!(isAdmin || isSuperAdmin) && (
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                        View-only - admin access required to change permissions
                                    </div>
                                )}
                            </motion.div>


                        ) : activeTab === 'logs' ? (
                            <motion.div key="logs" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                                {logsLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                                                <div style={{ flex: 1 }}>
                                                    <div className="skeleton" style={{ width: '70%', height: 12, marginBottom: 6 }} />
                                                    <div className="skeleton" style={{ width: '40%', height: 10 }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-tertiary)' }}>
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.4 }}><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>No activity recorded yet</div>
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Actions will appear here as the member uses the system.</div>
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative', paddingLeft: '24px' }}>
                                        {/* Timeline line */}
                                        <div style={{ position: 'absolute', left: '9px', top: '4px', bottom: '4px', width: '2px', background: 'var(--color-border-light)' }} />
                                        {logs.map((log, idx) => {
                                            const actionConfig: Record<string, { label: string; color: string; icon: string }> = {
                                                created: { label: 'Created', color: '#2563EB', icon: '+' },
                                                status_change: { label: 'Status changed', color: '#F59E0B', icon: '↻' },
                                                priority_change: { label: 'Priority changed', color: '#7C3AED', icon: '⬆' },
                                                pick: { label: 'Picked problem', color: '#F59E0B', icon: '👁' },
                                                unpick: { label: 'Unpicked', color: '#94A3B8', icon: ',' },
                                                solve: { label: 'Solved problem', color: '#10B981', icon: '✓' },
                                                updated: { label: 'Updated', color: '#3B82F6', icon: '✎' },
                                                deleted: { label: 'Deleted', color: '#DC2626', icon: '✕' },
                                            }
                                            const ac = actionConfig[log.action] || { label: log.action, color: '#94A3B8', icon: '•' }
                                            const time = new Date(log.created_at)
                                            const timeStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

                                            return (
                                                <div key={log.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: idx === logs.length - 1 ? 0 : '16px', position: 'relative' }}>
                                                    {/* Dot */}
                                                    <div style={{ position: 'absolute', left: '-24px', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: ac.color + '15', border: `2px solid ${ac.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5625rem', color: ac.color, fontWeight: 700, zIndex: 1 }}>
                                                        {ac.icon}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: ac.color }}>{ac.label}</span>
                                                            <span style={{ fontSize: '0.6875rem', padding: '1px 8px', borderRadius: '4px', background: 'var(--color-surface)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border-light)' }}>{log.module}</span>
                                                        </div>
                                                        {(log.old_value || log.new_value) && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                                {log.old_value && log.new_value ? (
                                                                    <>{log.old_value} <span style={{ color: 'var(--color-text-tertiary)' }}>→</span> {log.new_value}</>
                                                                ) : log.new_value ? log.new_value : log.old_value}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '3px' }}>{timeStr}</div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        ) : activeTab === 'performance' ? (
                            <motion.div key="performance" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                                    This Month&apos;s Performance
                                </div>
                                {perfLoading ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: '12px' }} />)}
                                    </div>
                                ) : perfStats ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {[
                                            { label: 'Orders', value: perfStats.orders, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><path d="M8 21h8" /><path d="M12 17v4" /></svg>, gradient: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02))', color: '#2563EB' },
                                            { label: 'Delivery Rate', value: `${perfStats.deliveryRate}%`, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>, gradient: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))', color: '#10B981' },
                                            { label: 'Attendance', value: `${perfStats.attendance}%`, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>, gradient: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))', color: '#F59E0B' },
                                            { label: 'Points Earned', value: perfStats.points, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>, gradient: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02))', color: '#2563EB' },
                                            { label: 'Amount', value: `৳${perfStats.amount.toLocaleString()}`, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>, gradient: 'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(5,150,105,0.02))', color: '#059669' },
                                            { label: 'Problems Solved', value: perfStats.problemsSolved, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>, gradient: 'linear-gradient(135deg, rgba(220,38,38,0.06), rgba(220,38,38,0.02))', color: '#DC2626' },
                                        ].map(stat => (
                                            <div key={stat.label} style={{
                                                padding: '14px 16px', borderRadius: '12px',
                                                background: stat.gradient,
                                                border: `1px solid ${stat.color}12`,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    {stat.icon}
                                                    <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</span>
                                                </div>
                                                <div style={{ fontSize: '1.375rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-tertiary)' }}>
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.4 }}><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>No performance data</div>
                                    </div>
                                )}
                            </motion.div>
                        ) : activeTab === 'points' ? (
                            <motion.div key="points" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                                {/* Total Points Banner */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '16px 20px', borderRadius: '14px', marginBottom: '20px',
                                    background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.02) 100%)',
                                    border: '1px solid rgba(37,99,235,0.12)',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Points</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary, #2563EB)' }}>
                                            {pointTransactions.reduce((sum, t) => sum + t.points, 0)}
                                        </div>
                                    </div>
                                    {(isAdmin || isSuperAdmin) && (
                                        <button
                                            onClick={() => setShowManualForm(!showManualForm)}
                                            className="btn btn-primary btn-sm"
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {showManualForm ? 'Cancel' : '+ Add Points'}
                                        </button>
                                    )}
                                </div>

                                {/* Manual Points Form */}
                                {showManualForm && (isAdmin || isSuperAdmin) && (
                                    <div style={{
                                        padding: '16px', borderRadius: '12px', marginBottom: '20px',
                                        border: '1px solid var(--color-border-light)', background: 'var(--color-surface)',
                                    }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>Award Manual Points</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                            <div className="input-group">
                                                <label className="input-label">Points</label>
                                                <input className="input" type="number" min="1" value={manualPointForm.points}
                                                    onChange={e => setManualPointForm(p => ({ ...p, points: parseInt(e.target.value) || 0 }))} />
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label">Category</label>
                                                <select className="input" value={manualPointForm.category}
                                                    onChange={e => setManualPointForm(p => ({ ...p, category: e.target.value }))}>
                                                    <option value="discipline">Discipline</option>
                                                    <option value="manners">Manners</option>
                                                    <option value="leadership">Leadership</option>
                                                    <option value="teamwork">Teamwork</option>
                                                    <option value="initiative">Initiative</option>
                                                    <option value="bonus">Bonus</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="input-group" style={{ marginBottom: '12px' }}>
                                            <label className="input-label">Note (optional)</label>
                                            <input className="input" placeholder="Reason for awarding points..."
                                                value={manualPointForm.description}
                                                onChange={e => setManualPointForm(p => ({ ...p, description: e.target.value }))} />
                                        </div>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            disabled={awardingPoints || manualPointForm.points <= 0}
                                            style={{ fontSize: '0.75rem' }}
                                            onClick={async () => {
                                                if (!member) return
                                                setAwardingPoints(true)
                                                try {
                                                    const res = await fetch('/api/points', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            employee_id: member.id,
                                                            points: manualPointForm.points,
                                                            source: 'manual',
                                                            category: manualPointForm.category,
                                                            description: manualPointForm.description || `Manual: ${manualPointForm.category} (+${manualPointForm.points})`,
                                                        }),
                                                    })
                                                    if (res.ok) {
                                                        // Refresh transactions
                                                        const txRes = await fetch(`/api/points?employee_id=${member.id}&limit=100`)
                                                        const txData = await txRes.json()
                                                        if (Array.isArray(txData)) setPointTransactions(txData)
                                                        setManualPointForm({ points: 5, category: 'discipline', description: '' })
                                                        setShowManualForm(false)
                                                    }
                                                } catch { /* */ }
                                                finally { setAwardingPoints(false) }
                                            }}
                                        >
                                            {awardingPoints ? 'Awarding...' : `Award ${manualPointForm.points} Points`}
                                        </button>
                                    </div>
                                )}

                                {/* Points by Source Summary */}
                                {!pointsLoading && pointTransactions.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                        {Object.entries(
                                            pointTransactions.reduce<Record<string, number>>((acc, t) => {
                                                acc[t.source] = (acc[t.source] || 0) + t.points
                                                return acc
                                            }, {})
                                        ).map(([source, pts]) => {
                                            const sourceColors: Record<string, string> = {
                                                order: '#2563EB', task: '#10B981', courier: '#F59E0B',
                                                idea: '#7C3AED', manual: '#DC2626', problem: '#059669',
                                            }
                                            return (
                                                <span key={source} style={{
                                                    fontSize: '0.6875rem', fontWeight: 600, padding: '4px 10px',
                                                    borderRadius: '8px', background: (sourceColors[source] || '#94A3B8') + '12',
                                                    color: sourceColors[source] || '#94A3B8',
                                                    border: `1px solid ${(sourceColors[source] || '#94A3B8')}20`,
                                                }}>
                                                    {source}: {pts}
                                                </span>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Point History */}
                                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>History</div>
                                {pointsLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: '10px' }} />)}
                                    </div>
                                ) : pointTransactions.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-tertiary)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⭐</div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>No points yet</div>
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Points will appear as they are earned or awarded.</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                                        {pointTransactions.map(tx => {
                                            const sourceColors: Record<string, string> = {
                                                order: '#2563EB', task: '#10B981', courier: '#F59E0B',
                                                idea: '#7C3AED', manual: '#DC2626', problem: '#059669',
                                            }
                                            const sourceIcons: Record<string, string> = {
                                                order: '📦', task: '✅', courier: '🚚',
                                                idea: '💡', manual: '🎯', problem: '🔧',
                                            }
                                            const color = sourceColors[tx.source] || '#94A3B8'
                                            const time = new Date(tx.created_at)
                                            return (
                                                <div key={tx.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    padding: '10px 14px', borderRadius: '10px',
                                                    border: '1px solid var(--color-border-light)',
                                                    background: 'var(--color-surface)',
                                                }}>
                                                    <span style={{ fontSize: '1.125rem' }}>{sourceIcons[tx.source] || '•'}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                            {tx.description || tx.source}
                                                        </div>
                                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: '1px' }}>
                                                            {time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                            {tx.awarder?.name && <> · by {tx.awarder.name}</>}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.875rem', fontWeight: 700, color,
                                                        padding: '3px 10px', borderRadius: '8px',
                                                        background: color + '10',
                                                    }}>
                                                        +{tx.points}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        ) : activeTab === 'payroll' ? (
                            <motion.div key="payroll" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '16px', lineHeight: 1.5 }}>
                                   
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        {/* <div style={{ fontSize: '0.8125rem', fontWeight: 900, marginBottom: '12px' }}>Salary Section</div> */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
                                            <div className="input-group">
                                                <label className="input-label">Basic Salary (৳)</label>
                                                <input className="input" type="number" min="0" value={payrollForm.basic_salary}
                                                    onFocus={e => e.target.select()}
                                                    onChange={e => setPayrollForm(p => ({ ...p, basic_salary: e.target.value }))} />
                                            </div>
                                            <div style={{ gridRow: '1 / 3', gridColumn: '2', display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px', borderRadius: '10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                                                {/* <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                                                    Optional raise added on top of Basic Salary starting from the selected month (and every month after) — leave the month empty to keep no increment active.
                                                </div> */}
                                                <div className="input-group">
                                                    <label className="input-label">Increase Salary (৳)</label>
                                                    <input className="input" type="number" min="0" value={payrollForm.increment_amount}
                                                        onFocus={e => e.target.select()}
                                                        onChange={e => setPayrollForm(p => ({ ...p, increment_amount: e.target.value }))} />
                                                </div>
                                                <div className="input-group">
                                                    <label className="input-label">Increase Salary Starting Month</label>
                                                    <input className="input" type="month" value={payrollForm.increment_effective_month}
                                                        onChange={e => setPayrollForm(p => ({ ...p, increment_effective_month: e.target.value }))} />
                                                </div>
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label">Basic Salary Starting Month *</label>
                                                <input className="input" type="month" required value={payrollForm.basic_salary_effective_month}
                                                    onChange={e => { setPayrollForm(p => ({ ...p, basic_salary_effective_month: e.target.value })); setPayrollError('') }} />
                                                {/* <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                                                    Basic Salary only appears in Salary Sheets for this month onward. Sheets for earlier months show ৳0 Basic Salary for this employee.
                                                </div> */}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                        <div className="input-group">
                                            <label className="input-label">Transportation Bill (৳)</label>
                                            <input className="input" type="number" min="0" value={payrollForm.transportation_bill}
                                                onFocus={e => e.target.select()}
                                                onChange={e => setPayrollForm(p => ({ ...p, transportation_bill: e.target.value }))} />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">Snacks Bill (৳)</label>
                                            <input className="input" type="number" min="0" value={payrollForm.snacks_bill}
                                                onFocus={e => e.target.select()}
                                                onChange={e => setPayrollForm(p => ({ ...p, snacks_bill: e.target.value }))} />
                                        </div>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '20px' }}>
                                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '12px' }}>Festival Bonus</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '16px', lineHeight: 1.5 }}>
                                            Festival Bonus = this percentage × Basic Salary, automatically included in the Salary Sheet only for the calendar months selected below (every year).
                                        </div>
                                        <div className="input-group" style={{ marginBottom: '16px' }}>
                                            <label className="input-label">Bonus Percentage (%)</label>
                                            <input className="input" type="number" min="0" max="100" value={festivalBonusForm.percentage}
                                                onFocus={e => e.target.select()}
                                                onChange={e => setFestivalBonusForm(p => ({ ...p, percentage: e.target.value }))} />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">Applies In</label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                {MONTHS.map(m => {
                                                    const checked = festivalBonusForm.months.includes(m.value)
                                                    return (
                                                        <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${checked ? 'var(--color-primary, #2563EB)' : 'var(--color-border-light)'}`, background: checked ? 'rgba(37,99,235,0.08)' : 'transparent', cursor: 'pointer', fontSize: '0.8125rem' }}>
                                                            <input type="checkbox" checked={checked} onChange={e => {
                                                                const next = e.target.checked
                                                                    ? [...festivalBonusForm.months, m.value]
                                                                    : festivalBonusForm.months.filter(v => v !== m.value)
                                                                setFestivalBonusForm(p => ({ ...p, months: next }))
                                                            }} />
                                                            {m.label}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {payrollError && (
                                        <div style={{
                                            padding: '10px 14px', borderRadius: '10px', fontSize: '0.8125rem',
                                            background: '#FEE2E2', color: '#991B1B',
                                        }}>
                                            {payrollError}
                                        </div>
                                    )}
                                    <button
                                        className="btn btn-primary"
                                        disabled={savingPayroll}
                                        style={{ alignSelf: 'flex-end' }}
                                        onClick={async () => {
                                            if (!member) return
                                            if (!payrollForm.basic_salary_effective_month) {
                                                setPayrollError('Basic Salary Starting Month is required')
                                                return
                                            }
                                            setPayrollError('')
                                            setSavingPayroll(true)
                                            try {
                                                const res = await fetch(`/api/members/${member.id}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        payroll_basic_salary: Math.max(0, Number(payrollForm.basic_salary) || 0),
                                                        basic_salary_effective_month: payrollForm.basic_salary_effective_month,
                                                        payroll_transportation_bill: Math.max(0, Number(payrollForm.transportation_bill) || 0),
                                                        payroll_snacks_bill: Math.max(0, Number(payrollForm.snacks_bill) || 0),
                                                        salary_increment_amount: Math.max(0, Number(payrollForm.increment_amount) || 0),
                                                        salary_increment_effective_month: payrollForm.increment_effective_month || null,
                                                        festival_bonus_percentage: Math.max(0, Number(festivalBonusForm.percentage) || 0),
                                                        festival_bonus_months: festivalBonusForm.months,
                                                    }),
                                                })
                                                if (res.ok) onSave()
                                                else {
                                                    const data = await res.json()
                                                    setPayrollError(data.error || 'Failed to save payroll settings')
                                                }
                                            } finally {
                                                setSavingPayroll(false)
                                            }
                                        }}
                                    >
                                        {savingPayroll ? 'Saving...' : 'Save Payroll & Bonus Settings'}
                                    </button>
                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                {activeTab === 'profile' && (
                    <div className="modal-footer" style={{ flexShrink: 0, flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                        {/* Reset Password (only for existing members, admin only) */}
                        {isEdit && isAdmin && (
                            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
                                {!showResetPwdForm ? (
                                    <button type="button" className="btn btn-ghost btn-sm"
                                        onClick={() => setShowResetPwdForm(true)}
                                        style={{ color: '#F59E0B', fontSize: '0.8125rem' }}>
                                        🔑 Reset Member Password
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            className="input" type="password"
                                            placeholder="New password (min 8 chars)"
                                            value={resetPassword}
                                            onChange={e => setResetPassword(e.target.value)}
                                            style={{ flex: 1, fontSize: '0.875rem' }}
                                        />
                                        <button type="button" className="btn btn-sm"
                                            onClick={handleResetPassword}
                                            disabled={resetPwdLoading || resetPassword.length < 8}
                                            style={{ background: '#F59E0B', color: '#fff', border: 'none', flexShrink: 0 }}>
                                            {resetPwdLoading ? '...' : 'Set'}
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm"
                                            onClick={() => { setShowResetPwdForm(false); setResetPassword(''); setResetPwdMsg('') }}
                                            style={{ flexShrink: 0 }}>Cancel</button>
                                    </div>
                                )}
                                {resetPwdMsg && (
                                    <div style={{ fontSize: '0.75rem', marginTop: '4px', color: resetPwdMsg.includes('success') ? '#16A34A' : '#DC2626' }}>
                                        {resetPwdMsg}
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" form="member-form" className="btn btn-primary" disabled={loading}>
                                {loading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="spinner" style={{ width: '16px', height: '16px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                        {isEdit ? 'Saving...' : 'Creating...'}
                                    </span>
                                ) : (
                                    isEdit ? 'Save Changes' : 'Create Member'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    )
}
