import { requireAuth, isAuthed } from '@/lib/auth'
import { saveUploadedFile, publicUrlFor } from '@/lib/localStorage'
import { NextResponse } from 'next/server'

// POST /api/upload - upload a file to local disk (requires auth)
export async function POST(request: Request) {
    const auth = await requireAuth(0) // Any employee
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'avatars'
    const folder = (formData.get('folder') as string) || ''
    const employeeId = (formData.get('employee_id') as string) || ''

    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Only JPEG, PNG, WebP, and GIF images are allowed' }, { status: 400 })
    }

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'File size must be under 2MB' }, { status: 400 })
    }

    // Only allow known bucket names to prevent arbitrary directory creation
    const allowedBuckets = ['avatars', 'memories', 'attachments']
    if (!allowedBuckets.includes(bucket)) {
        return NextResponse.json({ error: 'Invalid storage bucket' }, { status: 400 })
    }

    // Members can only upload their own avatar
    if (bucket === 'avatars' && employeeId && employeeId !== auth.employee.id && auth.employee.roleLevel > 3) {
        return NextResponse.json({ error: 'Cannot upload avatar for another employee' }, { status: 403 })
    }

    // Sanitize folder to prevent path traversal / arbitrary key prefixes (strip slashes, dots, etc.)
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '')
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'jpg'
    const fileName = `${safeFolder ? safeFolder + '/' : ''}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    try {
        await saveUploadedFile(bucket, fileName, buffer)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save file' }, { status: 500 })
    }

    const publicUrl = publicUrlFor(bucket, fileName)

    // If employee_id is provided, directly save avatar_url to the employee record
    if (employeeId && bucket === 'avatars') {
        await db.query(`UPDATE employees SET avatar_url = $1 WHERE id = $2`, [publicUrl, employeeId])
    }

    return NextResponse.json({ url: publicUrl }, { status: 201 })
}
