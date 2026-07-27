'use client'

import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('Dashboard page error:', error)
    }, [error])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '24px', gap: '16px' }}>
            <div style={{ fontSize: '2.5rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary, #1a1a1a)' }}>Something went wrong</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary, #888)', maxWidth: '420px' }}>
                This page hit an unexpected error. You can try again, or head back to the dashboard.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => reset()}>Try again</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { window.location.href = '/dashboard' }}>Go to dashboard</button>
            </div>
        </div>
    )
}
