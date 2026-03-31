import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { createSessionToken, sessionCookieHeader } from '../session.js'
import { verifyAdminPassword } from '../auth.js'

export async function loginWithPassword(
  password: string,
  secure: boolean,
  email?: string,
): Promise<{ ok: true; setCookie: string } | { ok: false; status: number; error: string }> {
  if (email) {
    const db = getDb()
    if (db) {
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1)
      if (user && (await bcrypt.compare(password, user.passwordHash))) {
        try {
          const token = await createSessionToken({ role: user.role, userId: user.id })
          return { ok: true, setCookie: sessionCookieHeader(token, secure) }
        } catch {
          return { ok: false, status: 500, error: 'Session misconfigured' }
        }
      }
    }
    return { ok: false, status: 401, error: 'Invalid credentials' }
  }

  if (!verifyAdminPassword(password)) {
    return { ok: false, status: 401, error: 'Invalid password' }
  }
  try {
    const token = await createSessionToken({ role: 'admin' })
    const setCookie = sessionCookieHeader(token, secure)
    return { ok: true, setCookie }
  } catch {
    return { ok: false, status: 500, error: 'Session misconfigured' }
  }
}
