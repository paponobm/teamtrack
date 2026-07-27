'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { IconMessageCircle, IconTarget, IconBell, IconBolt } from '@/components/icons/Icons'

interface Role { id: string; name: string }
interface Department { id: string; name: string }

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export default function SettingsPage() {
    const { lang, setLang, t } = useLanguage()
    const supabase = createClient()

    const [roles, setRoles] = useState<Role[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [newRole, setNewRole] = useState('')
    const [newDept, setNewDept] = useState('')
    const [savingRole, setSavingRole] = useState(false)
    const [savingDept, setSavingDept] = useState(false)
    const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null)
    const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null)
    const [user, setUser] = useState<{ email: string; name: string } | null>(null)
    const [orgName, setOrgName] = useState('Online Burmese Market')
    const [message, setMessage] = useState('')
    const [features, setFeatures] = useState({ whatsapp_enabled: false, auto_assign_problems: true, smart_notifications: true, quick_entry_default: false })
    const [featureSaving, setFeatureSaving] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        const [rolesRes, deptsRes] = await Promise.all([
            fetch('/api/roles'),
            fetch('/api/departments'),
        ])
        const rolesData = await rolesRes.json()
        const deptsData = await deptsRes.json()
        if (Array.isArray(rolesData)) setRoles(rolesData)
        if (Array.isArray(deptsData)) setDepartments(deptsData)

        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
            const { data: emp } = await supabase
                .from('employees')
                .select('name')
                .eq('user_id', authUser.id)
                .single()
            setUser({ email: authUser.email || '', name: emp?.name || authUser.email?.split('@')[0] || '' })
        }

        // Fetch feature toggles
        const featRes = await fetch('/api/settings/features')
        if (featRes.ok) {
            const featData = await featRes.json()
            setFeatures(f => ({ ...f, ...featData }))
        }
    }

    const addRole = async () => {
        if (!newRole.trim()) return
        setSavingRole(true)
        const res = await fetch('/api/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newRole.trim() }),
        })
        if (res.ok) {
            setNewRole('')
            fetchData()
            showMessage('Role added')
        }
        setSavingRole(false)
    }

    const addDept = async () => {
        if (!newDept.trim()) return
        setSavingDept(true)
        const res = await fetch('/api/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newDept.trim() }),
        })
        if (res.ok) {
            setNewDept('')
            fetchData()
            showMessage('Department added')
        }
        setSavingDept(false)
    }

    const deleteRole = async (id: string, name: string) => {
        if (!confirm(`Delete role "${name}"? Members with this role will be affected.`)) return
        setDeletingRoleId(id)
        const res = await fetch(`/api/roles?id=${id}`, { method: 'DELETE' })
        if (res.ok) { fetchData(); showMessage('Role deleted') }
        else { const d = await res.json(); showMessage(d.error || 'Delete failed') }
        setDeletingRoleId(null)
    }

    const deleteDept = async (id: string, name: string) => {
        if (!confirm(`Delete department "${name}"?`)) return
        setDeletingDeptId(id)
        const res = await fetch(`/api/departments?id=${id}`, { method: 'DELETE' })
        if (res.ok) { fetchData(); showMessage('Department deleted') }
        else { const d = await res.json(); showMessage(d.error || 'Delete failed') }
        setDeletingDeptId(null)
    }

    const showMessage = (msg: string) => {
        setMessage(msg)
        setTimeout(() => setMessage(''), 3000)
    }

    const handlePasswordReset = async () => {
        if (!user?.email) return
        const { error } = await supabase.auth.resetPasswordForEmail(user.email)
        if (!error) showMessage('Password reset email sent')
        else showMessage('Error: ' + error.message)
    }

    const toggleFeature = async (key: string, value: boolean) => {
        setFeatureSaving(key)
        const prevFeatures = features
        setFeatures(f => ({ ...f, [key]: value }))
        try {
            const res = await fetch('/api/settings/features', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value }),
            })
            if (!res.ok) {
                setFeatures(prevFeatures) // roll back on failure
                showMessage('Failed to update setting. Please try again.')
            } else {
                showMessage(`${key.replace(/_/g, ' ')} ${value ? 'enabled' : 'disabled'}`)
            }
        } catch {
            setFeatures(prevFeatures)
            showMessage('Failed to update setting. Please try again.')
        } finally {
            setFeatureSaving('')
        }
    }

    return (
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">{lang === 'bn' ? 'সেটিংস' : 'Settings'}</h1>
                    <p className="page-subtitle">{lang === 'bn' ? 'অর্গানাইজেশন ও একাউন্ট সেটিংস' : 'Organization & account settings'}</p>
                </div>
                {message && (
                    <span style={{ fontSize: '0.8125rem', color: '#2563EB', fontWeight: 500, background: '#EFF6FF', padding: '6px 14px', borderRadius: '8px' }}>
                        {message}
                    </span>
                )}
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Organization */}
                <motion.div className="card" variants={item}>
                    <div className="card-header">
                        <h3 className="card-title">{lang === 'bn' ? 'অর্গানাইজেশন' : 'Organization'}</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                {lang === 'bn' ? 'অর্গানাইজেশন নাম' : 'Organization Name'}
                            </label>
                            <input className="input" value={orgName} disabled style={{ opacity: 0.6 }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                {lang === 'bn' ? 'ল্যাংগুয়েজ' : 'Language'}
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className={`btn ${lang === 'en' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                    onClick={() => setLang('en')}
                                >
                                    English
                                </button>
                                <button
                                    className={`btn ${lang === 'bn' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                    onClick={() => setLang('bn')}
                                >
                                    বাংলা
                                </button>
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                {lang === 'bn' ? 'টাইমজোন' : 'Timezone'}
                            </label>
                            <input className="input" value="Asia/Dhaka (UTC+6)" disabled style={{ opacity: 0.6 }} />
                        </div>
                    </div>
                </motion.div>

                {/* Account */}
                <motion.div className="card" variants={item}>
                    <div className="card-header">
                        <h3 className="card-title">{lang === 'bn' ? 'আমার একাউন্ট' : 'My Account'}</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>
                                {(user?.name || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 600 }}>{user?.name || '-'}</div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{user?.email || '-'}</div>
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Email
                            </label>
                            <input className="input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={handlePasswordReset} style={{ alignSelf: 'flex-start' }}>
                            {lang === 'bn' ? 'পাসওয়ার্ড রিসেট করুন' : 'Reset Password'}
                        </button>
                    </div>
                </motion.div>

                {/* Roles */}
                <motion.div className="card" variants={item}>
                    <div className="card-header">
                        <h3 className="card-title">{lang === 'bn' ? 'রোল' : 'Roles'}</h3>
                        <span className="badge badge-neutral">{roles.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {roles.map(role => (
                            <div key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB' }} />
                                <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>{role.name}</span>
                                <button
                                    onClick={() => deleteRole(role.id, role.name)}
                                    disabled={deletingRoleId === role.id}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', opacity: 0.6, fontSize: '0.875rem', padding: '2px 6px' }}
                                    title="Delete role">
                                    {deletingRoleId === role.id ? '...' : '×'}
                                </button>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input
                                className="input"
                                placeholder={lang === 'bn' ? 'নতুন রোল...' : 'New role name...'}
                                value={newRole}
                                onChange={e => setNewRole(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addRole()}
                                style={{ flex: 1 }}
                            />
                            <button className="btn btn-primary btn-sm" onClick={addRole} disabled={savingRole || !newRole.trim()}>
                                {savingRole ? '...' : '+'}
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Departments */}
                <motion.div className="card" variants={item}>
                    <div className="card-header">
                        <h3 className="card-title">{lang === 'bn' ? 'ডিপার্টমেন্ট' : 'Departments'}</h3>
                        <span className="badge badge-neutral">{departments.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {departments.map(dept => (
                            <div key={dept.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60A5FA' }} />
                                <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>{dept.name}</span>
                                <button
                                    onClick={() => deleteDept(dept.id, dept.name)}
                                    disabled={deletingDeptId === dept.id}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', opacity: 0.6, fontSize: '0.875rem', padding: '2px 6px' }}
                                    title="Delete department">
                                    {deletingDeptId === dept.id ? '...' : '×'}
                                </button>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input
                                className="input"
                                placeholder={lang === 'bn' ? 'নতুন ডিপার্টমেন্ট...' : 'New department name...'}
                                value={newDept}
                                onChange={e => setNewDept(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addDept()}
                                style={{ flex: 1 }}
                            />
                            <button className="btn btn-primary btn-sm" onClick={addDept} disabled={savingDept || !newDept.trim()}>
                                {savingDept ? '...' : '+'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Feature Toggles */}
            <motion.div className="card" variants={item} style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <h3 className="card-title">{lang === 'bn' ? 'ফিচার টগল' : 'Feature Toggles'}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {[
                        { key: 'whatsapp_enabled', icon: <IconMessageCircle size={18} />, bg: 'rgba(37,99,235,0.1)', color: '#2563EB', title: lang === 'bn' ? 'হোয়াটসঅ্যাপ ইন্টিগ্রেশন' : 'WhatsApp Integration', desc: lang === 'bn' ? 'অর্ডার এবং সমস্যার জন্য হোয়াটসঅ্যাপ লিংক দেখান' : 'Show WhatsApp links for orders and problems' },
                        { key: 'auto_assign_problems', icon: <IconTarget size={18} />, bg: 'rgba(234,88,12,0.1)', color: '#EA580C', title: lang === 'bn' ? 'অটো-অ্যাসাইন সমস্যা' : 'Auto-assign Problems', desc: lang === 'bn' ? 'কাস্টমার ফোন দিয়ে সমস্যা স্বয়ংক্রিয়ভাবে এমপ্লয়ীকে অ্যাসাইন করুন' : 'Automatically assign problems to the employee who handled the order' },
                        { key: 'smart_notifications', icon: <IconBell size={18} />, bg: 'rgba(202,138,4,0.1)', color: '#CA8A04', title: lang === 'bn' ? 'স্মার্ট নোটিফিকেশন' : 'Smart Notifications', desc: lang === 'bn' ? '২০০০+ অর্ডার, অমীমাংসিত সমস্যা, উপস্থিতি সতর্কতা' : 'Alerts for 2000+ orders, unresolved problems (24h), attendance anomalies' },
                        { key: 'quick_entry_default', icon: <IconBolt size={18} />, bg: 'rgba(124,58,237,0.1)', color: '#7C3AED', title: lang === 'bn' ? 'কুইক এন্ট্রি ডিফল্ট' : 'Quick Entry Default', desc: lang === 'bn' ? 'ওয়ার্ক লগে কুইক এন্ট্রি মোড ডিফল্ট চালু রাখুন' : 'Open Quick Entry mode by default on Work Log' },
                    ].map((feat, i, arr) => (
                        <div key={feat.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '34px', height: '34px', borderRadius: '8px',
                                    background: feat.bg, color: feat.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    {feat.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{feat.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{feat.desc}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleFeature(feat.key, !(features as Record<string, boolean>)[feat.key])}
                                disabled={featureSaving === feat.key}
                                style={{
                                    position: 'relative', width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                    background: (features as Record<string, boolean>)[feat.key] ? '#2563EB' : 'rgba(118,118,128,0.2)',
                                    transition: 'background 0.25s ease', flexShrink: 0,
                                }}
                            >
                                <span style={{
                                    position: 'absolute', top: '2px',
                                    left: (features as Record<string, boolean>)[feat.key] ? '22px' : '2px',
                                    width: '20px', height: '20px', borderRadius: '50%',
                                    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    transition: 'left 0.25s ease',
                                }} />
                            </button>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* App Info */}
            <motion.div className="card" variants={item} style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <h3 className="card-title">{lang === 'bn' ? 'অ্যাপ ইনফো' : 'App Info'}</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '24px' }}>
                    <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Version</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>1.0.0</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Framework</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Next.js 16</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Database</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Supabase</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Build</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Teamtrack v1.0</div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}
