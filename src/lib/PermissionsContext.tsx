'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface PermissionsData {
    employee_id: string | null
    role: string | null
    permissions: Record<string, string> | null
    is_super: boolean
    is_admin: boolean
}

interface PermissionsContextType {
    data: PermissionsData
    isLoading: boolean
    refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType>({
    data: { employee_id: null, role: null, permissions: null, is_super: false, is_admin: false },
    isLoading: true,
    refresh: async () => {},
})

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<PermissionsData>({ employee_id: null, role: null, permissions: null, is_super: false, is_admin: false })
    const [isLoading, setIsLoading] = useState(true)

    const fetchPermissions = async () => {
        // Retry a few times so a transient network blip doesn't leave the user with the
        // all-denied defaults (which would wrongly lock them out of pages via RequireFeature).
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const res = await fetch('/api/permissions/me')
                if (res.ok) {
                    const json = await res.json()
                    setData({
                        employee_id: json.employee_id || null,
                        role: json.role || null,
                        permissions: json.permissions || {},
                        is_super: json.is_super || false,
                        is_admin: json.is_admin || false,
                    })
                    setIsLoading(false)
                    return
                }
            } catch {
                // retry
            }
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        }
        // All attempts failed — stop loading but keep whatever data we had.
        setIsLoading(false)
    }

    useEffect(() => {
        fetchPermissions()
    }, [])

    return (
        <PermissionsContext.Provider value={{ data, isLoading, refresh: fetchPermissions }}>
            {children}
        </PermissionsContext.Provider>
    )
}

export const usePermissions = () => useContext(PermissionsContext)
