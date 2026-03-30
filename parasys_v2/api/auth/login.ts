import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loginWithPassword } from '../_lib/handlers/login'
import { json, readJsonBody } from '../_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const body = await readJsonBody<{ email?: string; password?: string }>(req)
  const secure = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'
  const r = await loginWithPassword(body.password ?? '', secure, body.email)
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  res.setHeader('Set-Cookie', r.setCookie)
  json(res, 200, { ok: true })
}
