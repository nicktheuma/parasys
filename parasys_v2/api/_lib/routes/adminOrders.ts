import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAdminRequest } from '../auth.js'
import { listOrders } from '../handlers/orders.js'
import { json } from '../http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const ok = await isAdminRequest(req)
  if (!ok) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }
  const r = await listOrders()
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  json(res, 200, { items: r.items })
}
