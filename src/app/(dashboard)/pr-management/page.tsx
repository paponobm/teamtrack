'use client'

import RequireFeature from '@/components/common/RequireFeature'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/LanguageContext'
import { IconClipboard, IconUsers } from '@/components/icons/Icons'
import PRManagementTabContent from '@/components/pr-management/PRManagementTabContent'
import InfluencersTab from '@/components/pr-management/InfluencersTab'

export default function PRManagementPage() {
    const { t } = useLanguage()
    const [mainTab, setMainTab] = useState<'pr' | 'influencers'>('influencers')

    return (
        <RequireFeature slugs={['pr-sending']}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    style={{ display: 'flex', position: 'relative', background: 'rgba(118,118,128,0.08)', borderRadius: '12px', padding: '3px', marginBottom: '16px', width: 'fit-content' }}>
                    {[
                        { key: 'influencers' as const, label: 'Influencers', icon: <IconUsers size={15} /> },
                        { key: 'pr' as const, label: t('pr.title') || 'PR Management', icon: <IconClipboard size={15} /> },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setMainTab(tab.key)}
                            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '9px', border: 'none', fontSize: '0.875rem', fontWeight: 600, background: 'transparent', color: mainTab === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', zIndex: 1 }}>
                            {mainTab === tab.key && (
                                <motion.div layoutId="prMainTab" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg-primary)', borderRadius: '9px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>{tab.icon}{tab.label}</span>
                        </button>
                    ))}
                </motion.div>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {mainTab === 'pr' ? <PRManagementTabContent /> : <InfluencersTab />}
                </div>
            </div>
        </RequireFeature>
    )
}
