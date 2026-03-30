import type { VercelRequest, VercelResponse } from '@vercel/node'
import getRawBody from 'raw-body'
import { handleStripeWebhook } from '../_lib/handlers/stripeCheckout'
import { json } from '../_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const raw = await getRawBody(req)
  const sig = req.headers['stripe-signature']
  const signature = Array.isArray(sig) ? sig[0] : sig
  const r = await handleStripeWebhook(raw, signature)
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  json(res, 200, { received: true })
}
