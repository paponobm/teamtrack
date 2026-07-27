'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'

interface ProfileData {
    id: string
    name: string
    email: string
    employee_id: string
    designation: string
    personal_contact: string
    whatsapp_number: string
    address: string
    blood_group: string
    date_of_birth: string
    gender: string
    joining_date: string
    avatar_url: string | null
    family_contact_1: string
    family_contact_2: string
    is_active: boolean
    role: { id: string; name: string; level: number } | null
    department: { id: string; name: string } | null
    total_points: number
}

interface Transaction {
    id: string
    points: number
    source: string
    description: string
    created_at: string
    employee?: { id: string; name: string; avatar_url: string | null } | null
    granted_by_user?: { id: string; name: string } | null
}

interface LeaderboardMember {
    id: string
    name: string
    avatar_url: string | null
    total_points: number
    designation: string
}

interface WithdrawalRequest {
    id: string
    amount: number
    status: string
    requested_at: string
    processed_at: string | null
    employee: { name: string; email: string; avatar_url: string | null } | null
    processor: { name: string } | null
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const itemAnim = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#7C3AED', '#059669']
    return colors[name.charCodeAt(0) % colors.length]
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ fontSize: '0.9375rem', color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontWeight: value ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value || 'Not set'}
            </div>
        </div>
    )
}

function renderSourceIcon(source: string) {
    switch(source) {
        case 'facebook': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(24,119,242,0.1)', color: '#1877F2' }}>Facebook</span>
        case 'whatsapp': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(37,211,102,0.1)', color: '#25D366' }}>WhatsApp</span>
        case 'instagram': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(225,48,108,0.1)', color: '#E1306C' }}>Instagram</span>
        case 'tiktok': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(0,0,0,0.1)', color: 'var(--color-text-primary)' }}>TikTok</span>
        case 'web': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>Web</span>
        case 'order': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>Order</span>
        case 'task': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(124,58,237,0.1)', color: '#7C3AED' }}>Task</span>
        case 'courier': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>Courier</span>
        case 'idea': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(236,72,153,0.1)', color: '#EC4899' }}>Idea</span>
        case 'problem': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>Problem</span>
        case 'withdrawal': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>Withdrawal</span>
        case 'manual': return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>Manual</span>
        default: return <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>{source}</span>
    }
}

