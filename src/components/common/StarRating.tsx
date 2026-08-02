'use client'

import { useState } from 'react'

interface StarRatingProps {
    value: number
    onChange?: (value: number) => void
    size?: number
    readOnly?: boolean
}

// Interactive 1-5 star picker when `onChange` is provided; read-only display otherwise.
// Renders its own filled/outline star (rather than reusing the always-outlined IconStar)
// since a rating widget needs a solid "active" state to read at a glance.
export default function StarRating({ value, onChange, size = 16, readOnly = false }: StarRatingProps) {
    const [hover, setHover] = useState<number | null>(null)
    const interactive = !readOnly && !!onChange
    const display = hover ?? value

    return (
        <div style={{ display: 'inline-flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(star => {
                const filled = star <= display
                return (
                    <span
                        key={star}
                        onClick={() => interactive && onChange?.(star)}
                        onMouseEnter={() => interactive && setHover(star)}
                        onMouseLeave={() => interactive && setHover(null)}
                        style={{ display: 'flex', cursor: interactive ? 'pointer' : 'default', lineHeight: 0 }}
                    >
                        <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#F59E0B' : 'none'} stroke={filled ? '#F59E0B' : '#9CA3AF'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </span>
                )
            })}
        </div>
    )
}
