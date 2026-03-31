import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDesignCheckout } from '../handlers/stripeCheckout.js'
import { json, readJsonBody } from '../http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const body = await readJsonBody<{
    slug?: string
    widthMm?: number
    depthMm?: number
    heightMm?: number
  }>(req)
  const hasDim =
    body.widthMm != null || body.depthMm != null || body.heightMm != null
  const dims = hasDim
    ? { widthMm: body.widthMm, depthMm: body.depthMm, heightMm: body.heightMm }
    : null
  const r = await createDesignCheckout(body.slug ?? '', dims)
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  json(res, 200, { url: r.url })
}