export default function MyProfilePage() {
    const { data: perms } = usePermissions()
    const isAdmin = perms?.is_super || perms?.is_admin
    const toast = useToast()

    const [mainTab, setMainTab] = useState<'profile' | 'performance'>('profile')
    const [perfTab, setPerfTab] = useState<'leaderboard' | 'history' | 'withdrawals'>('leaderboard')
    
    // Profile State
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [editMode, setEditMode] = useState(false)
    const [saving, setSaving] = useState(false)
    const [avatarUploading, setAvatarUploading] = useState(false)
    const [form, setForm] = useState({ personal_contact: '', whatsapp_number: '', address: '', avatar_url: '' })

    // Performance State
    const [leaderboard, setLeaderboard] = useState<LeaderboardMember[]>([])
    const [history, setHistory] = useState<Transaction[]>([])
    const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([])
    
    // Performance Date Filter
    const [dateRangeMode, setDateRangeMode] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
    const [refDate, setRefDate] = useState(() => new Date().toISOString().split('T')[0])
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    const fmtLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const getWeekRange = (d: Date) => {
        const day = d.getDay()
        const start = new Date(d); start.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
        const end = new Date(start); end.setDate(start.getDate() + 6)
        return { start: fmtLocalDate(start), end: fmtLocalDate(end) }
    }
    const getMonthRange = (d: Date) => {
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        return { start: fmtLocalDate(start), end: fmtLocalDate(end) }
    }
    
    // Modals
    const [showWithdrawModal, setShowWithdrawModal] = useState(false)
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [withdrawing, setWithdrawing] = useState(false)
    
    const [showAwardModal, setShowAwardModal] = useState(false)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
    const [awardAmount, setAwardAmount] = useState('')
    const [description, setDescription] = useState('')
    const [awarding, setAwarding] = useState(false)

    const [selectedMemberHistory, setSelectedMemberHistory] = useState<{ member: LeaderboardMember, transactions: Transaction[], loading: boolean } | null>(null)

    const fetchAllData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (dateRangeMode === 'today') {
                params.set('start_date', refDate)
                params.set('end_date', refDate)
            } else if (dateRangeMode === 'week') {
                const r = getWeekRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRangeMode === 'month') {
                const r = getMonthRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRangeMode === 'custom' && customStart && customEnd) {
                params.set('start_date', customStart)
                params.set('end_date', customEnd)
            }

            const qs = params.toString() ? `?${params.toString()}` : ''
            const histQs = params.toString() ? `&${params.toString()}` : ''

            const [profRes, leadRes, histRes, withRes] = await Promise.all([
                fetch('/api/members/me'),
                fetch(`/api/points/leaderboard${qs}`),
                fetch(`/api/points/history?limit=${isAdmin ? 100 : 20}${histQs}`),
                isAdmin ? fetch('/api/points/withdraw/pending') : Promise.resolve(null)
            ])

            if (profRes.ok) {
                const data = await profRes.json()
                setProfile(data)
                setForm({
                    personal_contact: data.personal_contact || '',
                    whatsapp_number: data.whatsapp_number || '',
                    address: data.address || '',
                    avatar_url: data.avatar_url || '',
                })
            }
            if (leadRes.ok) {
                const data = await leadRes.json()
                setLeaderboard(data.leaderboard || [])
            }
            if (histRes.ok) {
                const data = await histRes.json()
                setHistory(data.transactions || [])
            }
            if (withRes && withRes.ok) {
                const data = await withRes.json()
                setPendingWithdrawals(data.requests || [])
            }
        } catch {
            toast.error('Failed to load data')
        }
        setLoading(false)
    }, [isAdmin, toast, dateRangeMode, refDate, customStart, customEnd])

    useEffect(() => { fetchAllData() }, [fetchAllData])

    // Profile Handlers
    const handleSaveProfile = async () => {
        if (!profile) return
        setSaving(true)
        const res = await fetch(`/api/members/${profile.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        setSaving(false)
        if (res.ok) {
            setProfile(prev => prev ? { ...prev, ...data } : prev)
            setEditMode(false)
            toast.success('Profile updated')
        } else {
            toast.error(data.error || 'Update failed')
        }
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !profile) return
        setAvatarUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('bucket', 'avatars')
            fd.append('folder', 'members')
            fd.append('employee_id', profile.id)
            const res = await fetch('/api/upload', { method: 'POST', body: fd })
            const data = await res.json()
            if (data.url) {
                setForm(prev => ({ ...prev, avatar_url: data.url }))
                await fetch(`/api/members/${profile.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar_url: data.url }),
                })
                setProfile(prev => prev ? { ...prev, avatar_url: data.url } : prev)
                toast.success('Avatar updated')
            } else {
                toast.error(data.error || 'Upload failed')
            }
        } catch {
            toast.error('Upload failed')
        }
        setAvatarUploading(false)
    }

    // Performance Handlers
    const handleWithdrawRequest = async (e: React.FormEvent) => {
        e.preventDefault()
        const amount = parseInt(withdrawAmount, 10)
        if (!amount || amount < 500) {
            toast.error('Minimum withdrawal is 500 points')
            return
        }
        
        setWithdrawing(true)
        try {
            const res = await fetch('/api/points/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success('Withdrawal requested successfully')
                setShowWithdrawModal(false)
                setWithdrawAmount('')
                fetchAllData()
            } else {
                toast.error(data.error || 'Failed to request withdrawal')
            }
        } catch {
            toast.error('Network error')
        }
        setWithdrawing(false)
    }

    const handleProcessWithdrawal = async (id: string, action: 'approve' | 'reject') => {
        if (!confirm(`Are you sure you want to ${action} this request?`)) return
        try {
            const res = await fetch('/api/points/withdraw/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message)
                fetchAllData()
            } else {
                toast.error(data.error || 'Failed to process request')
            }
        } catch {
            toast.error('Network error')
        }
    }

    const handleAwardPoints = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedEmployeeId || !awardAmount || !description.trim()) return

        setAwarding(true)
        try {
            const res = await fetch('/api/points/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: selectedEmployeeId,
                    amount: parseInt(awardAmount, 10),
                    description
                })
            })

            const data = await res.json()
            if (res.ok) {
                toast.success(data.message)
                setShowAwardModal(false)
                setSelectedEmployeeId('')
                setAwardAmount('')
                setDescription('')
                fetchAllData()
            } else {
                toast.error(data.error || 'Failed to award points')
            }
        } catch {
            toast.error('Network error')
        } finally {
            setAwarding(false)
        }
    }
    const handleMemberClick = async (member: LeaderboardMember) => {
        if (!isAdmin) return
        setSelectedMemberHistory({ member, transactions: [], loading: true })
        
        try {
            const params = new URLSearchParams()
            params.set('employee_id', member.id)
            params.set('limit', '100')
            
            if (dateRangeMode === 'today') {
                params.set('start_date', refDate)
                params.set('end_date', refDate)
            } else if (dateRangeMode === 'week') {
                const r = getWeekRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRangeMode === 'month') {
                const r = getMonthRange(new Date(refDate))
                params.set('start_date', r.start)
                params.set('end_date', r.end)
            } else if (dateRangeMode === 'custom' && customStart && customEnd) {
                params.set('start_date', customStart)
                params.set('end_date', customEnd)
            }

            const res = await fetch(`/api/points/history?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setSelectedMemberHistory({ member, transactions: data.transactions || [], loading: false })
            } else {
                toast.error('Failed to load history')
                setSelectedMemberHistory(null)
            }
        } catch {
            toast.error('Network error')
            setSelectedMemberHistory(null)
        }
    }

    const renderRankBadge = (index: number) => {
        if (index === 0) return <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FDE68A 0%, #D97706 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 4px 10px rgba(217,119,6,0.3)' }}>1</div>
        if (index === 1) return <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 4px 10px rgba(148,163,184,0.3)' }}>2</div>
        if (index === 2) return <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FED7AA 0%, #B45309 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 4px 10px rgba(180,83,9,0.3)' }}>3</div>
        return <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.875rem' }}>{index + 1}</div>
    }

    if (loading) {
        return (
            <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ height: 50, background: 'var(--color-surface)', borderRadius: 12 }} className="skeleton" />
                <div style={{ height: 200, background: 'var(--color-surface)', borderRadius: 16 }} className="skeleton" />
            </div>
        )
    }

    if (!profile) return <div style={{ textAlign: 'center', padding: '80px', color: 'var(--color-text-tertiary)' }}>Profile not found</div>

    const displayAvatar = form.avatar_url || profile.avatar_url

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="page-header" style={{ marginBottom: 16 }}>
                <h1 className="page-title">Welcome, {profile.name.split(' ')[0]}</h1>
            </div>

            {/* Main Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(118,118,128,0.08)', padding: '6px', borderRadius: '16px' }}>
                <button onClick={() => setMainTab('profile')}
                    style={{
                        flex: 1, position: 'relative', padding: '12px 0', border: 'none', background: 'transparent',
                        borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem',
                        color: mainTab === 'profile' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                        transition: 'color 0.2s', zIndex: 1,
                    }}>
                    {mainTab === 'profile' && <motion.div layoutId="mainTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid var(--color-border-light)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                    <span style={{ position: 'relative', zIndex: 1 }}>Profile Details</span>
                </button>
                <button onClick={() => setMainTab('performance')}
                    style={{
                        flex: 1, position: 'relative', padding: '12px 0', border: 'none', background: 'transparent',
                        borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem',
                        color: mainTab === 'performance' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                        transition: 'color 0.2s', zIndex: 1,
                    }}>
                    {mainTab === 'performance' && <motion.div layoutId="mainTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid var(--color-border-light)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                    <span style={{ position: 'relative', zIndex: 1 }}>Performance Hub</span>
                </button>
            </div>

            <AnimatePresence mode="wait">
                {mainTab === 'profile' ? (
                    <motion.div key="profile" variants={container} animate="show" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                        {/* Profile Header Card - Apple Inspired */}
                        <motion.div variants={itemAnim} className="card" style={{ marginBottom: 24, padding: '32px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)', borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                                
                                {/* Left Side: Avatar & Info */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, minWidth: 0, flex: '1 1 300px' }}>
                                    {/* Avatar */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{ 
                                            width: 88, height: 88, borderRadius: '50%', 
                                            background: 'var(--color-bg-secondary)', overflow: 'hidden', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            color: 'var(--color-text-primary)', fontSize: '2rem', fontWeight: 600, 
                                            boxShadow: 'inset 0 0 0 1px var(--color-border-light)' 
                                        }}>
                                            {displayAvatar ? <img src={displayAvatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.name[0]?.toUpperCase()}
                                        </div>
                                        <label style={{ 
                                            position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, 
                                            borderRadius: '50%', background: 'var(--color-bg-primary)', 
                                            border: '1px solid var(--color-border-light)', display: 'flex', 
                                            alignItems: 'center', justifyContent: 'center', 
                                            cursor: avatarUploading ? 'wait' : 'pointer',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                            color: 'var(--color-text-secondary)',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                                        >
                                            {avatarUploading ? <div className="spinner" style={{ width: 12, height: 12, borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--color-text-primary)' }} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>}
                                            <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} disabled={avatarUploading} onChange={handleAvatarUpload} />
                                        </label>
                                    </div>

                                    {/* Name & Titles */}
                                    <div style={{ minWidth: 0 }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</h2>
                                        <div style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <span>{profile.designation || 'Team Member'}</span>
                                            {profile.department?.name && <> <span style={{ opacity: 0.3 }}>•</span> <span>{profile.department.name}</span></>}
                                        </div>
                                        
                                        {/* Badges */}
                                        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '4px 10px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', borderRadius: 20 }}>{profile.role?.name || 'Member'}</span>
                                            {profile.employee_id && <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '4px 10px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', borderRadius: 20 }}>ID: {profile.employee_id}</span>}
                                            <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '4px 10px', background: profile.is_active ? 'rgba(5, 150, 105, 0.08)' : 'rgba(220, 38, 38, 0.08)', color: profile.is_active ? '#059669' : '#DC2626', borderRadius: 20 }}>{profile.is_active ? 'Active' : 'Inactive'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Action Button — admins only; members can only change photo */}
                                <div>
                                    {isAdmin && <button
                                        className={`btn ${editMode ? 'btn-secondary' : 'btn-primary'}`}
                                        onClick={() => setEditMode(e => !e)}
                                        style={{ 
                                            borderRadius: 20, 
                                            padding: '8px 20px', 
                                            fontSize: '0.875rem', 
                                            fontWeight: 500,
                                            background: editMode ? 'var(--color-bg-secondary)' : 'var(--color-text-primary)',
                                            color: editMode ? 'var(--color-text-primary)' : 'var(--color-bg-primary)',
                                            border: 'none',
                                            transition: 'all 0.2s ease',
                                            boxShadow: editMode ? 'none' : '0 4px 12px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {editMode ? 'Cancel' : 'Edit Profile'}
                                    </button>}
                                </div>
                            </div>

                            {/* Divider */}
                            <div style={{ height: 1, background: 'var(--color-border-light)', margin: '28px 0 20px' }} />

                            {/* Stats Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <InfoRow label="Email Address" value={profile.email} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <InfoRow label="Joined Date" value={profile.joining_date ? new Date(profile.joining_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <InfoRow label="Blood Group" value={profile.blood_group} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div variants={itemAnim} className="card" style={{ marginBottom: 16 }}>
                            <div className="card-header">
                                <h3 className="card-title">Contact Information</h3>
                            </div>
                            {editMode ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div className="input-group">
                                            <label className="input-label">Phone Number</label>
                                            <input className="input" value={form.personal_contact} onChange={e => setForm(p => ({ ...p, personal_contact: e.target.value }))} placeholder="01XXXXXXXXX" />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">WhatsApp Number</label>
                                            <input className="input" value={form.whatsapp_number} onChange={e => setForm(p => ({ ...p, whatsapp_number: e.target.value }))} placeholder="01XXXXXXXXX" />
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Home Address</label>
                                        <input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address..." />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                        <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <InfoRow label="Phone" value={profile.personal_contact} />
                                    <InfoRow label="WhatsApp" value={profile.whatsapp_number} />
                                    <div style={{ gridColumn: '1 / -1' }}><InfoRow label="Home Address" value={profile.address} /></div>
                                </div>
                            )}
                        </motion.div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <motion.div variants={itemAnim} className="card">
                                <div className="card-header"><h3 className="card-title">Personal Details</h3></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <InfoRow label="Date of Birth" value={profile.date_of_birth ? new Date(profile.date_of_birth + 'T00:00:00').toLocaleDateString() : null} />
                                    <InfoRow label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : null} />
                                </div>
                            </motion.div>
                            <motion.div variants={itemAnim} className="card">
                                <div className="card-header"><h3 className="card-title">Emergency Contacts</h3></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <InfoRow label="Emergency Contact 1" value={profile.family_contact_1} />
                                    <InfoRow label="Emergency Contact 2" value={profile.family_contact_2} />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="performance" variants={container} animate="show" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                        {/* Point Balance Card */}
                        <motion.div variants={itemAnim} className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px', background: 'linear-gradient(135deg, var(--color-bg-elevated) 0%, var(--color-bg-secondary) 100%)', border: '2px solid var(--color-border-focus)' }}>
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Points Balance</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                    {profile.total_points} <span style={{ fontSize: '1rem', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>pts</span>
                                </div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>1 Point = 1 BDT</div>
                            </div>
                            <button className="btn btn-primary" onClick={() => setShowWithdrawModal(true)} style={{ padding: '12px 24px', fontSize: '1rem' }}>
                                Convert to BDT
                            </button>
                        </motion.div>

                        {/* Performance Sub-Tabs */}
                        <motion.div variants={itemAnim} style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--color-bg-secondary)', padding: '6px', borderRadius: '12px' }}>
                            <button onClick={() => setPerfTab('leaderboard')} className="btn btn-ghost btn-sm" style={{ flex: 1, background: perfTab === 'leaderboard' ? 'var(--color-bg-primary)' : 'transparent', boxShadow: perfTab === 'leaderboard' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>Leaderboard</button>
                            <button onClick={() => setPerfTab('history')} className="btn btn-ghost btn-sm" style={{ flex: 1, background: perfTab === 'history' ? 'var(--color-bg-primary)' : 'transparent', boxShadow: perfTab === 'history' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>{isAdmin ? 'Global Log' : 'My History'}</button>
                            {isAdmin && <button onClick={() => setPerfTab('withdrawals')} className="btn btn-ghost btn-sm" style={{ flex: 1, background: perfTab === 'withdrawals' ? 'var(--color-bg-primary)' : 'transparent', boxShadow: perfTab === 'withdrawals' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
                                Withdraw Requests {pendingWithdrawals.length > 0 && <span style={{ background: '#DC2626', color: '#fff', padding: '2px 6px', borderRadius: '10px', fontSize: '0.6875rem', marginLeft: '6px' }}>{pendingWithdrawals.length}</span>}
                            </button>}
                        </motion.div>

                        {/* Date Range Selector for Leaderboard & History */}
                        {(perfTab === 'leaderboard' || perfTab === 'history') && (
                            <motion.div variants={itemAnim} style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '10px', padding: '2px' }}>
                                    {([{ key: 'all', label: 'All Time' }, { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' }] as const).map(tab => (
                                        <button key={tab.key} onClick={() => setDateRangeMode(tab.key)}
                                            style={{
                                                position: 'relative', padding: '6px 14px', borderRadius: '8px', border: 'none',
                                                fontSize: '0.8125rem', fontWeight: 500, background: 'transparent',
                                                color: dateRangeMode === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                                cursor: 'pointer', transition: 'color 0.2s', zIndex: 1,
                                            }}>
                                            {dateRangeMode === tab.key && (
                                                <motion.div layoutId="perfDateTab" style={{
                                                    position: 'absolute', inset: 0, background: 'var(--color-bg-primary)',
                                                    borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                                }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                            )}
                                            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {(dateRangeMode === 'today' || dateRangeMode === 'week' || dateRangeMode === 'month') && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => {
                                            const d = new Date(refDate); d.setDate(d.getDate() - (dateRangeMode === 'week' ? 7 : dateRangeMode === 'month' ? 30 : 1)); setRefDate(d.toISOString().split('T')[0])
                                        }} style={{ borderRadius: '8px' }}>
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        </button>
                                        <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: '0.875rem', width: '160px', textAlign: 'center' }} />
                                        <button className="btn btn-ghost btn-icon" onClick={() => {
                                            const d = new Date(refDate); d.setDate(d.getDate() + (dateRangeMode === 'week' ? 7 : dateRangeMode === 'month' ? 30 : 1)); setRefDate(d.toISOString().split('T')[0])
                                        }} style={{ borderRadius: '8px' }}>
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                )}
                                {dateRangeMode === 'custom' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input" style={{ padding: '6px 8px', fontSize: '0.8125rem', width: '150px', border: '1px solid var(--color-border-light)', borderRadius: '8px' }} />
                                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}>to</span>
                                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input" style={{ padding: '6px 8px', fontSize: '0.8125rem', width: '150px', border: '1px solid var(--color-border-light)', borderRadius: '8px' }} />
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {perfTab === 'leaderboard' && (
                            <motion.div variants={itemAnim} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {leaderboard.map((member, index) => (
                                    <div key={member.id} className="card" onClick={() => isAdmin ? handleMemberClick(member) : null} style={{ cursor: isAdmin ? 'pointer' : 'default', display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '16px', transition: 'transform 0.2s, box-shadow 0.2s', ...(isAdmin && { ':hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } }) }}>
                                        <div style={{ flexShrink: 0 }}>{renderRankBadge(index)}</div>
                                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: getAvatarColor(member.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, overflow: 'hidden' }}>
                                            {member.avatar_url ? <img src={member.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : member.name[0]}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1.0625rem', fontWeight: 700 }}>{member.name} {member.id === profile.id && <span style={{ fontSize: '0.6875rem', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>YOU</span>}</div>
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{member.designation || 'Member'}</div>
                                        </div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>{member.total_points}</div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {perfTab === 'history' && (
                            <motion.div variants={itemAnim} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {isAdmin && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => setShowAwardModal(true)}>+ Manual Award</button>
                                    </div>
                                )}
                                {history.map((tx) => (
                                    <div key={tx.id} className="card" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '16px' }}>
                                        {isAdmin && (
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: getAvatarColor(tx.employee?.name || 'U'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden' }}>
                                                {tx.employee?.avatar_url ? <img src={tx.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (tx.employee?.name || 'U')[0]}
                                            </div>
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                {isAdmin && <span style={{ fontWeight: 600 }}>{tx.employee?.name}</span>}
                                                {renderSourceIcon(tx.source)}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{tx.description}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                                                {new Date(tx.created_at).toLocaleString()} {tx.granted_by_user && `• via ${tx.granted_by_user.name}`}
                                            </div>
                                        </div>
                                        <div style={{ padding: '6px 12px', borderRadius: '10px', background: tx.points >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: tx.points >= 0 ? '#10B981' : '#DC2626', fontWeight: 700 }}>
                                            {tx.points > 0 ? '+' : ''}{tx.points}
                                        </div>
                                    </div>
                                ))}
                                {history.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No history found.</div>}
                            </motion.div>
                        )}

                        {perfTab === 'withdrawals' && isAdmin && (
                            <motion.div variants={itemAnim} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {pendingWithdrawals.map(req => (
                                    <div key={req.id} className="card" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '16px' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: getAvatarColor(req.employee?.name || 'U'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden' }}>
                                            {req.employee?.avatar_url ? <img src={req.employee.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (req.employee?.name || 'U')[0]}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>{req.employee?.name} requested withdrawal</div>
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>{new Date(req.requested_at).toLocaleString()}</div>
                                        </div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#DC2626', marginRight: '16px' }}>{req.amount} pts</div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleProcessWithdrawal(req.id, 'reject')}>Reject</button>
                                            <button className="btn btn-primary btn-sm" style={{ background: '#10B981' }} onClick={() => handleProcessWithdrawal(req.id, 'approve')}>Approve</button>
                                        </div>
                                    </div>
                                ))}
                                {pendingWithdrawals.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No pending withdrawal requests.</div>}
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Member History Modal */}
            <AnimatePresence>
                {selectedMemberHistory && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setSelectedMemberHistory(null)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: getAvatarColor(selectedMemberHistory.member.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden' }}>
                                        {selectedMemberHistory.member.avatar_url ? <img src={selectedMemberHistory.member.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selectedMemberHistory.member.name[0]}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.0625rem', fontWeight: 700 }}>{selectedMemberHistory.member.name}'s Performance</div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{dateRangeMode === 'all' ? 'All Time' : `${refDate} ${dateRangeMode}`} • Total: {selectedMemberHistory.member.total_points} pts</div>
                                    </div>
                                </div>
                                <button className="btn btn-ghost btn-icon" onClick={() => setSelectedMemberHistory(null)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: 'var(--color-bg-secondary)' }}>
                                {selectedMemberHistory.loading ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>Loading history...</div>
                                ) : selectedMemberHistory.transactions.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No activities found for this period.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {selectedMemberHistory.transactions.map(tx => (
                                            <div key={tx.id} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', background: 'var(--color-surface)' }}>
                                                <div style={{ marginTop: '2px' }}>{renderSourceIcon(tx.source)}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{tx.description}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>{new Date(tx.created_at).toLocaleString()} {tx.granted_by_user && `• via ${tx.granted_by_user.name}`}</div>
                                                </div>
                                                <div style={{ padding: '6px 10px', borderRadius: '8px', background: tx.points >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)', color: tx.points >= 0 ? '#10B981' : '#DC2626', fontWeight: 700, fontSize: '0.875rem', height: 'fit-content' }}>
                                                    {tx.points > 0 ? '+' : ''}{tx.points}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <AnimatePresence>
                {showWithdrawModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowWithdrawModal(false)}>
                        <motion.div className="modal" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header"><h2 className="modal-title">Convert Points to BDT</h2></div>
                            <form onSubmit={handleWithdrawRequest}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Available Balance</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{profile.total_points}</div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Amount to convert (Minimum 500)</label>
                                        <input type="number" className="form-input" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} min="500" max={profile.total_points} placeholder="e.g. 500" required />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowWithdrawModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={withdrawing || !withdrawAmount || parseInt(withdrawAmount) < 500 || parseInt(withdrawAmount) > profile.total_points}>{withdrawing ? 'Requesting...' : 'Submit Request'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}

                {showAwardModal && isAdmin && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAwardModal(false)}>
                        <motion.div className="modal" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header"><h2 className="modal-title">Manual Point Adjustment</h2></div>
                            <form onSubmit={handleAwardPoints}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Select Member</label>
                                        <select className="form-input" value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} required>
                                            <option value="">Choose a member...</option>
                                            {leaderboard.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Points Amount</label>
                                        <input type="number" className="form-input" value={awardAmount} onChange={e => setAwardAmount(e.target.value)} placeholder="e.g. 10 or -5" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Reason</label>
                                        <input type="text" className="form-input" value={description} onChange={e => setDescription(e.target.value)} required />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAwardModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={awarding}>{awarding ? 'Saving...' : 'Apply Points'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
