import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPaidDesignAsset } from '../_lib/handlers/designPackagePaid'
import type { DesignAssetFormat } from '../_lib/handlers/designPackageDownload'
import { json, readJsonBody } from '../_lib/http'

function parseFormat(raw: unknown): DesignAssetFormat {
  return raw === 'stl' ? 'stl' : 'pdf'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const body = await readJsonBody<{ sessionId?: string; format?: string }>(req)
  const format = parseFormat(body.format)
  const r = await buildPaidDesignAsset(format, body.sessionId ?? '')
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  res.status(200)
  res.setHeader('Content-Type', r.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${r.filename}"`)
  res.send(r.buffer)
}
