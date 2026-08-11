'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { IconWallet, IconFileText, IconShieldAlert } from '@/components/icons/Icons'
import SalaryDashboard from '@/components/payroll/SalaryDashboard'
import SalarySheet from '@/components/payroll/SalarySheet'

export default function PayrollManagementPage() {
    const { data, isLoading } = usePermissions()
    const [mainTab, setMainTab] = useState<'dashboard' | 'sheet'>('dashboard')

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
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '12px', padding: '3px', marginBottom: '16px', width: 'fit-content' }}>
                {[
                    { key: 'dashboard' as const, label: 'Salary Dashboard', icon: <IconWallet size={15} /> },
                    { key: 'sheet' as const, label: 'Salary Sheet', icon: <IconFileText size={15} /> },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setMainTab(tab.key)}
                        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '9px', border: 'none', fontSize: '0.875rem', fontWeight: 600, background: 'transparent', color: mainTab === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', zIndex: 1 }}>
                        {mainTab === tab.key && (
                            <motion.div layoutId="payrollMainTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '9px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                        )}
                        <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>{tab.icon}{tab.label}</span>
                    </button>
                ))}
            </motion.div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {mainTab === 'dashboard' ? <SalaryDashboard /> : <SalarySheet />}
            </div>
        </div>
    )
}
