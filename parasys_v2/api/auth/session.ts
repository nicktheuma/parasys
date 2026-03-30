import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSession } from '../_lib/auth'
import { json } from '../_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const session = await getSession(req)
  if (!session) {
    json(res, 200, { ok: false })
    return
  }
  json(res, 200, { ok: true, role: session.role, userId: session.userId ?? null })
}
