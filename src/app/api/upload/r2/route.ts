import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

export async function POST(request: Request) {
    const auth = await requireAuth(0) // Any employee
    if (!isAuthed(auth)) return auth

    try {
        const { filename, contentType, size } = await request.json()

        if (!filename || !contentType) {
            return NextResponse.json({ error: 'Filename and contentType are required' }, { status: 400 })
        }

        // Allow only known image/video types; derive the extension from the type (not the
        // client filename) to prevent content-type spoofing / stored-XSS via the public bucket.
        const ALLOWED_TYPES: Record<string, string> = {
            'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
            'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
        }
        const ext = ALLOWED_TYPES[contentType]
        if (!ext) {
            return NextResponse.json({ error: 'Unsupported file type. Only images and videos are allowed.' }, { status: 400 })
        }

        // Reject oversized uploads (50MB cap matches the UI).
        const MAX_BYTES = 50 * 1024 * 1024
        if (typeof size === 'number' && size > MAX_BYTES) {
            return NextResponse.json({ error: 'File is too large (max 50MB).' }, { status: 400 })
        }

        const uniqueFilename = `memories/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: uniqueFilename,
            ContentType: contentType,
        })

        // URL expires in 15 minutes
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 })

        // The public URL where the file will be accessible after upload
        // If NEXT_PUBLIC_R2_PUBLIC_URL is not set, we'll return a placeholder so the frontend doesn't crash
        const publicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-xxxxx.r2.dev'
        const publicUrl = `${publicBaseUrl}/${uniqueFilename}`

        return NextResponse.json({ presignedUrl, publicUrl, key: uniqueFilename })
    } catch (error) {
        console.error('R2 Presign Error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate upload URL' }, { status: 500 })
    }
}
