/**
 * Create a user from the CLI.
 * Usage: npm run db:create-user -- --email admin@example.com --password secret123 --role admin
 */
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from './index'
import { type UserRole, users } from './schema'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.join(__dirname, '..', '.env') })

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

async function main() {
  const email = arg('email')?.toLowerCase().trim()
  const password = arg('password')
  const role = (arg('role') ?? 'admin') as UserRole

  if (!email || !password) {
    console.error('Usage: tsx db/create-user.ts --email <email> --password <password> [--role admin|editor|viewer]')
    process.exit(1)
  }
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    console.error('Invalid role. Must be admin, editor, or viewer.')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const db = getDb()
  if (!db) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    console.error(`User ${email} already exists (id: ${existing.id}, role: ${existing.role})`)
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 12)
  const [row] = await db.insert(users).values({ email, passwordHash: hash, role }).returning()
  console.log(`Created user: ${row!.email} (role: ${row!.role}, id: ${row!.id})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
