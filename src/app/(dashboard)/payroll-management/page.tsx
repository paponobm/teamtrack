'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { IconShieldAlert, IconSearch } from '@/components/icons/Icons'
import SalaryDashboard from '@/components/payroll/SalaryDashboard'
import SalarySheet from '@/components/payroll/SalarySheet'

function currentMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

// Single page combining the Salary Dashboard's summary cards and the Salary Sheet table —
// previously two tabs behind a segmented switcher, now one shared Month + Search filter bar
// drives both, so switching months or searching an employee updates everything at once.
export default function PayrollManagementPage() {
    const { data, isLoading } = usePermissions()
    const [month, setMonth] = useState(currentMonth)
    const [search, setSearch] = useState('')

    if (isLoading) return null

    if (!data.is_super) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--color-text-tertiary)' }}>
                <IconShieldAlert size={32} />
                <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Access restricted to Super Admins</div>
            </div>
        )
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Payroll Management</h1>
                    <p className="page-subtitle">Monthly salary sheets, payroll totals, and payment tracking.</p>
                </div>
            </motion.div>

            <motion.div variants={item} style={{ marginBottom: '24px' }}>
                <SalaryDashboard month={month} />
            </motion.div>

            <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Month</label>
                    <input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.8125rem', width: 'auto' }} />
                </div>
                <div style={{ position: 'relative', width: '260px' }}>
                    <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><IconSearch size={15} color="var(--color-text-tertiary)" /></span>
                    <input className="form-input" type="text" placeholder="Search by employee ID or name..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: '34px', height: '38px', fontSize: '0.8125rem', width: '100%' }} />
                </div>
            </motion.div>

            <motion.div variants={item}>
                <SalarySheet month={month} search={search} />
            </motion.div>
        </motion.div>
    )
}
