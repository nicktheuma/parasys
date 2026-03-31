import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listPublicConfigurators } from '../handlers/configurators.js'
import { json } from '../http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const r = await listPublicConfigurators()
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  json(res, 200, { items: r.items })
}
