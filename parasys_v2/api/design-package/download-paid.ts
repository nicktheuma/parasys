import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPaidDesignPackageZip } from '../_lib/handlers/designPackagePaid'
import { json, readJsonBody } from '../_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const body = await readJsonBody<{ sessionId?: string }>(req)
  const r = await buildPaidDesignPackageZip(body.sessionId ?? '')
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  res.status(200)
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${r.filename}"`)
  res.send(r.buffer)
}
