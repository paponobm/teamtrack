import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/settings/features - get feature toggles (admin+)
export async function GET() {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single()

    if (error) {
        // If no settings row exists, create one with defaults
        const { data: newRow, error: insertErr } = await supabase
            .from('app_settings')
            .insert({
                whatsapp_enabled: false,
                auto_assign_problems: true,
                smart_notifications: true,
                quick_entry_default: false,
            })
            .select('*')
            .single()

        if (insertErr) {
            return NextResponse.json({
                whatsapp_enabled: false,
                auto_assign_problems: true,
                smart_notifications: true,
                quick_entry_default: false,
            })
        }
        return NextResponse.json(newRow)
    }

    return NextResponse.json(data)
}

// PUT /api/settings/features - update feature toggles (admin+)
export async function PUT(request: Request) {
    const auth = await requireAuth(3)
    if (!isAuthed(auth)) return auth

    const supabase = createAdminClient()
    const body = await request.json()

    // Whitelist: only allow known toggle fields
    const ALLOWED = ['whatsapp_enabled', 'auto_assign_problems', 'smart_notifications', 'quick_entry_default']
    const safeBody: Record<string, unknown> = {}
    for (const key of ALLOWED) {
        if (key in body) safeBody[key] = body[key]
    }
    if (Object.keys(safeBody).length === 0) {
        return NextResponse.json({ error: 'No valid settings fields provided' }, { status: 400 })
    }

    const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .limit(1)
        .single()

    if (existing) {
        const { data, error } = await supabase
            .from('app_settings')
            .update(safeBody)
            .eq('id', existing.id)
            .select('*')
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    } else {
        const { data, error } = await supabase
            .from('app_settings')
            .insert(safeBody)
            .select('*')
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }
}
