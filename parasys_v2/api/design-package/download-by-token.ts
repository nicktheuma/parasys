import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { DesignAssetFormat } from '../_lib/handlers/designPackageDownload'
import { buildDesignPackageByDownloadToken } from '../_lib/handlers/designPackageByToken'
import { json } from '../_lib/http'

function queryToken(req: VercelRequest): string {
  const q = req.query?.token
  if (typeof q === 'string') return q
  if (Array.isArray(q) && typeof q[0] === 'string') return q[0]
  return ''
}

function queryFormat(req: VercelRequest): DesignAssetFormat {
  const q = req.query?.format
  const s = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : ''
  return s === 'stl' ? 'stl' : 'pdf'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const r = await buildDesignPackageByDownloadToken(queryToken(req), queryFormat(req))
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  res.status(200)
  res.setHeader('Content-Type', r.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${r.filename}"`)
  res.send(r.buffer)
}
