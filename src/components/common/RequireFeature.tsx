'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/lib/PermissionsContext'

interface RequireFeatureProps {
    slugs: string[]
    children: React.ReactNode
}

export default function RequireFeature({ slugs, children }: RequireFeatureProps) {
    const { data, isLoading } = usePermissions()
    const router = useRouter()

    useEffect(() => {
        if (isLoading) return

        let authorized = false
        if (data.is_super) {
            authorized = true
        } else if (data.permissions) {
            authorized = slugs.some(slug => data.permissions![slug] && data.permissions![slug] !== 'no_access')
        }

        if (!authorized) {
            router.push('/dashboard')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, data, slugs.join(','), router])

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="spinner" style={{ width: 30, height: 30, border: '3px solid var(--color-border-light)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
            </div>
        )
    }

    let authorized = false
    if (data.is_super) {
        authorized = true
    } else if (data.permissions) {
        authorized = slugs.some(slug => data.permissions![slug] && data.permissions![slug] !== 'no_access')
    }

    if (!authorized) {
        return null // Will redirect to dashboard anyway
    }

    return <>{children}</>
}
