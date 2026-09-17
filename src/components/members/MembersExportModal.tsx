'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { IconX, IconPlus, IconPrinter, IconTrash, IconDownload } from '@/components/icons/Icons'

// A structural subset of the Members page's own Employee type — only the fields this export
// sheet can ever show a column for. Passing the page's full Employee[] in satisfies this
// automatically (TypeScript structural typing), no separate mapping needed at the call site.
export interface ExportableEmployee {
    id: string
    name: string
    employee_id: string
    email: string
    designation: string
    personal_contact: string
    whatsapp_number: string
    is_active: boolean
    joining_date: string
    termination_date: string | null
    department: { id: string; name: string } | null
    role: { id: string; name: string; level: number } | null
    address: string
    nid_no: string
    blood_group: string
    family_contact_1: string
    family_contact_2: string
    gender: string | null
    date_of_birth: string | null
}

interface FieldDef {
    key: string
    label: string
    getValue: (m: ExportableEmployee) => string
}

function formatDate(d: string | null) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

// RFC 4180 quoting — a cell only needs wrapping when it actually contains a comma, quote, or
// newline; an embedded quote is escaped by doubling it. Address/Email/Family Contact are free
// text and can legitimately contain commas, so this can't be skipped like the simpler exports
// elsewhere in the app that only ever format plain numbers/short labels.
function csvCell(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Mirrors the same fields already shown on the Member Profile view (see members/page.tsx's
// Detail Grid) — anything visible on a profile is fair game to put in a column here.
const AVAILABLE_FIELDS: FieldDef[] = [
    { key: 'name', label: 'Employee Name', getValue: m => m.name || '-' },
    { key: 'employee_id', label: 'Employee ID', getValue: m => m.employee_id || '-' },
    { key: 'designation', label: 'Designation', getValue: m => m.designation || '-' },
    { key: 'role', label: 'Role', getValue: m => m.role?.name || '-' },
    { key: 'department', label: 'Department', getValue: m => m.department?.name || '-' },
    { key: 'status', label: 'Status', getValue: m => m.is_active ? 'Active' : 'Inactive' },
    { key: 'email', label: 'Email', getValue: m => m.email || '-' },
    { key: 'phone', label: 'Phone', getValue: m => m.personal_contact || '-' },
    { key: 'whatsapp', label: 'WhatsApp', getValue: m => m.whatsapp_number || '-' },
    { key: 'address', label: 'Address', getValue: m => m.address || '-' },
    { key: 'nid_no', label: 'NID No.', getValue: m => m.nid_no || '-' },
    { key: 'blood_group', label: 'Blood Group', getValue: m => m.blood_group || '-' },
    { key: 'gender', label: 'Gender', getValue: m => m.gender ? m.gender.charAt(0).toUpperCase() + m.gender.slice(1) : '-' },
    { key: 'date_of_birth', label: 'Date of Birth', getValue: m => formatDate(m.date_of_birth) },
    { key: 'joining_date', label: 'Joining Date', getValue: m => formatDate(m.joining_date) },
    { key: 'termination_date', label: 'Termination Date', getValue: m => formatDate(m.termination_date) },
    { key: 'family_contact_1', label: 'Family Contact 1', getValue: m => m.family_contact_1 || '-' },
    { key: 'family_contact_2', label: 'Family Contact 2', getValue: m => m.family_contact_2 || '-' },
]

// One selected column, in the exact order it was picked. `fieldKey: null` is a blank, manually
// labeled column (added via "+ Empty Column") with no data of its own — meant to be filled in
// by hand after printing (e.g. a signature or a checkbox the office fills in on paper).
interface SelectedColumn {
    id: string
    fieldKey: string | null
    label: string
}

export default function MembersExportModal({ members, onClose }: { members: ExportableEmployee[]; onClose: () => void }) {
    // 'build' is the picker/preview screen below; 'print' swaps to a plain print-only document
    // (reusing the same .payslip-printable print-isolation CSS the Pay Slip already relies on —
    // see globals.css's "Print isolation" block, written generically for exactly this reuse).
    const [phase, setPhase] = useState<'build' | 'print'>('build')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(members.map(m => m.id)))
    const [columns, setColumns] = useState<SelectedColumn[]>([])
    const [emptyColCount, setEmptyColCount] = useState(0)

    const toggleEmployee = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }
    const toggleAllEmployees = () => {
        setSelectedIds(prev => prev.size === members.length ? new Set() : new Set(members.map(m => m.id)))
    }

    // Clicking a field a second time removes it — the exact same toggle a checkbox would give,
    // but expressed as buttons so the "Column Order" list below can double as the only place
    // showing (and letting you remove) what's already selected.
    const toggleField = (field: FieldDef) => {
        setColumns(prev => prev.some(c => c.fieldKey === field.key)
            ? prev.filter(c => c.fieldKey !== field.key)
            : [...prev, { id: `field-${field.key}`, fieldKey: field.key, label: field.label }])
    }
    const addEmptyColumn = () => {
        const n = emptyColCount + 1
        setEmptyColCount(n)
        setColumns(prev => [...prev, { id: `empty-${Date.now()}-${n}`, fieldKey: null, label: `Column ${n}` }])
    }
    const removeColumn = (id: string) => setColumns(prev => prev.filter(c => c.id !== id))
    const renameColumn = (id: string, label: string) => setColumns(prev => prev.map(c => c.id === id ? { ...c, label } : c))

    const selectedMembers = useMemo(() => members.filter(m => selectedIds.has(m.id)), [members, selectedIds])
    const getCellValue = (col: SelectedColumn, m: ExportableEmployee) =>
        col.fieldKey === null ? '' : (AVAILABLE_FIELDS.find(f => f.key === col.fieldKey)?.getValue(m) || '')

    const canExport = selectedMembers.length > 0 && columns.length > 0

    // Same SL + column-order data the printable table and the live preview already show — built
    // fresh from `columns`/`selectedMembers` here too rather than reading it back off the DOM, so
    // it can never drift from what's on screen.
    const downloadCSV = () => {
        const headerRow = ['SL', ...columns.map(c => c.label)]
        const dataRows = selectedMembers.map((m, i) => [String(i + 1), ...columns.map(col => getCellValue(col, m))])
        const csv = [headerRow, ...dataRows].map(row => row.map(csvCell).join(',')).join('\r\n')
        // Leading BOM so Excel (which otherwise guesses Latin-1) opens this as UTF-8 — needed
        // since names/addresses here can contain Bangla text, not just ASCII.
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `employee-list-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (phase === 'print') {
        return (
            <div className="modal-overlay">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="modal payslip-printable" style={{ maxWidth: '95vw', width: '100%', maxHeight: '92vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="payslip-no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--color-border-light)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPhase('build')}>← Back to Editor</button>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={downloadCSV}>
                                <IconDownload size={15} /> Export CSV
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                                <IconPrinter size={15} /> Print / Save as PDF
                            </button>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}><IconX size={18} /></button>
                        </div>
                    </div>
                    {/* Printable document — hardcoded to a light paper look regardless of app theme,
                        same convention the Pay Slip's own printable area already uses. */}
                    <div style={{ background: '#ffffff', color: '#111827', padding: '32px', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>Employee List</div>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                Generated {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #D1D5DB', padding: '8px 10px', background: '#F3F4F6', textAlign: 'left' }}>SL</th>
                                    {columns.map(col => (
                                        <th key={col.id} style={{ border: '1px solid #D1D5DB', padding: '8px 10px', background: '#F3F4F6', textAlign: 'left' }}>{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {selectedMembers.map((m, i) => (
                                    <tr key={m.id}>
                                        <td style={{ border: '1px solid #D1D5DB', padding: '8px 10px' }}>{i + 1}</td>
                                        {columns.map(col => (
                                            <td key={col.id} style={{ border: '1px solid #D1D5DB', padding: '8px 10px' }}>{getCellValue(col, m)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                className="modal" style={{ maxWidth: '1000px', width: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">Export Members</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}><IconX size={18} /></button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Step 1 */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <label className="form-label" style={{ margin: 0 }}>1. Select Employees ({selectedMembers.length}/{members.length})</label>
                                <button className="btn btn-ghost btn-sm" onClick={toggleAllEmployees}>
                                    {selectedIds.size === members.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '10px', maxHeight: '260px', overflow: 'auto' }}>
                                {members.map(m => (
                                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)' }}>
                                        <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleEmployee(m.id)} />
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{m.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{m.designation || ''}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div>
                            <label className="form-label">2. Select Fields (click order = column order)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                {AVAILABLE_FIELDS.map(f => {
                                    const active = columns.some(c => c.fieldKey === f.key)
                                    return (
                                        <button key={f.key} onClick={() => toggleField(f)}
                                            style={{
                                                padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                                border: active ? '1px solid #2563EB' : '1px solid var(--color-border-light)',
                                                background: active ? 'rgba(37,99,235,0.1)' : 'var(--color-surface)',
                                                color: active ? '#2563EB' : 'var(--color-text-secondary)',
                                            }}>
                                            {f.label}
                                        </button>
                                    )
                                })}
                                <button onClick={addEmptyColumn}
                                    style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: '1px dashed var(--color-border-light)', background: 'var(--color-surface)', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <IconPlus size={12} /> Empty Column
                                </button>
                            </div>

                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '6px' }}>Column Order</div>
                            <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '10px', minHeight: '80px', maxHeight: '180px', overflow: 'auto', padding: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--color-bg-secondary)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: columns.length ? '6px' : 0 }}>
                                    <span style={{ width: '22px' }}>1</span>
                                    <span>SL (Serial Number — automatic)</span>
                                </div>
                                {columns.length === 0 ? (
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '16px' }}>No columns selected yet</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {columns.map((col, i) => (
                                            <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '6px' }}>
                                                <span style={{ width: '22px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{i + 2}</span>
                                                {col.fieldKey === null ? (
                                                    <input className="form-input" value={col.label} onChange={e => renameColumn(col.id, e.target.value)}
                                                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.8125rem' }} placeholder="Column name" />
                                                ) : (
                                                    <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 500 }}>{col.label}</span>
                                                )}
                                                <button onClick={() => removeColumn(col.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#DC2626' }}>
                                                    <IconTrash size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Live preview */}
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Preview</div>
                        <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '10px', overflow: 'auto', maxHeight: '220px' }}>
                            <table className="table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                <thead>
                                    <tr>
                                        <th>SL</th>
                                        {columns.map(col => <th key={col.id}>{col.label || 'Column'}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {columns.length === 0 ? (
                                        <tr><td style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '16px' }}>Select at least one field to preview</td></tr>
                                    ) : selectedMembers.length === 0 ? (
                                        <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '16px' }}>No employees selected</td></tr>
                                    ) : selectedMembers.map((m, i) => (
                                        <tr key={m.id}>
                                            <td>{i + 1}</td>
                                            {columns.map(col => <td key={col.id}>{getCellValue(col, m) || '—'}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!canExport} onClick={() => setPhase('print')}>
                        <IconPrinter size={15} /> Export PDF
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
