import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildDesignAsset,
  isFreeDesignPackageAllowed,
  type DesignAssetFormat,
} from '../handlers/designPackageDownload.js'
import { json, readJsonBody } from '../http.js'

function parseFormat(raw: unknown): DesignAssetFormat {
  return raw === 'stl' ? 'stl' : 'pdf'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  if (!isFreeDesignPackageAllowed()) {
    json(res, 403, {
      error: 'Free design package download is disabled (set ALLOW_FREE_DESIGN_PACKAGE=true for dev)',
    })
    return
  }
  const body = await readJsonBody<{
    slug?: string
    widthMm?: number
    depthMm?: number
    heightMm?: number
    format?: string
    renderedPages?: {
      planPngDataUrl?: string | null
      sectionPngDataUrl?: string | null
      elevationPngDataUrl?: string | null
    } | null
  }>(req)
  const format = parseFormat(body.format)
  const r = await buildDesignAsset(format, body.slug ?? '', {
    widthMm: body.widthMm,
    depthMm: body.depthMm,
    heightMm: body.heightMm,
  }, { renderedPages: body.renderedPages ?? null })
  if (!r.ok) {
    json(res, r.status, { error: r.error })
    return
  }
  res.status(200)
  res.setHeader('Content-Type', r.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${r.filename}"`)
  res.send(r.buffer)
}
