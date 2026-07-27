'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

const STORAGE_KEY = 'teamtrack-appearance'

// --- Presets ---
const COLOR_PRESETS = [
    { name: 'Blue', value: '#2563EB', hover: '#1D4ED8', light: '#DBEAFE', dark: '#1E40AF' },
    { name: 'Indigo', value: '#4F46E5', hover: '#4338CA', light: '#E0E7FF', dark: '#3730A3' },
    { name: 'Violet', value: '#7C3AED', hover: '#6D28D9', light: '#EDE9FE', dark: '#5B21B6' },
    { name: 'Emerald', value: '#059669', hover: '#047857', light: '#D1FAE5', dark: '#065F46' },
    { name: 'Rose', value: '#E11D48', hover: '#BE123C', light: '#FFE4E6', dark: '#9F1239' },
    { name: 'Amber', value: '#D97706', hover: '#B45309', light: '#FEF3C7', dark: '#92400E' },
    { name: 'Teal', value: '#0D9488', hover: '#0F766E', light: '#CCFBF1', dark: '#115E59' },
    { name: 'Sky', value: '#0284C7', hover: '#0369A1', light: '#E0F2FE', dark: '#075985' },
]

const FONT_PRESETS = [
    { name: 'Inter', value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' },
    { name: 'Roboto', value: "'Roboto', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap' },
    { name: 'Poppins', value: "'Poppins', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap' },
    { name: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap' },
    { name: 'DM Sans', value: "'DM Sans', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap' },
    { name: 'Outfit', value: "'Outfit', -apple-system, sans-serif", url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap' },
]

const SIDEBAR_PRESETS = [
    { name: 'Slate', value: '#0F172A' },
    { name: 'Zinc', value: '#18181B' },
    { name: 'Navy', value: '#0C1222' },
    { name: 'Charcoal', value: '#1A1A2E' },
    { name: 'Deep Blue', value: '#0A1628' },
    { name: 'Graphite', value: '#27272A' },
]

const FONT_SIZE_PRESETS = [
    { name: 'Compact', value: '14px' },
    { name: 'Default', value: '16px' },
    { name: 'Large', value: '18px' },
]

const RADIUS_PRESETS = [
    { name: 'Sharp', sm: '2px', md: '4px', lg: '6px', xl: '8px' },
    { name: 'Default', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
    { name: 'Rounded', sm: '10px', md: '16px', lg: '20px', xl: '28px' },
]

interface AppearanceSettings {
    colorPreset: string
    fontPreset: string
    sidebarColor: string
    fontSize: string
    radiusPreset: string
    theme: 'light' | 'dark' | 'system'
}

const DEFAULTS: AppearanceSettings = {
    colorPreset: '#2563EB',
    fontPreset: 'Inter',
    sidebarColor: '#0F172A',
    fontSize: '16px',
    radiusPreset: 'Default',
    theme: 'light',
}

function loadSettings(): AppearanceSettings {
    if (typeof window === 'undefined') return DEFAULTS
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
    } catch { return DEFAULTS }
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <motion.div className="card" variants={item} style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>{title}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{description}</p>
            </div>
            {children}
        </motion.div>
    )
}

export default function AppearancePage() {
    const [settings, setSettings] = useState<AppearanceSettings>(DEFAULTS)
    const [message, setMessage] = useState('')

    useEffect(() => {
        setSettings(loadSettings())
    }, [])

    const applySettings = useCallback((s: AppearanceSettings) => {
        const root = document.documentElement

        // Color
        const color = COLOR_PRESETS.find(c => c.value === s.colorPreset)
        if (color) {
            root.style.setProperty('--color-primary', color.value)
            root.style.setProperty('--color-primary-hover', color.hover)
            root.style.setProperty('--color-primary-light', color.light)
            root.style.setProperty('--color-primary-dark', color.dark)
            root.style.setProperty('--color-border-focus', color.value)
        }

        // Font
        const font = FONT_PRESETS.find(f => f.name === s.fontPreset)
        if (font) {
            // Load font if needed
            if (!document.querySelector(`link[href="${font.url}"]`)) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = font.url
                document.head.appendChild(link)
            }
            root.style.setProperty('--font-primary', font.value)
        }

        // Sidebar
        root.style.setProperty('--sidebar-bg', s.sidebarColor)

        // Font size
        root.style.fontSize = s.fontSize

        // Radius
        const radius = RADIUS_PRESETS.find(r => r.name === s.radiusPreset)
        if (radius) {
            root.style.setProperty('--radius-sm', radius.sm)
            root.style.setProperty('--radius-md', radius.md)
            root.style.setProperty('--radius-lg', radius.lg)
            root.style.setProperty('--radius-xl', radius.xl)
        }

        // Theme
        if (s.theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
            localStorage.setItem('teamtrack-theme', prefersDark ? 'dark' : 'light')
        } else {
            root.setAttribute('data-theme', s.theme)
            localStorage.setItem('teamtrack-theme', s.theme)
        }
    }, [])

    // Apply on mount
    useEffect(() => {
        const s = loadSettings()
        applySettings(s)
    }, [applySettings])

    const updateSetting = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
        const updated = { ...settings, [key]: value }
        setSettings(updated)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        applySettings(updated)
    }

    const resetAll = () => {
        setSettings(DEFAULTS)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS))
        applySettings(DEFAULTS)
        setMessage('Reset to defaults')
        setTimeout(() => setMessage(''), 2000)
    }

    return (
        <motion.div variants={container} animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">Appearance</h1>
                    <p className="page-subtitle">Customize the look and feel of TeamTrack</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {message && (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 500, background: 'var(--color-primary-light)', padding: '6px 14px', borderRadius: '8px' }}>
                            ✓ {message}
                        </span>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={resetAll}>
                        Reset to Defaults
                    </button>
                </div>
            </motion.div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Theme */}
                <SectionCard title="Theme" description="Choose between light, dark, or system preference">
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {(['light', 'dark', 'system'] as const).map(theme => (
                            <button
                                key={theme}
                                onClick={() => updateSetting('theme', theme)}
                                style={{
                                    flex: 1, padding: '16px', borderRadius: 'var(--radius-lg)',
                                    border: settings.theme === theme ? '2px solid var(--color-primary)' : '2px solid var(--color-border-light)',
                                    background: settings.theme === theme ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: '10px',
                                }}
                            >
                                <div style={{
                                    width: '48px', height: '32px', borderRadius: '6px',
                                    background: theme === 'light' ? '#F8FAFE' : theme === 'dark' ? '#0F172A' : 'linear-gradient(135deg, #F8FAFE 50%, #0F172A 50%)',
                                    border: '1px solid var(--color-border)',
                                }} />
                                <span style={{
                                    fontSize: '0.8125rem', fontWeight: settings.theme === theme ? 600 : 500,
                                    color: settings.theme === theme ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    textTransform: 'capitalize',
                                }}>
                                    {theme}
                                </span>
                            </button>
                        ))}
                    </div>
                </SectionCard>

                {/* Primary Color */}
                <SectionCard title="Primary Color" description="Set the accent color used throughout the app">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                        {COLOR_PRESETS.map(color => (
                            <button
                                key={color.value}
                                onClick={() => updateSetting('colorPreset', color.value)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                    border: settings.colorPreset === color.value ? `2px solid ${color.value}` : '2px solid var(--color-border-light)',
                                    background: settings.colorPreset === color.value ? `${color.value}08` : 'var(--color-surface)',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                <div style={{
                                    width: '24px', height: '24px', borderRadius: '50%', background: color.value,
                                    boxShadow: settings.colorPreset === color.value ? `0 0 0 3px ${color.value}30` : 'none',
                                    transition: 'box-shadow 0.2s', flexShrink: 0,
                                }} />
                                <span style={{
                                    fontSize: '0.8125rem', fontWeight: settings.colorPreset === color.value ? 600 : 400,
                                    color: settings.colorPreset === color.value ? color.value : 'var(--color-text-secondary)',
                                }}>{color.name}</span>
                            </button>
                        ))}
                    </div>
                </SectionCard>

                {/* Font Family */}
                <SectionCard title="Font Family" description="Change the typeface used across the interface">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                        {FONT_PRESETS.map(font => (
                            <button
                                key={font.name}
                                onClick={() => updateSetting('fontPreset', font.name)}
                                style={{
                                    padding: '14px 16px', borderRadius: 'var(--radius-md)',
                                    border: settings.fontPreset === font.name ? '2px solid var(--color-primary)' : '2px solid var(--color-border-light)',
                                    background: settings.fontPreset === font.name ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                                }}
                            >
                                <div style={{
                                    fontSize: '1.125rem', fontWeight: 600, marginBottom: '4px',
                                    fontFamily: font.value,
                                    color: settings.fontPreset === font.name ? 'var(--color-primary)' : 'var(--color-text-primary)',
                                }}>Aa</div>
                                <div style={{
                                    fontSize: '0.75rem', fontWeight: 500,
                                    color: settings.fontPreset === font.name ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                                }}>{font.name}</div>
                            </button>
                        ))}
                    </div>
                </SectionCard>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Font Size */}
                    <SectionCard title="Font Size" description="Adjust the base text size">
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {FONT_SIZE_PRESETS.map(size => (
                                <button
                                    key={size.name}
                                    onClick={() => updateSetting('fontSize', size.value)}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                                        border: settings.fontSize === size.value ? '2px solid var(--color-primary)' : '2px solid var(--color-border-light)',
                                        background: settings.fontSize === size.value ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                    }}
                                >
                                    <span style={{
                                        fontSize: size.value, fontWeight: 700, lineHeight: 1,
                                        color: settings.fontSize === size.value ? 'var(--color-primary)' : 'var(--color-text-primary)',
                                    }}>A</span>
                                    <span style={{
                                        fontSize: '0.6875rem', fontWeight: 500,
                                        color: settings.fontSize === size.value ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                                    }}>{size.name}</span>
                                </button>
                            ))}
                        </div>
                    </SectionCard>

                    {/* Border Radius */}
                    <SectionCard title="Border Radius" description="Control the roundness of UI elements">
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {RADIUS_PRESETS.map(radius => (
                                <button
                                    key={radius.name}
                                    onClick={() => updateSetting('radiusPreset', radius.name)}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                                        border: settings.radiusPreset === radius.name ? '2px solid var(--color-primary)' : '2px solid var(--color-border-light)',
                                        background: settings.radiusPreset === radius.name ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                    }}
                                >
                                    <div style={{
                                        width: '32px', height: '24px',
                                        borderRadius: radius.lg,
                                        border: `2px solid ${settings.radiusPreset === radius.name ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                        transition: 'all 0.15s',
                                    }} />
                                    <span style={{
                                        fontSize: '0.6875rem', fontWeight: 500,
                                        color: settings.radiusPreset === radius.name ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                                    }}>{radius.name}</span>
                                </button>
                            ))}
                        </div>
                    </SectionCard>
                </div>

                {/* Sidebar Color */}
                <SectionCard title="Sidebar Color" description="Change the sidebar background color">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                        {SIDEBAR_PRESETS.map(preset => (
                            <button
                                key={preset.value}
                                onClick={() => updateSetting('sidebarColor', preset.value)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                    border: settings.sidebarColor === preset.value ? '2px solid var(--color-primary)' : '2px solid var(--color-border-light)',
                                    background: settings.sidebarColor === preset.value ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                <div style={{
                                    width: '24px', height: '24px', borderRadius: '6px', background: preset.value,
                                    boxShadow: settings.sidebarColor === preset.value ? '0 0 0 3px var(--color-primary)30' : 'inset 0 0 0 1px rgba(255,255,255,0.1)',
                                    transition: 'box-shadow 0.2s', flexShrink: 0,
                                }} />
                                <span style={{
                                    fontSize: '0.8125rem', fontWeight: settings.sidebarColor === preset.value ? 600 : 400,
                                    color: settings.sidebarColor === preset.value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                }}>{preset.name}</span>
                            </button>
                        ))}
                    </div>
                </SectionCard>

                {/* Preview */}
                <SectionCard title="Live Preview" description="See how your changes look">
                    <div style={{
                        display: 'grid', gridTemplateColumns: '200px 1fr', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border-light)', overflow: 'hidden', height: '180px',
                    }}>
                        {/* Mini sidebar */}
                        <div style={{ background: settings.sidebarColor, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'var(--color-primary)' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>TeamTrack</span>
                            </div>
                            {['Dashboard', 'Work Log', 'Members'].map((label, i) => (
                                <div key={label} style={{
                                    padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', fontWeight: 500,
                                    color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)',
                                    background: i === 0 ? 'rgba(255,255,255,0.1)' : 'transparent',
                                }}>{label}</div>
                            ))}
                        </div>
                        {/* Mini content */}
                        <div style={{ background: 'var(--color-bg)', padding: '16px' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px' }}>Dashboard</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {['Card 1', 'Card 2', 'Card 3'].map(label => (
                                    <div key={label} style={{
                                        flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                                        background: 'var(--color-surface)', border: '1px solid var(--color-border-light)',
                                    }}>
                                        <div style={{ fontSize: '0.625rem', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>{label}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>42</div>
                                    </div>
                                ))}
                            </div>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: '12px', fontSize: '0.6875rem', padding: '4px 12px' }}>
                                Sample Button
                            </button>
                        </div>
                    </div>
                </SectionCard>
            </div>
        </motion.div>
    )
}
