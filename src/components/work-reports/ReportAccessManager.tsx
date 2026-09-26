'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { IconSearch, IconChevronRight } from '@/components/icons/Icons'

interface EmployeeOption {
    id: string
    name: string
    employee_id: string | null
    avatar_url: string | null
    designation: string | null
    role?: { level: number | null } | null
}

interface AccessRow { id: string; viewer_id: string; target_id: string }

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || 'U').charCodeAt(0) % colors.length]
}

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

// Dedicated tab (next to Work Comparison, Super-Admin-only) for granting per-employee, per-target
// Daily Work Report visibility — e.g. giving "test member 2" the ability to see (and approve)
// only "salary"'s report, not everyone's. This is additive to, and independent of, the blanket
// "Daily Work Report (View All)" permission (still manageable from Members → Edit Member →
// Access → Work) — see work_report_access in prisma/schema.prisma and
// getWorkReportAccessTargets in src/lib/workReports.ts. Expanding an employee's row reveals a
// checklist of every other employee; checking one grants that specific visibility immediately.
export default function ReportAccessManager() {
    const { success: toastSuccess, error: toastError } = useToast()
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [grants, setGrants] = useState<AccessRow[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [savingPairKey, setSavingPairKey] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    useEffect(() => {
        let mounted = true
        ;(async () => {
            setLoading(true)
            try {
                const [empRes, accessRes] = await Promise.all([
                    fetch('/api/members?status=active').then(r => r.json()),
                    fetch('/api/work-report-access').then(r => r.json()),
                ])
                if (!mounted) return
                // A Super Admin/Owner already sees and can approve every report by default (see
                // canViewAllWorkReports), so managing their access here is moot — excluded from
                // this list entirely, both as a grantable viewer and as a target to grant.
                if (Array.isArray(empRes)) setEmployees(empRes.filter((e: EmployeeOption) => (e.role?.level ?? 99) > 2))
                if (Array.isArray(accessRes)) setGrants(accessRes)
            } finally {
                if (mounted) setLoading(false)
            }
        })()
        return () => { mounted = false }
    }, [])

    const targetsFor = (viewerId: string) => new Set(grants.filter(g => g.viewer_id === viewerId).map(g => g.target_id))

    const toggleTarget = async (viewerId: string, targetId: string) => {
        const currentTargets = targetsFor(viewerId)
        const wasGranted = currentTargets.has(targetId)
        const nextTargets = new Set(currentTargets)
        if (wasGranted) nextTargets.delete(targetId); else nextTargets.add(targetId)

        const pairKey = `${viewerId}:${targetId}`
        setSavingPairKey(pairKey)
        try {
            const res = await fetch('/api/work-report-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ viewer_id: viewerId, target_ids: [...nextTargets] }),
            })
            if (res.ok) {
                setGrants(prev => {
                    const withoutViewer = prev.filter(g => g.viewer_id !== viewerId)
                    const rebuilt = [...nextTargets].map(t => ({ id: `${viewerId}:${t}`, viewer_id: viewerId, target_id: t }))
                    return [...withoutViewer, ...rebuilt]
                })
                toastSuccess(wasGranted ? 'Access removed' : 'Access granted')
            } else {
                const err = await res.json().catch(() => ({}))
                toastError(err.error || 'Failed to update access')
            }
        } finally {
            setSavingPairKey(null)
        }
    }

    const filtered = employees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.employee_id || '').toLowerCase().includes(search.toLowerCase()))

    return (
        <motion.div initial="hidden" animate="show" variants={item}>
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Daily Work Report — Access</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', margin: '4px 0 0', maxWidth: '640px' }}>
                    Pick a person, then choose exactly whose Daily Work Report they can see and approve — e.g. give one employee access to just one other specific person&apos;s report, without opening up everyone else&apos;s. Normally a Member only sees their own report, a Manager also sees Members&apos;, and an Admin also sees Managers&apos;/Members&apos;; this grants a targeted exception on top of that.
                </p>
            </div>

            <div style={{ position: 'relative', width: '280px', marginBottom: '16px' }}>
                <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                <input className="form-input" type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: '34px', height: '36px', fontSize: '0.8125rem', width: '100%' }} />
            </div>

            {loading ? (
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', padding: '24px', textAlign: 'center' }}>Loading...</div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {filtered.length === 0 ? (
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', padding: '24px', textAlign: 'center' }}>No employees match your search.</div>
                    ) : filtered.map((emp, i) => {
                        const isExpanded = expandedId === emp.id
                        const grantedCount = targetsFor(emp.id).size
                        return (
                            <div key={emp.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer' }}
                                >
                                    <div className="avatar avatar-sm" style={{ background: getAvatarColor(emp.name), overflow: 'hidden', flexShrink: 0 }}>
                                        {emp.avatar_url ? (
                                            <img src={emp.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : emp.name[0]?.toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{emp.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{emp.designation || emp.employee_id || ''}</div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '999px',
                                        background: grantedCount > 0 ? 'rgba(22,163,74,0.1)' : 'var(--color-bg-secondary)',
                                        color: grantedCount > 0 ? '#16A34A' : 'var(--color-text-tertiary)',
                                    }}>
                                        {grantedCount > 0 ? `${grantedCount} report${grantedCount > 1 ? 's' : ''}` : 'No access'}
                                    </span>
                                    <span style={{ display: 'flex', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                                        <IconChevronRight size={16} color="var(--color-text-tertiary)" />
                                    </span>
                                </div>
                                {isExpanded && (
                                    <div style={{ padding: '4px 16px 14px 52px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', margin: '4px 0 8px' }}>
                                            Reports {emp.name} can see and approve:
                                        </div>
                                        {employees.filter(other => other.id !== emp.id).map(other => {
                                            const checked = targetsFor(emp.id).has(other.id)
                                            const pairKey = `${emp.id}:${other.id}`
                                            const isSaving = savingPairKey === pairKey
                                            return (
                                                <label key={other.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 4px', fontSize: '0.8125rem', cursor: isSaving ? 'wait' : 'pointer', opacity: isSaving ? 0.6 : 1 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={isSaving}
                                                        onChange={() => toggleTarget(emp.id, other.id)}
                                                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                                                    />
                                                    <span>{other.name}</span>
                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>{other.designation || other.employee_id || ''}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </motion.div>
    )
}
