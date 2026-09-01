'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import FloatingCalculator from '@/components/layout/FloatingCalculator'
import { LanguageProvider } from '@/lib/LanguageContext'
import { ToastProvider } from '@/lib/ToastContext'
import { PermissionsProvider } from '@/lib/PermissionsContext'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [user, setUser] = useState<{ name: string; role: string; designation?: string | null; email: string; avatar_url?: string | null } | undefined>()
    const [ghostUser, setGhostUser] = useState(false)
    const [authChecked, setAuthChecked] = useState(false)

    useEffect(() => {
        // Load sidebar collapsed state
        try {
            const saved = localStorage.getItem('tt_sidebar_collapsed')
            if (saved === 'true') setSidebarCollapsed(true)
        } catch { /* */ }

        // Listen for sidebar toggle events
        const handleSidebarToggle = (e: Event) => {
            const detail = (e as CustomEvent).detail
            setSidebarCollapsed(detail.collapsed)
        }
        window.addEventListener('sidebar-toggle', handleSidebarToggle)

        const getUser = async () => {
            const res = await fetch('/api/auth/me')
            if (res.ok) {
                const data = await res.json()

                if (data.ghost) {
                    // Ghost User detected: session exists but no employee record
                    setGhostUser(true)
                    setAuthChecked(true)
                    return
                }

                // Account deactivated while logged in — sign out and bounce to login.
                if (data.deactivated) {
                    await fetch('/api/auth/logout', { method: 'POST' })
                    window.location.href = '/login?deactivated=1'
                    return
                }

                setUser({
                    name: data.name,
                    role: data.role,
                    designation: data.designation,
                    email: data.email,
                    avatar_url: data.avatar_url,
                })
            }
            setAuthChecked(true)
        }

        // Load saved appearance settings
        try {
            const saved = localStorage.getItem('teamtrack-appearance')
            if (saved) {
                const s = JSON.parse(saved)
                const root = document.documentElement

                // Color presets
                const colors: Record<string, { hover: string; light: string; dark: string }> = {
                    '#2563EB': { hover: '#1D4ED8', light: '#DBEAFE', dark: '#1E40AF' },
                    '#4F46E5': { hover: '#4338CA', light: '#E0E7FF', dark: '#3730A3' },
                    '#7C3AED': { hover: '#6D28D9', light: '#EDE9FE', dark: '#5B21B6' },
                    '#059669': { hover: '#047857', light: '#D1FAE5', dark: '#065F46' },
                    '#E11D48': { hover: '#BE123C', light: '#FFE4E6', dark: '#9F1239' },
                    '#D97706': { hover: '#B45309', light: '#FEF3C7', dark: '#92400E' },
                    '#0D9488': { hover: '#0F766E', light: '#CCFBF1', dark: '#115E59' },
                    '#0284C7': { hover: '#0369A1', light: '#E0F2FE', dark: '#075985' },
                }
                const color = colors[s.colorPreset]
                if (color) {
                    root.style.setProperty('--color-primary', s.colorPreset)
                    root.style.setProperty('--color-primary-hover', color.hover)
                    root.style.setProperty('--color-primary-light', color.light)
                    root.style.setProperty('--color-primary-dark', color.dark)
                    root.style.setProperty('--color-border-focus', s.colorPreset)
                }

                // Font
                const fonts: Record<string, { value: string; url: string }> = {
                    'Inter': { value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' },
                    'Roboto': { value: "'Roboto', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap' },
                    'Poppins': { value: "'Poppins', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap' },
                    'Plus Jakarta Sans': { value: "'Plus Jakarta Sans', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap' },
                    'DM Sans': { value: "'DM Sans', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap' },
                    'Outfit': { value: "'Outfit', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap' },
                }
                const font = fonts[s.fontPreset]
                if (font) {
                    if (!document.querySelector(`link[href="${font.url}"]`)) {
                        const link = document.createElement('link')
                        link.rel = 'stylesheet'
                        link.href = font.url
                        document.head.appendChild(link)
                    }
                    root.style.setProperty('--font-primary', font.value)
                }

                if (s.sidebarColor) root.style.setProperty('--sidebar-bg', s.sidebarColor)
                if (s.fontSize) root.style.fontSize = s.fontSize

                // Radius
                const radii: Record<string, { sm: string; md: string; lg: string; xl: string }> = {
                    'Sharp': { sm: '2px', md: '4px', lg: '6px', xl: '8px' },
                    'Default': { sm: '6px', md: '10px', lg: '14px', xl: '20px' },
                    'Rounded': { sm: '10px', md: '16px', lg: '20px', xl: '28px' },
                }
                const radius = radii[s.radiusPreset]
                if (radius) {
                    root.style.setProperty('--radius-sm', radius.sm)
                    root.style.setProperty('--radius-md', radius.md)
                    root.style.setProperty('--radius-lg', radius.lg)
                    root.style.setProperty('--radius-xl', radius.xl)
                }
            }
        } catch { /* ignore */ }

        getUser()

        return () => {
            window.removeEventListener('sidebar-toggle', handleSidebarToggle)
        }
    }, [])

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/login'
    }

    // Ghost User lockout screen - prevents unprovisioned users from accessing the dashboard
    if (authChecked && ghostUser) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                padding: '20px',
            }}>
                <div style={{
                    background: '#fff',
                    borderRadius: '20px',
                    padding: '48px 40px',
                    maxWidth: '460px',
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
                }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px', fontSize: '2rem',
                    }}>⏳</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                        Account Pending Setup
                    </h2>
                    <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
                        Your login was successful, but your employee profile hasn&apos;t been set up yet.
                        Please contact your administrator to complete your account setup.
                    </p>
                    <div style={{
                        background: '#f8fafc', borderRadius: '12px', padding: '16px',
                        border: '1px solid #e2e8f0', marginBottom: '24px', textAlign: 'left',
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                            What to tell your admin:
                        </div>
                        <ul style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.8, paddingLeft: '16px', margin: 0 }}>
                            <li>Ask them to create your employee profile in the Members section</li>
                            <li>Ensure your email is linked to the profile</li>
                            <li>Then try logging in again</li>
                        </ul>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%', padding: '12px 24px', borderRadius: '10px',
                            background: '#2563EB', color: '#fff', border: 'none',
                            fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1D4ED8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        )
    }

    return (
        <LanguageProvider>
            <PermissionsProvider>
                <ToastProvider>
                    <div className="app-layout" data-sidebar-collapsed={sidebarCollapsed}>
                        <Sidebar
                            user={user}
                            isOpen={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                        />
                        <Header onMenuClick={() => setSidebarOpen(true)} />
                        <main className="main-content">
                            {children}
                        </main>
                        <FloatingCalculator />
                    </div>
                </ToastProvider>
            </PermissionsProvider>
        </LanguageProvider>
    )
}
