import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildDesignPackageZip,
  isFreeDesignPackageAllowed,
} from '../_lib/handlers/designPackageDownload'
import { json, readJsonBody } from '../_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  if (!isFreeDesignPackageAllowed()) {
    json(res, 403, { error: 'Free design package download is disabled (set ALLOW_FREE_DESIGN_PACKAGE=true for dev)' })
    return
  }
  const body = await readJsonBody<{
    slug?: string
    widthMm?: number
    depthMm?: number
    heightMm?: number
  }>(req)
  const r = await buildDesignPackageZip(body.slug ?? '', {
    widthMm: body.widthMm,
    depthMm: body.depthMm,
    heightMm: body.heightMm,
  })
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  res.status(200)
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${r.filename}"`)
  res.send(r.buffer)
}
