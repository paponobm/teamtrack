import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/todo - Get all personal todos for the authenticated employee
export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const emp = auth.employee

    const { data, error } = await supabase
        .from('personal_todos')
        .select('*')
        .eq('employee_id', emp.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}

// POST /api/todo - Create a new personal todo
export async function POST(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const emp = auth.employee

    try {
        const body = await request.json()
        const { title, description, due_date, color, is_pinned } = body

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('personal_todos')
            .insert({
                employee_id: emp.id,
                title: title.trim(),
                description: description ? description.trim() : null,
                due_date: due_date || null,
                color: color || null,
                is_pinned: is_pinned || false,
                completed: false
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data, { status: 201 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 })
    }
}

// PUT /api/todo - Update a personal todo
export async function PUT(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const emp = auth.employee

    try {
        const body = await request.json()
        const { id, title, description, completed, due_date, color, is_pinned } = body

        if (!id) {
            return NextResponse.json({ error: 'Todo ID is required' }, { status: 400 })
        }

        // Prepare updates
        const updates: any = {
            updated_at: new Date().toISOString()
        }
        if (title !== undefined) updates.title = title.trim()
        if (description !== undefined) updates.description = description ? description.trim() : null
        if (completed !== undefined) updates.completed = completed
        if (due_date !== undefined) updates.due_date = due_date || null
        if (color !== undefined) updates.color = color || null
        if (is_pinned !== undefined) updates.is_pinned = is_pinned

        const { data, error } = await supabase
            .from('personal_todos')
            .update(updates)
            .eq('id', id)
            .eq('employee_id', emp.id) // Safety check: must own it
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 })
    }
}

// DELETE /api/todo - Delete a personal todo
export async function DELETE(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth

    const supabase = auth.supabase
    const emp = auth.employee

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Todo ID is required' }, { status: 400 })
    }

    const { error } = await supabase
        .from('personal_todos')
        .delete()
        .eq('id', id)
        .eq('employee_id', emp.id) // Safety check

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Todo deleted successfully' })
}
