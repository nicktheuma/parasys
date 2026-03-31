import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireRole } from '../auth.js'
import { createUser, listUsers } from '../handlers/users.js'
import { json, readJsonBody } from '../http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await requireRole(req, 'admin')
  if (!session) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    const r = await listUsers()
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { items: r.items })
    return
  }

  if (req.method === 'POST') {
    const body = await readJsonBody<{
      email?: string
      password?: string
      role?: string
    }>(req)
    const r = await createUser(body, session.userId)
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { item: r.item })
    return
  }

  json(res, 405, { error: 'Method not allowed' })
}
