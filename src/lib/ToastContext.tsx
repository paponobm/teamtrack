'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'

interface Toast {
    id: string
    type: 'success' | 'error' | 'info' | 'warning'
    message: string
    duration: number
}

interface ToastContextType {
    toasts: Toast[]
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
    warning: (message: string) => void
    dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) {
        // Fallback for when used outside provider - safe default
        return {
            toasts: [],
            success: (msg: string) => console.log('[toast:success]', msg),
            error: (msg: string) => console.error('[toast:error]', msg),
            info: (msg: string) => console.log('[toast:info]', msg),
            warning: (msg: string) => console.warn('[toast:warning]', msg),
            dismiss: () => {},
        }
    }
    return ctx
}

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const timers = useRef<Record<string, NodeJS.Timeout>>({})

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
        if (timers.current[id]) {
            clearTimeout(timers.current[id])
            delete timers.current[id]
        }
    }, [])

    const addToast = useCallback((type: Toast['type'], message: string, duration: number = 4000) => {
        const id = `toast-${++toastCounter}`
        setToasts(prev => {
            // Clear timers of any toasts being dropped by the cap so they don't leak.
            const dropped = prev.slice(0, Math.max(0, prev.length - 4))
            dropped.forEach(d => {
                if (timers.current[d.id]) { clearTimeout(timers.current[d.id]); delete timers.current[d.id] }
            })
            return [...prev.slice(-4), { id, type, message, duration }] // keep max 5
        })
        timers.current[id] = setTimeout(() => dismiss(id), duration)
    }, [dismiss])

    // Clear any outstanding timers when the provider unmounts.
    useEffect(() => {
        const t = timers.current
        return () => { Object.values(t).forEach(clearTimeout) }
    }, [])

    const success = useCallback((msg: string) => addToast('success', msg), [addToast])
    const error = useCallback((msg: string) => addToast('error', msg, 6000), [addToast])
    const info = useCallback((msg: string) => addToast('info', msg), [addToast])
    const warning = useCallback((msg: string) => addToast('warning', msg, 5000), [addToast])

    const value = useMemo<ToastContextType>(() => ({
        toasts, success, error, info, warning, dismiss,
    }), [toasts, success, error, info, warning, dismiss])

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    )
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    if (toasts.length === 0) return null

    return (
        <div style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999,
            display: 'flex', flexDirection: 'column', gap: '8px',
            pointerEvents: 'none', maxWidth: '400px',
        }}>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    )
}

const typeStyles: Record<string, { bg: string; border: string; icon: string; color: string }> = {
    success: { bg: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', icon: '✓', color: '#10B981' },
    error: { bg: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', icon: '✕', color: '#EF4444' },
    info: { bg: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)', icon: 'ℹ', color: '#2563EB' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', icon: '⚠', color: '#F59E0B' },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
    const [visible, setVisible] = useState(false)
    const style = typeStyles[toast.type]

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true))
    }, [])

    return (
        <div
            style={{
                pointerEvents: 'auto',
                background: style.bg,
                backdropFilter: 'blur(12px)',
                border: style.border,
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                cursor: 'pointer',
            }}
            onClick={() => onDismiss(toast.id)}
        >
            <span style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: style.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
            }}>
                {style.icon}
            </span>
            <span style={{
                fontSize: '0.8125rem', fontWeight: 500,
                color: 'var(--color-text-primary, #1a1a1a)',
                lineHeight: 1.4, flex: 1,
            }}>
                {toast.message}
            </span>
            <span style={{
                fontSize: '0.75rem', color: 'var(--color-text-tertiary, #999)',
                flexShrink: 0, cursor: 'pointer', padding: '2px',
            }}>✕</span>
        </div>
    )
}
