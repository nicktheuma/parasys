import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAdminRequest } from '../../_lib/auth'
import { createMaterial, listAllMaterials, listMaterials } from '../../_lib/handlers/materials'
import { json, readJsonBody } from '../../_lib/http'

function queryConfiguratorId(req: VercelRequest): string | null {
  const q = req.query?.configuratorId
  if (typeof q === 'string' && q) return q
  if (Array.isArray(q) && typeof q[0] === 'string') return q[0]
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const ok = await isAdminRequest(req)
    if (!ok) {
      json(res, 401, { error: 'Unauthorized' })
      return
    }
    const configuratorId = queryConfiguratorId(req)
    if (!configuratorId) {
      json(res, 400, { error: 'configuratorId query required' })
      return
    }
    const r = configuratorId === '__all__'
      ? await listAllMaterials()
      : await listMaterials(configuratorId)
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { items: r.items })
    return
  }

  if (req.method === 'POST') {
    const ok = await isAdminRequest(req)
    if (!ok) {
      json(res, 401, { error: 'Unauthorized' })
      return
    }
    const body = await readJsonBody<{
      configuratorId?: string
      folder?: string
      name?: string
      colorHex?: string
      shader?: unknown
    }>(req)
    const r = await createMaterial({
      configuratorId: body.configuratorId ?? '',
      folder: body.folder,
      name: body.name ?? '',
      colorHex: body.colorHex,
      shader: body.shader,
    })
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { item: r.item })
    return
  }

  json(res, 405, { error: 'Method not allowed' })
}
