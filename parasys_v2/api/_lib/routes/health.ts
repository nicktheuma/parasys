import type { VercelRequest, VercelResponse } from '@vercel/node'
import { count } from 'drizzle-orm'
import { getDb } from '../../../db/index.js'
import { configurators, propLibrary } from '../../../db/schema.js'
import { json } from '../http.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const db = getDb()
  if (!db) {
    json(res, 200, {
      ok: true,
      dbConfigured: false,
      note: 'DATABASE_URL not set',
    })
    return
  }

  try {
    const [{ value: configuratorCount } = { value: 0 }] = await db
      .select({ value: count() })
      .from(configurators)
    const [{ value: propCount } = { value: 0 }] = await db.select({ value: count() }).from(propLibrary)

    json(res, 200, {
      ok: true,
      dbConfigured: true,
      counts: {
        configurators: configuratorCount,
        props: propCount,
      },
    })
  } catch (e) {
    json(res, 200, {
      ok: true,
      dbConfigured: true,
      error: 'DB query failed',
    })
  }
}

