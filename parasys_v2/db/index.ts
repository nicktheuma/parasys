import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

let cached: Db | null = null

export function getDb(): Db | null {
  const url = process.env.DATABASE_URL
  if (!url) return null
  if (cached) return cached
  const sql = neon(url)
  cached = drizzle(sql, { schema })
  return cached
}

export { schema }
