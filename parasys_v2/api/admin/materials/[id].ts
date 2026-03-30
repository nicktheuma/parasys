import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAdminRequest } from '../../_lib/auth'
import {
  assignMaterial,
  deleteMaterial,
  getAssignedConfiguratorIds,
  unassignMaterial,
  updateMaterial,
} from '../../_lib/handlers/materials'
import { json, readJsonBody } from '../../_lib/http'

function routeId(req: VercelRequest): string | null {
  const id = req.query?.id
  if (typeof id === 'string' && id) return id
  if (Array.isArray(id) && typeof id[0] === 'string') return id[0]
  return null
}

function queryConfiguratorId(req: VercelRequest): string | null {
  const q = req.query?.configuratorId
  if (typeof q === 'string' && q) return q
  if (Array.isArray(q) && typeof q[0] === 'string') return q[0]
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ok = await isAdminRequest(req)
  if (!ok) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }
  const id = routeId(req)
  const configuratorId = queryConfiguratorId(req)
  if (!id || !configuratorId) {
    json(res, 400, { error: 'Missing id or configuratorId' })
    return
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody<{
      folder?: string
      name?: string
      colorHex?: string
      shader?: unknown | null
      enabled?: boolean
      assignTo?: string[]
      unassignFrom?: string[]
    }>(req)
    const r = await updateMaterial(id, configuratorId, body)
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    if (body.assignTo) {
      for (const cid of body.assignTo) {
        await assignMaterial(id, cid)
      }
    }
    if (body.unassignFrom) {
      for (const cid of body.unassignFrom) {
        await unassignMaterial(id, cid)
      }
    }
    const assignedTo = await getAssignedConfiguratorIds(id)
    json(res, 200, { item: r.item, assignedTo })
    return
  }

  if (req.method === 'GET') {
    const assignedTo = await getAssignedConfiguratorIds(id)
    json(res, 200, { assignedTo })
    return
  }

  if (req.method === 'DELETE') {
    const r = await deleteMaterial(id, configuratorId)
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    json(res, 200, { ok: true })
    return
  }

  json(res, 405, { error: 'Method not allowed' })
}
