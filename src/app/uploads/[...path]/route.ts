import fs from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { UPLOAD_ROOT } from '@/lib/localStorage'

const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv',
}

// GET /uploads/<bucket>/<...file> - serves locally-stored uploads in dev/without Nginx.
// In production, Nginx should serve this path directly via `alias` from the same UPLOAD_DIR
// (bypassing Node entirely) — this route is the fallback/dev-server equivalent of that alias.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path: segments } = await params

    const requested = path.resolve(UPLOAD_ROOT, ...segments)
    if (!requested.startsWith(UPLOAD_ROOT + path.sep)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let data: Buffer
    try {
        data = await fs.readFile(requested)
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const ext = path.extname(requested).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(new Uint8Array(data), {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    })
}
