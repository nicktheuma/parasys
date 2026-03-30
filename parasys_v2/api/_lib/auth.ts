import { timingSafeEqual } from 'node:crypto'
import type { UserRole } from '../../db/schema'
import { readSessionCookie, type SessionPayload, verifySessionToken } from './session'

function readCookieHeader(req: { headers: { cookie?: string | string[] } }): string | undefined {
  const c = req.headers.cookie
  if (Array.isArray(c)) return c.join('; ')
  return c
}

export async function getSession(
  req: { headers: { cookie?: string | string[] } },
): Promise<SessionPayload | null> {
  const token = readSessionCookie(readCookieHeader(req))
  if (!token) return null
  return verifySessionToken(token)
}

export async function isAdminRequest(
  req: { headers: { cookie?: string | string[] } },
): Promise<boolean> {
  const session = await getSession(req)
  return session?.role === 'admin'
}

export async function requireRole(
  req: { headers: { cookie?: string | string[] } },
  ...allowed: UserRole[]
): Promise<SessionPayload | null> {
  const session = await getSession(req)
  if (!session) return null
  if (!allowed.includes(session.role)) return null
  return session
}

export function verifyAdminPassword(password: string): boolean {
  const expected = (process.env.ADMIN_PASSWORD ?? '').trim()
  if (!expected) return false
  const input = password.trim()
  const a = Buffer.from(input, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
