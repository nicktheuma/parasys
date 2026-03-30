import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAdminRequest } from '../../_lib/auth'
import { createConfigurator, listConfigurators } from '../../_lib/handlers/configurators'
import { json, readJsonBody } from '../../_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const ok = await isAdminRequest(req)
    if (!ok) {
      json(res, 401, { error: 'Unauthorized' })
      return
    }
    const r = await listConfigurators()
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
      name?: string
      slug?: string
      templateKey?: string
      clientLabel?: string
      settings?: { defaultDims?: { widthMm?: number; depthMm?: number; heightMm?: number } } | null
    }>(req)
    const r = await createConfigurator({
      name: body.name ?? '',
      slug: body.slug ?? '',
      templateKey: body.templateKey ?? '',
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

  json(res, 405, { error: 'Method not allowed' })
}
