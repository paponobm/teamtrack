'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

interface Employee {
    id: string
    name: string
    employee_id: string
    role: { name: string } | null
    department: { name: string } | null
    avatar_url?: string | null
}

interface Feature {
    id: string
    name: string
    name_bn: string
    category: string
    slug: string
    sort_order: number
}

interface Permission {
    employee_id: string
    feature_id: string
    access_level: 'admin' | 'member' | 'no_access'
}

const ACCESS_LEVELS = [
    { value: 'no_access', label: 'No Access', short: '-', color: '#E2E8F0', textColor: '#64748B' },
    { value: 'member', label: 'Member', short: 'M', color: '#DBEAFE', textColor: '#1E40AF' },
    { value: 'admin', label: 'Admin', short: 'A', color: '#2563EB', textColor: '#FFFFFF' },
] as const

type AccessLevel = 'admin' | 'member' | 'no_access'

export default function PermissionsPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [features, setFeatures] = useState<Feature[]>([])
    const [permissions, setPermissions] = useState<Record<string, AccessLevel>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [originalPermissions, setOriginalPermissions] = useState<Record<string, AccessLevel>>({})
    const [filterCategory, setFilterCategory] = useState('')
    const [searchEmployee, setSearchEmployee] = useState('')
    const [saveMessage, setSaveMessage] = useState('')

    // Build permission key
    const permKey = (empId: string, featId: string) => `${empId}::${featId}`

    const fetchData = useCallback(async () => {
        setLoading(true)
        const [empRes, featRes, permRes] = await Promise.all([
            fetch('/api/members?status=active'),
            fetch('/api/features'),
            fetch('/api/permissions'),
        ])

        const empData = await empRes.json()
        const featData = await featRes.json()
        const permData = await permRes.json()

        if (Array.isArray(empData)) setEmployees(empData)
        if (Array.isArray(featData)) setFeatures(featData)

        // Build permissions map
        const permMap: Record<string, AccessLevel> = {}
        if (Array.isArray(permData)) {
            permData.forEach((p: Permission) => {
                permMap[permKey(p.employee_id, p.feature_id)] = p.access_level
            })
        }
        setPermissions(permMap)
        setOriginalPermissions({ ...permMap })
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const cycleAccess = (empId: string, featId: string) => {
        const key = permKey(empId, featId)
        const current = permissions[key] || 'no_access'
        const cycle: AccessLevel[] = ['no_access', 'member', 'admin']
        const nextIndex = (cycle.indexOf(current) + 1) % cycle.length
        const next = cycle[nextIndex]

        setPermissions(prev => ({ ...prev, [key]: next }))
        setHasChanges(true)
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveMessage('')

        // Find changed permissions
        const changed: { employee_id: string; feature_id: string; access_level: AccessLevel }[] = []
        employees.forEach(emp => {
            features.forEach(feat => {
                const key = permKey(emp.id, feat.id)
                const current = permissions[key] || 'no_access'
                const original = originalPermissions[key] || 'no_access'
                if (current !== original) {
                    changed.push({
                        employee_id: emp.id,
                        feature_id: feat.id,
                        access_level: current,
                    })
                }
            })
        })

        if (changed.length === 0) {
            setSaving(false)
            setHasChanges(false)
            return
        }

        const res = await fetch('/api/permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions: changed }),
        })

        if (res.ok) {
            setOriginalPermissions({ ...permissions })
            setHasChanges(false)
            setSaveMessage(`${changed.length} permission${changed.length > 1 ? 's' : ''} updated`)
            setTimeout(() => setSaveMessage(''), 3000)
        } else {
            const err = await res.json().catch(() => ({}))
            setSaveMessage(`Save failed: ${err.error || 'please try again'}`)
            setTimeout(() => setSaveMessage(''), 5000)
        }

        setSaving(false)
    }

    const setAllForEmployee = (empId: string, level: AccessLevel) => {
        const updated = { ...permissions }
        features.forEach(feat => {
            updated[permKey(empId, feat.id)] = level
        })
        setPermissions(updated)
        setHasChanges(true)
    }

    const setAllForFeature = (featId: string, level: AccessLevel) => {
        const updated = { ...permissions }
        employees.forEach(emp => {
            updated[permKey(emp.id, featId)] = level
        })
        setPermissions(updated)
        setHasChanges(true)
    }

    // Get unique categories
    const categories = [...new Set(features.map(f => f.category).filter(Boolean))]

    // Filter features by category
    const filteredFeatures = filterCategory
        ? features.filter(f => f.category === filterCategory)
        : features

    // Filter employees by search
    const filteredEmployees = searchEmployee
        ? employees.filter(e =>
            e.name.toLowerCase().includes(searchEmployee.toLowerCase()) ||
            e.employee_id?.toLowerCase().includes(searchEmployee.toLowerCase())
        )
        : employees

    if (loading) {
        return (
            <div>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Permissions</h1>
                        <p className="page-subtitle">Loading...</p>
                    </div>
                </div>
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                    <span className="spinner" style={{ margin: '0 auto', display: 'block', width: '32px', height: '32px' }} />
                </div>
            </div>
        )
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Permissions</h1>
                    <p className="page-subtitle">
                        {employees.length} member{employees.length !== 1 ? 's' : ''} × {features.length} features
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {saveMessage && (
                        <span style={{
                            fontSize: '0.8125rem', color: '#2563EB', fontWeight: 500,
                            background: '#EFF6FF', padding: '6px 14px', borderRadius: '8px',
                        }}>
                            ✓ {saveMessage}
                        </span>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        id="save-permissions-btn"
                    >
                        {saving ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="spinner" style={{ width: '14px', height: '14px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                Saving...
                            </span>
                        ) : hasChanges ? 'Save Changes' : 'All Saved'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="header-search" style={{ width: '220px' }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="#94A3B8">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search members..."
                        value={searchEmployee}
                        onChange={(e) => setSearchEmployee(e.target.value)}
                    />
                </div>

                <select
                    className="input"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{ width: '180px', padding: '8px 12px', fontSize: '0.875rem' }}
                >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto', fontSize: '0.75rem', alignItems: 'center' }}>
                    {ACCESS_LEVELS.map(level => (
                        <div key={level.value} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '20px', height: '20px', borderRadius: '6px',
                                background: level.color, color: level.textColor,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.625rem', fontWeight: 700,
                                border: level.value === 'no_access' ? '1px solid #CBD5E1' : 'none',
                            }}>
                                {level.short}
                            </div>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{level.label}</span>
                        </div>
                    ))}
                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.6875rem' }}>
                        Click cell to cycle
                    </span>
                </div>
            </div>

            {/* Permission Grid */}
            <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: `${200 + filteredFeatures.length * 72}px` }}>
                    <thead>
                        <tr>
                            <th style={{
                                position: 'sticky', left: 0, zIndex: 10,
                                background: 'var(--color-bg-secondary)', minWidth: '180px',
                            }}>
                                Member
                            </th>
                            {filteredFeatures.map(feat => (
                                <th
                                    key={feat.id}
                                    style={{
                                        textAlign: 'center', padding: '8px 4px', fontSize: '0.625rem',
                                        minWidth: '68px', maxWidth: '80px', cursor: 'pointer',
                                        lineHeight: 1.2, verticalAlign: 'bottom',
                                    }}
                                    title={`${feat.name} (${feat.category}) - Click to set all`}
                                >
                                    <div style={{
                                        writingMode: 'vertical-lr', transform: 'rotate(180deg)',
                                        height: '80px', display: 'flex', alignItems: 'center',
                                        justifyContent: 'flex-end', margin: '0 auto',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {feat.name}
                                    </div>
                                    {/* Quick set buttons */}
                                    <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', marginTop: '4px' }}>
                                        <button
                                            onClick={() => setAllForFeature(feat.id, 'member')}
                                            style={{
                                                width: '16px', height: '16px', borderRadius: '3px',
                                                border: 'none', cursor: 'pointer', fontSize: '0.5rem', fontWeight: 700,
                                                background: '#DBEAFE', color: '#1E40AF',
                                            }}
                                            title="Set all to Member"
                                        >M</button>
                                        <button
                                            onClick={() => setAllForFeature(feat.id, 'no_access')}
                                            style={{
                                                width: '16px', height: '16px', borderRadius: '3px',
                                                border: '1px solid #CBD5E1', cursor: 'pointer', fontSize: '0.5rem', fontWeight: 700,
                                                background: '#F1F5F9', color: '#94A3B8',
                                            }}
                                            title="Set all to No Access"
                                        >×</button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map(emp => {
                            const accessCount = filteredFeatures.filter(f =>
                                (permissions[permKey(emp.id, f.id)] || 'no_access') !== 'no_access'
                            ).length

                            return (
                                <tr key={emp.id}>
                                    <td style={{
                                        position: 'sticky', left: 0, zIndex: 5,
                                        background: 'var(--color-surface)', borderRight: '1px solid var(--color-border-light)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                background: '#2563EB', color: 'white',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0, overflow: 'hidden',
                                            }}>
                                                {emp.avatar_url ? (
                                                    <img src={emp.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : emp.name[0]?.toUpperCase()}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: '0.8125rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                    {emp.name}
                                                </div>
                                                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)' }}>
                                                    {emp.department?.name || emp.role?.name || `ID: ${emp.employee_id}`}
                                                    {' · '}
                                                    <span style={{ color: accessCount > 0 ? '#2563EB' : 'var(--color-text-tertiary)' }}>
                                                        {accessCount}/{filteredFeatures.length}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Quick set for row */}
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
                                                <button
                                                    onClick={() => setAllForEmployee(emp.id, 'member')}
                                                    style={{
                                                        width: '18px', height: '18px', borderRadius: '4px',
                                                        border: 'none', cursor: 'pointer', fontSize: '0.5rem', fontWeight: 700,
                                                        background: '#DBEAFE', color: '#1E40AF',
                                                    }}
                                                    title="Set all to Member"
                                                >M</button>
                                                <button
                                                    onClick={() => setAllForEmployee(emp.id, 'no_access')}
                                                    style={{
                                                        width: '18px', height: '18px', borderRadius: '4px',
                                                        border: '1px solid #CBD5E1', cursor: 'pointer', fontSize: '0.5rem', fontWeight: 700,
                                                        background: '#F1F5F9', color: '#94A3B8',
                                                    }}
                                                    title="Set all to No Access"
                                                >×</button>
                                            </div>
                                        </div>
                                    </td>
                                    {filteredFeatures.map(feat => {
                                        const key = permKey(emp.id, feat.id)
                                        const level = permissions[key] || 'no_access'
                                        const config = ACCESS_LEVELS.find(l => l.value === level)!
                                        const changed = (originalPermissions[key] || 'no_access') !== level

                                        return (
                                            <td
                                                key={feat.id}
                                                onClick={() => cycleAccess(emp.id, feat.id)}
                                                style={{
                                                    textAlign: 'center', padding: '6px 4px',
                                                    cursor: 'pointer', userSelect: 'none',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '32px', height: '24px', borderRadius: '6px',
                                                        background: config.color, color: config.textColor,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.6875rem', fontWeight: 700,
                                                        margin: '0 auto',
                                                        border: level === 'no_access' ? '1px solid #CBD5E1' : 'none',
                                                        outline: changed ? '2px solid #60A5FA' : 'none',
                                                        outlineOffset: '1px',
                                                        transition: 'all 0.15s',
                                                    }}
                                                    title={`${emp.name} → ${feat.name}: ${config.label}`}
                                                >
                                                    {config.short}
                                                </div>
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {filteredEmployees.length === 0 && (
                <div className="empty-state">
                    <h3>No members found</h3>
                    <p>Add members first to assign permissions.</p>
                </div>
            )}
        </motion.div>
    )
}
