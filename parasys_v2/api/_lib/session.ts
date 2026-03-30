import { SignJWT, jwtVerify } from 'jose'
import { parse } from 'cookie'
import type { UserRole } from '../../db/schema'

const COOKIE = 'parasys_admin'

function getSecret(): Uint8Array {
  const s = (process.env.SESSION_SECRET ?? '').trim()
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET must be set (min 16 chars)')
  }
  return new TextEncoder().encode(s)
}

export type SessionPayload = {
  role: UserRole
  userId?: string
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getSecret()
  const builder = new SignJWT({ role: payload.role, sub: payload.userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
  return builder.sign(secret)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    const role = payload.role
    if (role !== 'admin' && role !== 'editor' && role !== 'viewer') return null
    return {
      role: role as UserRole,
      userId: typeof payload.sub === 'string' ? payload.sub : undefined,
    }
  } catch {
    return null
  }
}

export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const cookies = parse(cookieHeader)
  const v = cookies[COOKIE]
  return v ?? null
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  const parts = [
    `${COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=604800',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [`${COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export { COOKIE as SESSION_COOKIE_NAME }
