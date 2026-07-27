'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SelfAttendance from '@/components/attendance/SelfAttendance'
import AttendanceHistory from '@/components/attendance/AttendanceHistory'
import MyLeaves from '@/components/attendance/MyLeaves'
import { usePermissions } from '@/lib/PermissionsContext'
import { useLanguage } from '@/lib/LanguageContext'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

export default function MyAttendancePage() {
    const { data: perms } = usePermissions()
    const { t, lang } = useLanguage()
    const [activeTab, setActiveTab] = useState<'today' | 'history' | 'leaves'>('today')

    return (
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div style={{ flex: 1 }}>
                    <h1 className="page-title">{t('nav.myAttendance')}</h1>
                    <p className="page-subtitle">{lang === 'bn' ? 'আপনার উপস্থিতি এবং ব্রেক ট্র্যাক করুন' : 'Track your daily working hours and breaks'}</p>
                </div>
                <div className="tabs" style={{ display: 'flex', background: 'var(--color-bg-primary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                    <button 
                        className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
                        onClick={() => setActiveTab('today')}
                        style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeTab === 'today' ? '#fff' : 'var(--color-text-secondary)', background: activeTab === 'today' ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Today
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                        style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeTab === 'history' ? '#fff' : 'var(--color-text-secondary)', background: activeTab === 'history' ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        History
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'leaves' ? 'active' : ''}`}
                        onClick={() => setActiveTab('leaves')}
                        style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, color: activeTab === 'leaves' ? '#fff' : 'var(--color-text-secondary)', background: activeTab === 'leaves' ? '#2563EB' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        Leaves
                    </button>
                </div>
            </motion.div>

            {perms?.employee_id ? (
                <AnimatePresence mode="wait">
                    {activeTab === 'today' ? (
                        <motion.div key="today" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                            <SelfAttendance />
                        </motion.div>
                    ) : activeTab === 'history' ? (
                        <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                            <AttendanceHistory />
                        </motion.div>
                    ) : (
                        <motion.div key="leaves" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                            <MyLeaves />
                        </motion.div>
                    )}
                </AnimatePresence>
            ) : (
                <motion.div className="card" variants={item} style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <svg width="48" height="48" viewBox="0 0 20 20" fill="var(--color-text-tertiary)" style={{ marginBottom: '16px' }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <h3 style={{ marginBottom: '8px', color: 'var(--color-text-secondary)' }}>No Employee Profile</h3>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Your account is not linked to an employee profile. Please contact an administrator.</p>
                </motion.div>
            )}
        </motion.div>
    )
}
