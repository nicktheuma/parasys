import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { MaterialShaderSpec } from '../../../db/schema'
import { isAdminRequest } from '../auth.js'
import { listPropsAdmin, updatePropShader } from '../handlers/props.js'
import { json, readJsonBody } from '../http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await isAdminRequest(req)
  if (!ok) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    const r = await listPropsAdmin()
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { items: r.items })
    return
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody<{ id?: string; defaultShader?: unknown }>(req)
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) {
      json(res, 400, { error: 'id required' })
      return
    }
    const r = await updatePropShader(id, (body.defaultShader as MaterialShaderSpec | null) ?? null)
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { item: r.item })
    return
  }

  json(res, 405, { error: 'Method not allowed' })
}
