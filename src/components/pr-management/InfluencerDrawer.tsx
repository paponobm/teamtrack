import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { IconX, IconUser, IconPhone, IconClipboard, IconStar, IconUsers } from '@/components/icons/Icons'
import { useToast } from '@/lib/ToastContext'

type Influencer = {
    id: string
    name: string
    phone: string | null
    page_url: string | null
    follower_count: number
    rating: number
    notes: string | null
    created_at: string
}

export default function InfluencerDrawer({ influencerId, onClose }: { influencerId: string, onClose: () => void }) {
    const supabase = createClient()
    const toast = useToast()
    const [influencer, setInfluencer] = useState<Influencer | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (influencerId) {
            fetchInfluencer()
        }
    }, [influencerId])

    const fetchInfluencer = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('influencers')
            .select('*')
            .eq('id', influencerId)
            .single()

        if (error) {
            toast.error('Failed to load influencer details')
        } else {
            setInfluencer(data)
        }
        setLoading(false)
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            />
            <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                style={{ 
                    width: '400px', 
                    maxWidth: '100%', 
                    background: 'var(--color-bg-primary)', 
                    height: '100%', 
                    position: 'relative', 
                    zIndex: 101,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.1)'
                }}
            >
                <div style={{ padding: '24px', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Influencer Details</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <IconX size={20} />
                    </button>
                </div>
                
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : influencer ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                    {influencer.name.charAt(0)}
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{influencer.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                        <IconPhone size={14} /> {influencer.phone || 'No phone'}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><IconUsers size={14} /> Followers</span>
                                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{influencer.follower_count.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><IconStar size={14} /> Rating</span>
                                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{influencer.rating}/5</span>
                                </div>
                                {influencer.page_url && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><IconClipboard size={14} /> Page</span>
                                        <a href={influencer.page_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', textDecoration: 'none' }}>Visit Page</a>
                                    </div>
                                )}
                            </div>

                            {influencer.notes && (
                                <div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>Notes</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                                        {influencer.notes}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '40px' }}>
                            Influencer not found.
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}
