import type { VercelRequest, VercelResponse } from '@vercel/node'
import { dispatchApi } from './_lib/dispatch.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await dispatchApi(req, res)
}
