import { SignJWT, jwtVerify } from 'jose'

// jose (not jsonwebtoken) because this is verified from middleware, which runs on the Edge
// runtime — Edge has no Node crypto module, but jose is built on Web Crypto and works in both.

export const SESSION_COOKIE = 'tt_session'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)
if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET environment variable.')
}

const SESSION_DURATION = '30d'

export interface SessionPayload {
    userId: string
    email: string
}

export async function signSession(payload: SessionPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(SESSION_DURATION)
        .sign(secret)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret)
        if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') return null
        return { userId: payload.userId, email: payload.email }
    } catch {
        return null
    }
}

export const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days, matches SESSION_DURATION above
}
