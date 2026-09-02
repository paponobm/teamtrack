'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MemberModal from '@/components/members/MemberModal'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import {
    IconPlus, IconSearch, IconClock, IconTrophy, IconCake, IconPartyPopper,
    IconX, IconUsers, IconFileText, IconEdit
} from '@/components/icons/Icons'

interface Role {
    id: string
    name: string
    level: number
}

interface Department {
    id: string
    name: string
    name_bn: string
}

interface Feature {
    id: string
    slug: string
    name: string
}

interface Employee {
    id: string
    employee_id: string
    name: string
    email: string
    designation: string
    personal_contact: string
    whatsapp_number: string
    photo_url: string | null
    is_active: boolean
    joining_date: string
    department: Department | null
    role: Role | null
    address: string
    nid_no: string
    blood_group: string
    family_contact_1: string
    family_contact_2: string
    department_id: string
    role_id: string
    gender: string | null
    date_of_birth: string | null
    cv_url: string | null
    duty_start_time: string | null
    duty_end_time: string | null
    total_points: number
    avatar_url: string | null
}

interface BirthdayMember {
    id: string
    name: string
    designation: string
    photo_url: string | null
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[name.charCodeAt(0) % colors.length]
}

export default function MembersPage() {
    const { data: perms, isLoading: permsLoading } = usePermissions()
    const toast = useToast()
    const [members, setMembers] = useState<Employee[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [roles, setRoles] = useState<Role[]>([])
    const [features, setFeatures] = useState<Feature[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterDept, setFilterDept] = useState('')
    const [filterRole, setFilterRole] = useState('')
    const [filterStatus, setFilterStatus] = useState('active')
    const [showModal, setShowModal] = useState(false)
    const [editingMember, setEditingMember] = useState<Employee | null>(null)
    const [viewingMember, setViewingMember] = useState<Employee | null>(null)
    const [initialTab, setInitialTab] = useState<'profile' | 'access' | 'logs' | 'performance'>('profile')
    const [birthdayMembers, setBirthdayMembers] = useState<BirthdayMember[]>([])
    const [showBirthday, setShowBirthday] = useState(true)
    const [memberPermissions, setMemberPermissions] = useState<Record<string, string>>({})
    const [zoomedAvatar, setZoomedAvatar] = useState<string | null>(null)
    const [reorderMode, setReorderMode] = useState(false)
    const [pendingPositions, setPendingPositions] = useState<Record<string, string>>({})
    const [reorderError, setReorderError] = useState('')
    const [confirmReorder, setConfirmReorder] = useState<{ id: string; name: string; oldPosition: number; newPosition: number } | null>(null)
    const [reorderSaving, setReorderSaving] = useState(false)
    const [permissionsLoading, setPermissionsLoading] = useState(false)
    const [savingPermissions, setSavingPermissions] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)

    const [isMobile, setIsMobile] = useState(false)

    const fetchMembers = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (filterDept) params.set('department', filterDept)
        if (filterRole) params.set('role', filterRole)
        if (filterStatus) params.set('status', filterStatus)
        const res = await fetch(`/api/members?${params}`)
        const data = await res.json()
        if (Array.isArray(data)) setMembers(data)
        setLoading(false)
    }, [search, filterDept, filterRole, filterStatus])

    useEffect(() => { fetchMembers() }, [fetchMembers])

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        const fetchLookups = async () => {
            const [deptRes, roleRes, featRes] = await Promise.all([
                fetch('/api/departments'),
                fetch('/api/roles'),
                fetch('/api/permissions').then(r => r.json()).catch(() => []),
            ])
            const deptData = await deptRes.json()
            const roleData = await roleRes.json()
            if (Array.isArray(deptData)) setDepartments(deptData)
            if (Array.isArray(roleData)) setRoles(roleData)
            if (Array.isArray(featRes)) setFeatures(featRes)
        }
        fetchLookups()
    }, [])

    useEffect(() => {
        if (perms.is_super || perms.is_admin) setIsAdmin(true)
        if (perms.is_super) setIsSuperAdmin(true)
    }, [perms])

    useEffect(() => {
        fetch('/api/birthdays').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setBirthdayMembers(d)
        }).catch(() => { })
    }, [])

    if (permsLoading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto' }} />
                <div className="skeleton" style={{ width: 200, height: 20, margin: '16px auto' }} />
            </div>
        )
    }

    if (isMobile && !isAdmin && !isSuperAdmin) {
        return (
            <motion.div variants={container} animate="show" style={{ padding: '40px 20px', textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <IconUsers size={64} color="var(--color-text-tertiary)" />
                <h2 style={{ marginTop: '24px', fontSize: '1.25rem', fontWeight: 600 }}>Access Restricted</h2>
                <p style={{ marginTop: '8px', color: 'var(--color-text-secondary)', maxWidth: '280px', lineHeight: 1.5 }}>
                    The Members page is restricted from mobile devices. Please use a desktop to access this page.
                </p>
            </motion.div>
        )
    }

    const fetchPermissions = async (empId: string) => {
        setPermissionsLoading(true)
        try {
            const res = await fetch(`/api/permissions?employee_id=${empId}`)
            const data = await res.json()
            if (Array.isArray(data)) {
                const permMap: Record<string, string> = {}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data.forEach((p: any) => {
                    const slug = Array.isArray(p.feature) ? p.feature[0]?.slug : p.feature?.slug
                    if (slug) permMap[slug] = p.access_level
                })
                setMemberPermissions(permMap)
            }
        } catch { /* ignore */ }
        finally { setPermissionsLoading(false) }
    }

    const handlePermissionChange = async (featureSlug: string, level: string) => {
        if (!viewingMember) return
        const prevPerms = memberPermissions
        const newPerms = { ...memberPermissions, [featureSlug]: level }
        setMemberPermissions(newPerms)
        setSavingPermissions(true)
        try {
            const feature = features.find(f => f.slug === featureSlug)
            if (feature) {
                // The permissions endpoint is a bulk upsert: POST { permissions: [...] }
                const res = await fetch('/api/permissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ permissions: [{ employee_id: viewingMember.id, feature_id: feature.id, access_level: level }] }),
                })
                if (!res.ok) {
                    setMemberPermissions(prevPerms) // roll back on failure
                    const err = await res.json().catch(() => ({}))
                    toast.error(`Failed to update access: ${err.error || 'Unknown error'}`)
                }
            }
        } catch {
            setMemberPermissions(prevPerms)
            toast.error('Failed to update access')
        }
        finally { setSavingPermissions(false) }
    }

    const handleAdd = () => { setEditingMember(null); setShowModal(true) }
    const handleEdit = (member: Employee, tab?: 'profile' | 'access' | 'logs' | 'performance') => {
        setEditingMember(member)
        setInitialTab(tab || 'profile')
        setShowModal(true)
        setViewingMember(null)
    }
    const handleDeactivate = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this member?')) return
        const res = await fetch(`/api/members/${id}`, { method: 'DELETE' })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to deactivate member'); return }
        toast.success('Member deactivated')
        fetchMembers(); setViewingMember(null)
    }
    const handleReactivate = async (id: string) => {
        const res = await fetch(`/api/members/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) })
        if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to reactivate member'); return }
        toast.success('Member reactivated')
        fetchMembers(); setViewingMember(null)
    }
    const handleSave = () => { setShowModal(false); setEditingMember(null); fetchMembers() }

    const enterReorderMode = () => {
        const initial: Record<string, string> = {}
        members.forEach((m, i) => { initial[m.id] = String(i + 1) })
        setPendingPositions(initial)
        setReorderError('')
        setReorderMode(true)
    }
    const cancelReorderMode = () => {
        setReorderMode(false)
        setPendingPositions({})
        setReorderError('')
    }
    const handlePositionChange = (id: string, value: string) => {
        setReorderError('')
        setPendingPositions(prev => ({ ...prev, [id]: value }))
    }
    const handleReorderDone = () => {
        const changed = members
            .map((m, i) => ({ id: m.id, name: m.name, oldPosition: i + 1, newPosition: Number(pendingPositions[m.id]) }))
            .filter(m => pendingPositions[m.id] !== undefined && String(m.oldPosition) !== pendingPositions[m.id])

        if (changed.length === 0) { cancelReorderMode(); return }
        if (changed.length > 1) { setReorderError('Change one member\'s position at a time.'); return }

        const change = changed[0]
        if (!Number.isInteger(change.newPosition) || change.newPosition < 1 || change.newPosition > members.length) {
            setReorderError(`Position must be between 1 and ${members.length} (total members).`)
            return
        }
        setConfirmReorder(change)
    }
    const confirmReorderAction = async () => {
        if (!confirmReorder) return
        setReorderSaving(true)
        try {
            const res = await fetch(`/api/members/${confirmReorder.id}/reorder`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_position: confirmReorder.newPosition }),
            })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to reorder')
            } else {
                toast.success('Order updated')
                await fetchMembers()
                cancelReorderMode()
            }
        } catch {
            toast.error('Failed to reorder')
        } finally {
            setReorderSaving(false)
            setConfirmReorder(null)
        }
    }
    const openViewMember = (member: Employee) => { setViewingMember(member); fetchPermissions(member.id) }

    const formatDate = (d: string | null) => {
        if (!d) return null
        // Parse date-only strings (YYYY-MM-DD) as local midnight to avoid an off-by-one day.
        const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00:00' : d)
        if (isNaN(date.getTime())) return d
        return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    }

    const formatTime = (t: string | null) => {
        if (!t) return '-'
        const [h, m] = t.split(':')
        const hr = parseInt(h)
        const ampm = hr >= 12 ? 'PM' : 'AM'
        return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${ampm}`
    }

    return (
        <motion.div variants={container} animate="show">
            {/* Birthday Banner */}
            {showBirthday && birthdayMembers.length > 0 && (
                <motion.div variants={item} style={{
                    background: 'linear-gradient(135deg, #FFE4E6, #FFF7ED, #FEF3C7)',
                    border: '1px solid #FBBF2440', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px', position: 'relative',
                }}>
                    <button onClick={() => setShowBirthday(false)} style={{ position: 'absolute', top: '8px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, display: 'flex' }}>
                        <IconX size={16} />
                    </button>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                            <IconCake size={28} color="#B45309" />
                            <IconPartyPopper size={28} color="#B45309" />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#B45309', marginBottom: '4px' }}>Happy Birthday!</h3>
                        {birthdayMembers.map(bm => (
                            <div key={bm.id} style={{ fontSize: '1rem', fontWeight: 600, color: '#92400E' }}>
                                {bm.name} {bm.designation ? `(${bm.designation})` : ''}
                            </div>
                        ))}
                        <p style={{ fontSize: '0.8125rem', color: '#B45309', marginTop: '8px', opacity: 0.8 }}>
                            Wishing you a wonderful day!
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Page Header */}
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Members</h1>
                    <p className="page-subtitle">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={handleAdd} id="add-member-btn">
                    <IconPlus size={16} /> Add Member
                </button>
            </motion.div>

            {/* Filters */}
            <motion.div variants={item} style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={{ width: '260px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                        <IconSearch size={16} color="#94A3B8" />
                    </span>
                    <input type="text" className="input" placeholder="Search by name, email, ID..." value={search} onChange={(e) => setSearch(e.target.value)} id="member-search"
                        style={{ paddingLeft: '36px', width: '100%' }} />
                </div>
                <select className="input" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ width: '180px', padding: '8px 12px', fontSize: '0.875rem' }} id="dept-filter">
                    <option value="">All Departments</option>
                    {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
                <select className="input" value={filterRole} onChange={(e) => setFilterRole(e.target.value)} style={{ width: '160px', padding: '8px 12px', fontSize: '0.875rem' }} id="role-filter">
                    <option value="">All Roles</option>
                    {roles.map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
                </select>
                <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '140px', padding: '8px 12px', fontSize: '0.875rem' }} id="status-filter">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                {isAdmin && !reorderMode && (
                    <button className="btn btn-ghost btn-icon" title="Edit serial number order" onClick={enterReorderMode}
                        style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconEdit size={16} />
                    </button>
                )}
                {reorderMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleReorderDone}>Done</button>
                        <button className="btn btn-ghost btn-sm" onClick={cancelReorderMode}>Cancel</button>
                    </div>
                )}
                {reorderError && (
                    <span style={{ fontSize: '0.8125rem', color: '#DC2626', display: 'flex', alignItems: 'center' }}>{reorderError}</span>
                )}
            </motion.div>

            {/* Members List */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}><div className="skeleton" style={{ width: '140px', height: '14px', marginBottom: '6px' }} /><div className="skeleton" style={{ width: '200px', height: '12px' }} /></div>
                            <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '6px' }} />
                        </div>
                    ))}
                </div>
            ) : members.length === 0 ? (
                <motion.div className="empty-state" variants={item}>
                    <IconUsers size={48} color="#94A3B8" />
                    <h3>No members found</h3>
                    <p>Get started by adding your first team member.</p>
                    <button className="btn btn-primary" onClick={handleAdd}>Add Member</button>
                </motion.div>
            ) : (
                <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} variants={container} animate="show">
                    {members.map((member, index) => (
                        <motion.div key={member.id} className="card" variants={item}
                            whileHover={{ y: -1, boxShadow: '0 4px 20px rgba(15,23,42,0.06)' }}
                            style={{ cursor: 'pointer', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}
                            onClick={() => openViewMember(member)}>
                            {reorderMode ? (
                                <input
                                    type="number" min={1} max={members.length}
                                    value={pendingPositions[member.id] ?? String(index + 1)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handlePositionChange(member.id, e.target.value)}
                                    style={{ width: '40px', height: '28px', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--color-border-light)', flexShrink: 0 }}
                                />
                            ) : (
                                <span style={{ width: '24px', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{index + 1}</span>
                            )}
                            <div
                                style={{ background: getAvatarColor(member.name), width: '44px', height: '44px', fontSize: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'white', fontWeight: 600, overflow: 'hidden', cursor: member.avatar_url ? 'zoom-in' : undefined }}
                                onClick={member.avatar_url ? (e) => { e.stopPropagation(); setZoomedAvatar(member.avatar_url) } : undefined}>
                                {member.avatar_url ? (
                                    <img src={member.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : member.name[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{member.name}</span>
                                    {member.employee_id && <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>#{member.employee_id}</span>}
                                    {member.role?.name && (
                                        <span style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.625rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            background: (member.role.name.toLowerCase().includes('admin') || member.role.name.toLowerCase() === 'owner') ? 'rgba(37,99,235,0.1)' : 'rgba(100,116,139,0.1)',
                                            color: (member.role.name.toLowerCase().includes('admin') || member.role.name.toLowerCase() === 'owner') ? '#2563EB' : '#64748B'
                                        }}>
                                            {member.role.name}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                                    <span>{member.designation || member.role?.name || '-'}</span>
                                    {member.department && <span>• {member.department.name}</span>}
                                    {member.personal_contact && <span>• {member.personal_contact}</span>}
                                    {member.email && <span>• {member.email}</span>}
                                </div>
                            </div>
                            {(member.duty_start_time || member.duty_end_time) && (
                                <div style={{ textAlign: 'center', flexShrink: 0, fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <IconClock size={12} color="var(--color-text-tertiary)" />
                                    <span>{formatTime(member.duty_start_time)} - {formatTime(member.duty_end_time)}</span>
                                </div>
                            )}
                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B' }}>{member.total_points || 0}</div>
                                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>pts</div>
                            </div>
                            {/* Quick tab links */}
                            <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                {[
                                    { key: 'profile' as const, title: 'Profile', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
                                    { key: 'access' as const, title: 'Access', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
                                    { key: 'logs' as const, title: 'Logs', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg> },
                                    { key: 'performance' as const, title: 'Performance', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg> },
                                ].map(tab => (
                                    <button key={tab.key} title={tab.title}
                                        onClick={(e) => { e.stopPropagation(); handleEdit(member, tab.key) }}
                                        style={{
                                            width: '28px', height: '28px', borderRadius: '7px', border: '1px solid var(--color-border-light)',
                                            background: 'var(--color-bg-secondary)', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'var(--color-text-tertiary)', transition: 'all 0.15s',
                                        }}
                                    >
                                        {tab.icon}
                                    </button>
                                ))}
                            </div>
                            <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0, background: member.is_active ? '#16A34A' : '#DC2626', color: 'white' }}>
                                {member.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* View Member Detail Overlay */}
            <AnimatePresence>
                {viewingMember && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingMember(null)}>
                        <motion.div className="modal" style={{ maxWidth: '620px', maxHeight: '85vh', overflow: 'auto' }}
                            initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
                            onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Member Profile</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setViewingMember(null)}><IconX size={20} /></button>
                            </div>

                            {/* Profile Header */}
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={{ background: getAvatarColor(viewingMember.name), width: '64px', height: '64px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'white', fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
                                    {viewingMember.avatar_url ? (
                                        <img src={viewingMember.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : viewingMember.name[0]?.toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{viewingMember.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{viewingMember.designation || viewingMember.role?.name}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                        <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 600, background: viewingMember.is_active ? '#16A34A' : '#DC2626', color: 'white' }}>
                                            {viewingMember.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '12px 16px', background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)', borderRadius: '12px', border: '1px solid #FBBF2430', flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '1.5rem', fontWeight: 800, color: '#F59E0B' }}>
                                        <IconTrophy size={20} color="#F59E0B" /> {viewingMember.total_points || 0}
                                    </div>
                                    <div style={{ fontSize: '0.625rem', color: '#B45309', fontWeight: 600, textTransform: 'uppercase' }}>Lifetime Points</div>
                                </div>
                            </div>

                            {/* Detail Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', fontSize: '0.875rem', marginBottom: '24px' }}>
                                {[
                                    { label: 'Employee ID', value: viewingMember.employee_id },
                                    { label: 'Department', value: viewingMember.department?.name },
                                    { label: 'Role', value: viewingMember.role?.name },
                                    { label: 'Gender', value: viewingMember.gender ? viewingMember.gender.charAt(0).toUpperCase() + viewingMember.gender.slice(1) : null },
                                    { label: 'Date of Birth', value: formatDate(viewingMember.date_of_birth) },
                                    { label: 'Email', value: viewingMember.email },
                                    { label: 'Phone', value: viewingMember.personal_contact },
                                    { label: 'WhatsApp', value: viewingMember.whatsapp_number },
                                    { label: 'Address', value: viewingMember.address },
                                    { label: 'NID No.', value: viewingMember.nid_no },
                                    { label: 'Blood Group', value: viewingMember.blood_group },
                                    { label: 'Joining Date', value: formatDate(viewingMember.joining_date) },
                                    { label: 'Family Contact 1', value: viewingMember.family_contact_1 },
                                    { label: 'Family Contact 2', value: viewingMember.family_contact_2 },
                                ].map(field => (
                                    <div key={field.label}>
                                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field.label}</div>
                                        <div style={{ color: field.value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{field.value || '-'}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Duty Schedule */}
                            {(viewingMember.duty_start_time || viewingMember.duty_end_time) && (
                                <div style={{ padding: '12px 16px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border-light)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <IconClock size={16} color="var(--color-text-tertiary)" />
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '2px' }}>Duty Schedule</div>
                                        <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{formatTime(viewingMember.duty_start_time)} - {formatTime(viewingMember.duty_end_time)}</div>
                                    </div>
                                </div>
                            )}

                            {/* CV Link */}
                            {viewingMember.cv_url && (
                                <div style={{ marginBottom: '20px' }}>
                                    <a href={viewingMember.cv_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                        <IconFileText size={14} /> View CV / Document
                                    </a>
                                </div>
                            )}

                            {/* Inline Permissions - only show granted */}
                            {(() => {
                                const granted = features.filter(f => memberPermissions[f.slug] && memberPermissions[f.slug] !== 'no_access')
                                return (
                                    <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '16px', marginBottom: '20px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                                            Access Granted
                                        </div>
                                        {permissionsLoading ? (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>Loading...</div>
                                        ) : granted.length === 0 ? (
                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>No access granted yet. Use Edit → Access & Permissions to manage.</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {granted.map(f => {
                                                    const level = memberPermissions[f.slug]
                                                    const isAdmin = level === 'admin'
                                                    return (
                                                        <span key={f.id} style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                            padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 500,
                                                            background: isAdmin ? 'rgba(5,150,105,0.08)' : 'rgba(37,99,235,0.08)',
                                                            color: isAdmin ? '#059669' : '#2563EB',
                                                            border: `1px solid ${isAdmin ? 'rgba(5,150,105,0.15)' : 'rgba(37,99,235,0.15)'}`,
                                                        }}>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                            {f.name}
                                                            <span style={{ fontSize: '0.5625rem', opacity: 0.7, textTransform: 'uppercase' }}>{level}</span>
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Actions */}
                            <div className="modal-footer">
                                {viewingMember.is_active ? (
                                    <button className="btn btn-sm" onClick={() => handleDeactivate(viewingMember.id)} style={{ background: '#DC2626', color: 'white', border: 'none' }}>Deactivate</button>
                                ) : (
                                    <button className="btn btn-sm" onClick={() => handleReactivate(viewingMember.id)} style={{ background: '#16A34A', color: 'white', border: 'none' }}>Reactivate</button>
                                )}
                                <button className="btn btn-primary btn-sm" onClick={() => handleEdit(viewingMember)}>Edit Member</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add / Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <MemberModal member={editingMember} departments={departments} roles={roles}
                        isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} initialTab={initialTab}
                        onClose={() => { setShowModal(false); setEditingMember(null); setInitialTab('profile') }} onSave={handleSave} />
                )}
            </AnimatePresence>

            {/* Reorder Confirm */}
            <AnimatePresence>
                {confirmReorder && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => !reorderSaving && setConfirmReorder(null)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div className="card" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: '24px', width: '380px', maxWidth: '90vw' }}>
                            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '8px' }}>Confirm reorder</div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                                Move <strong>{confirmReorder.name}</strong> from position {confirmReorder.oldPosition} to position {confirmReorder.newPosition}?
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button className="btn btn-ghost btn-sm" disabled={reorderSaving} onClick={() => setConfirmReorder(null)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" disabled={reorderSaving} onClick={confirmReorderAction}>
                                    {reorderSaving ? 'Saving...' : 'Confirm'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Avatar Zoom */}
            <AnimatePresence>
                {zoomedAvatar && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setZoomedAvatar(null)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
                        <motion.img
                            src={zoomedAvatar} alt=""
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }}
                            onClick={(e) => e.stopPropagation()} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
