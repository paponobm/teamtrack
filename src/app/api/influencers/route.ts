import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    try {
        const { data: influencer, error } = await supabase
            .from('influencers')
            .select(`
                *,
                pr_entries:pr_management(id, delivery_status, video_status, created_at)
            `)
            .eq('id', id)
            .single()

        if (error) {
            console.error('Error fetching influencer:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Aggregate stats
        const prs = influencer.pr_entries || []
        const total_prs = prs.length
        const total_videos = prs.filter((p: any) => p.video_status === 'Video Uploaded').length
        const conversion_rate = total_prs > 0 ? Math.round((total_videos / total_prs) * 100) : 0

        return NextResponse.json({ 
            data: { 
                ...influencer, 
                stats: { total_prs, total_videos, conversion_rate } 
            } 
        })
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

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('influencers')
            .update(updates)
            .eq('id', id)
            .select()

        if (error) {
            console.error('Error updating influencer:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data: data[0] })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
