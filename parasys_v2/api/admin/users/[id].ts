import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireRole } from '../../_lib/auth'
import { deleteUser, updateUser } from '../../_lib/handlers/users'
import { json, readJsonBody } from '../../_lib/http'

function routeId(req: VercelRequest): string | null {
  const id = req.query?.id
  if (typeof id === 'string' && id) return id
  if (Array.isArray(id) && typeof id[0] === 'string') return id[0]
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await requireRole(req, 'admin')
  if (!session) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }
  const id = routeId(req)
  if (!id) {
    json(res, 400, { error: 'Missing user id' })
    return
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody<{
      email?: string
      password?: string
      role?: string
    }>(req)
    const r = await updateUser(id, body, session.userId)
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { item: r.item })
    return
  }

  if (req.method === 'DELETE') {
    if (session.userId === id) {
      json(res, 400, { error: 'Cannot delete your own account' })
      return
    }
    const r = await deleteUser(id, session.userId)
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { ok: true })
    return
  }

  json(res, 405, { error: 'Method not allowed' })
}
