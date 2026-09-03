'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { IconCake, IconPartyPopper, IconX } from '@/components/icons/Icons'
import { usePermissions } from '@/lib/PermissionsContext'

interface BirthdayMember {
    id: string
    name: string
    photo_url: string | null
    date_of_birth: string
    designation: string | null
    gender: string | null
}

// Falls back to "them" when gender isn't set, rather than guessing.
function pronounFor(gender: string | null) {
    if (gender === 'male') return 'him'
    if (gender === 'female') return 'her'
    return 'them'
}

// Same "who's on birthday today" card shown on the Members page — surfaced here too so every
// role sees it the moment they land on their dashboard, not just admins browsing Members.
// The wording adapts to the viewer: the birthday person themselves gets the personal "Happy
// Birthday!" greeting, while everyone else sees a prompt to go wish that person well.
export default function BirthdayBanner() {
    const { data: perms } = usePermissions()
    const [birthdayMembers, setBirthdayMembers] = useState<BirthdayMember[]>([])
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        fetch('/api/birthdays').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setBirthdayMembers(d)
        }).catch(() => { })
    }, [])

    if (dismissed || birthdayMembers.length === 0) return null

    const selfBirthdays = birthdayMembers.filter(bm => bm.id === perms.employee_id)
    const otherBirthdays = birthdayMembers.filter(bm => bm.id !== perms.employee_id)

    return (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{
            background: 'linear-gradient(135deg, #FFE4E6, #FFF7ED, #FEF3C7)',
            border: '1px solid #FBBF2440', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px', position: 'relative',
        }}>
            <button onClick={() => setDismissed(true)} style={{ position: 'absolute', top: '8px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, display: 'flex' }}>
                <IconX size={16} />
            </button>
            <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                    <IconCake size={28} color="#B45309" />
                    <IconPartyPopper size={28} color="#B45309" />
                </div>

                {selfBirthdays.length > 0 && (
                    <div style={{ marginBottom: otherBirthdays.length > 0 ? '14px' : 0 }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#B45309', marginBottom: '4px' }}>Happy Birthday!</h3>
                        {selfBirthdays.map(bm => (
                            <div key={bm.id} style={{ fontSize: '1rem', fontWeight: 600, color: '#92400E' }}>
                                {bm.name} {bm.designation ? `(${bm.designation})` : ''}
                            </div>
                        ))}
                        <p style={{ fontSize: '0.8125rem', color: '#B45309', marginTop: '8px', opacity: 0.8 }}>
                            Wishing you a wonderful day!
                        </p>
                    </div>
                )}

                {otherBirthdays.map(bm => (
                    <div key={bm.id}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#B45309', marginBottom: '4px' }}>
                            Today is {bm.name}{bm.designation ? ` (${bm.designation})` : ''}&apos;s birthday!
                        </h3>
                        <p style={{ fontSize: '0.8125rem', color: '#B45309', marginTop: '4px', opacity: 0.8 }}>
                            Wish {pronounFor(bm.gender)} a wonderful day!
                        </p>
                    </div>
                ))}
            </div>
        </motion.div>
    )
}
