import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
    const supabase = await createClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { ids, updates } = await request.json()

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Missing PR IDs' }, { status: 400 })
        }
        
        if (!updates || Object.keys(updates).length === 0) {
             return NextResponse.json({ error: 'Missing updates' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('pr_management')
            .update(updates)
            .in('id', ids)
            .select()

        if (error) {
            console.error('Error updating bulk PR entries:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
