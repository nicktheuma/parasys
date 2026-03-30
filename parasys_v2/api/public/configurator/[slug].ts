import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPublicConfigurator } from '../../_lib/handlers/configurators'
import { json } from '../../_lib/http'

function routeSlug(req: VercelRequest): string | null {
  const s = req.query?.slug
  if (typeof s === 'string' && s) return s
  if (Array.isArray(s) && typeof s[0] === 'string') return s[0]
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const slug = routeSlug(req)
  if (!slug) {
    json(res, 400, { error: 'Missing slug' })
    return
  }
  const r = await getPublicConfigurator(slug)
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  json(res, 200, { item: r.item })
}
