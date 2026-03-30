import bcrypt from 'bcryptjs'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '../../../db/index'
import { type UserRole, users } from '../../../db/schema'
import { logAuditEvent } from '../auditLog'

const VALID_ROLES = new Set<UserRole>(['admin', 'editor', 'viewer'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UserRow = {
  id: string
  email: string
  role: UserRole
  createdAt: Date
}

function sanitize(row: typeof users.$inferSelect): UserRow {
  return { id: row.id, email: row.email, role: row.role, createdAt: row.createdAt }
}

export async function listUsers(): Promise<
  { ok: true; items: UserRow[] } | { ok: false; status: number; error: string }
> {
  const db = getDb()
  if (!db) return { ok: false, status: 500, error: 'Database not configured' }
  const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200)
  return { ok: true, items: rows.map(sanitize) }
}

export async function createUser(
  input: { email?: string; password?: string; role?: string },
  actorId?: string,
): Promise<{ ok: true; item: UserRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) return { ok: false, status: 500, error: 'Database not configured' }

  const email = (input.email ?? '').toLowerCase().trim()
  if (!EMAIL_RE.test(email)) return { ok: false, status: 400, error: 'Invalid email' }
  const password = input.password ?? ''
  if (password.length < 8) return { ok: false, status: 400, error: 'Password must be at least 8 characters' }
  const role: UserRole = VALID_ROLES.has(input.role as UserRole) ? (input.role as UserRole) : 'viewer'

  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const [row] = await db.insert(users).values({ email, passwordHash, role }).returning()
    if (!row) return { ok: false, status: 500, error: 'Insert failed' }
    await logAuditEvent(actorId, 'create_user', 'user', row.id, { email, role })
    return { ok: true, item: sanitize(row) }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { ok: false, status: 409, error: 'Email already in use' }
    }
    return { ok: false, status: 500, error: 'Failed to create user' }
  }
}

export async function updateUser(
  id: string,
  input: { email?: string; password?: string; role?: string },
  actorId?: string,
): Promise<{ ok: true; item: UserRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) return { ok: false, status: 500, error: 'Database not configured' }

  const patch: Partial<typeof users.$inferInsert> = {}
  if (input.email !== undefined) {
    const email = input.email.toLowerCase().trim()
    if (!EMAIL_RE.test(email)) return { ok: false, status: 400, error: 'Invalid email' }
    patch.email = email
  }
  if (input.password !== undefined) {
    if (input.password.length < 8) return { ok: false, status: 400, error: 'Password must be at least 8 characters' }
    patch.passwordHash = await bcrypt.hash(input.password, 12)
  }
  if (input.role !== undefined && VALID_ROLES.has(input.role as UserRole)) {
    patch.role = input.role as UserRole
  }

  if (Object.keys(patch).length === 0) return { ok: false, status: 400, error: 'Nothing to update' }

  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning()
  if (!row) return { ok: false, status: 404, error: 'User not found' }
  await logAuditEvent(actorId, 'update_user', 'user', id, { fields: Object.keys(patch) })
  return { ok: true, item: sanitize(row) }
}

export async function deleteUser(
  id: string,
  actorId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) return { ok: false, status: 500, error: 'Database not configured' }
  const [row] = await db.delete(users).where(eq(users.id, id)).returning()
  if (!row) return { ok: false, status: 404, error: 'User not found' }
  await logAuditEvent(actorId, 'delete_user', 'user', id, { email: row.email })
  return { ok: true }
}
