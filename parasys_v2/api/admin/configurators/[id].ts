import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAdminRequest } from '../../_lib/auth'
import { deleteConfigurator, updateConfigurator } from '../../_lib/handlers/configurators'
import { json, readJsonBody } from '../../_lib/http'

function routeId(req: VercelRequest): string | null {
  const id = req.query?.id
  if (typeof id === 'string' && id) return id
  if (Array.isArray(id) && typeof id[0] === 'string') return id[0]
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = routeId(req)
  if (!id) {
    json(res, 400, { error: 'Missing configurator id' })
    return
  }

  if (req.method === 'PATCH') {
    const ok = await isAdminRequest(req)
    if (!ok) {
      json(res, 401, { error: 'Unauthorized' })
      return
    }
    const body = await readJsonBody<{
      name?: string
      slug?: string
      templateKey?: string
      clientLabel?: string | null
      settings?: { defaultDims?: { widthMm?: number; depthMm?: number; heightMm?: number } } | null
    }>(req)
    const r = await updateConfigurator(id, {
      name: body.name,
      slug: body.slug,
      templateKey: body.templateKey,
      clientLabel: body.clientLabel,
      settings: body.settings,
    })
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { item: r.item })
    return
  }

  if (req.method === 'DELETE') {
    const ok = await isAdminRequest(req)
    if (!ok) {
      json(res, 401, { error: 'Unauthorized' })
      return
    }
    const r = await deleteConfigurator(id)
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { ok: true })
    return
  }

  json(res, 405, { error: 'Method not allowed' })
}
