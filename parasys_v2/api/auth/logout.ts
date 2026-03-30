import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearSessionCookie } from '../_lib/session'
import { json } from '../_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const secure = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'
  res.setHeader('Set-Cookie', clearSessionCookie(secure))
  json(res, 200, { ok: true })
}
