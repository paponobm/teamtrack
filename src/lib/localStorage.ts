import fs from 'fs/promises'
import path from 'path'

// Resolved once relative to the process cwd (the project root) — UPLOAD_DIR in .env is
// intentionally a plain relative path, separate from Next's `public/` folder, so it matches
// the droplet's real deployment layout (a directory served by Nginx `alias`, outside the app
// bundle) rather than something Next would otherwise serve automatically.
export const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads')

function assertContained(resolved: string) {
    if (!resolved.startsWith(UPLOAD_ROOT + path.sep) && resolved !== UPLOAD_ROOT) {
        throw new Error('Path escapes upload root')
    }
}

export async function saveUploadedFile(bucket: string, fileName: string, buffer: Buffer): Promise<void> {
    const fullPath = path.resolve(UPLOAD_ROOT, bucket, fileName)
    assertContained(fullPath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
}

export function publicUrlFor(bucket: string, fileName: string): string {
    const base = process.env.NEXT_PUBLIC_UPLOADS_URL || '/uploads'
    return `${base.replace(/\/$/, '')}/${bucket}/${fileName}`
}

// Best-effort delete — never throws if the file is already gone.
export async function deleteUploadedFile(bucket: string, fileName: string): Promise<void> {
    const fullPath = path.resolve(UPLOAD_ROOT, bucket, fileName)
    assertContained(fullPath)
    await fs.unlink(fullPath).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== 'ENOENT') throw err
    })
}
