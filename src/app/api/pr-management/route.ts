import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Optional filters
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const status = searchParams.get('status')
    
    try {
        let query = supabase
            .from('pr_management')
            .select(`
                *,
                created_by_user:employees!pr_management_created_by_fkey(id, name)
            `)
            .order('created_at', { ascending: false })

        if (start_date) {
            query = query.gte('send_date', start_date)
        }
        if (end_date) {
            query = query.lte('send_date', end_date)
        }
        if (status && status !== 'all') {
            query = query.eq('delivery_status', status)
        }

        const { data, error } = await query
        
        if (error) {
            console.error('Error fetching PRs:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const supabase = await createClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = await request.json()
        
        // Find the employee id for the current user
        const { data: employeeData } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', session.user.id)
            .single()

        if (employeeData) {
            payload.created_by = employeeData.id
        }

        // Handle Auto-Linking/Creating Influencer
        let influencerId = payload.influencer_id

        if (!influencerId && payload.customer_name) {
            let query = supabase.from('influencers').select('id').limit(1)
            
            if (payload.customer_phone) {
                query = query.eq('phone', payload.customer_phone)
            } else {
                query = query.eq('name', payload.customer_name)
            }

            const { data: existingInfluencer } = await query.maybeSingle()

            if (existingInfluencer) {
                influencerId = existingInfluencer.id
            } else {
                const { data: newInfluencer, error: infError } = await supabase
                    .from('influencers')
                    .insert([{
                        name: payload.customer_name,
                        phone: payload.customer_phone || null,
                        address: payload.address || null,
                    }])
                    .select('id')
                    .single()
                
                if (!infError && newInfluencer) {
                    influencerId = newInfluencer.id
                }
            }
            
            payload.influencer_id = influencerId
        }

        const { data, error } = await supabase
            .from('pr_management')
            .insert([payload])
            .select()

        if (error) {
            console.error('Error creating PR entry:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data: data[0] })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = await request.json()
        const { id, ...updates } = payload

        if (updates.send_date === '') {
            updates.send_date = null
        }

        if (!id) {
            return NextResponse.json({ error: 'Missing PR ID' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('pr_management')
            .update(updates)
            .eq('id', id)
            .select()

        if (error) {
            console.error('Error updating PR entry:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data: data[0] })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    const supabase = await createClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Missing PR ID' }, { status: 400 })
    }

    try {
        const { error } = await supabase
            .from('pr_management')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting PR entry:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
