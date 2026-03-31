import type { Express, Request, Response } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

type VercelHandler = (req: unknown, res: unknown) => Promise<void>

function adaptHandler(handler: VercelHandler) {
  return async (req: Request, res: Response) => {
    if (req.params && Object.keys(req.params).length > 0) {
      const merged = { ...req.query, ...req.params }
      Object.defineProperty(req, 'query', {
        value: merged,
        writable: true,
        configurable: true,
      })
    }
    await handler(req, res)
  }
}

/**
 * Mounts the single catch-all `api/[...path].ts` handler at `/api` (see `api/_lib/dispatch.ts`).
 * Matches Vercel’s one-function deployment for Hobby tier.
 */
export async function registerVercelRoutes(
  app: Express,
  apiRoot: string,
): Promise<void> {
  const catchAll = path.join(apiRoot, '[...path].ts')
  if (!fs.existsSync(catchAll)) {
    console.warn('[parasys] Missing api/[...path].ts — API routes not mounted')
    return
  }
  const mod = (await import(pathToFileURL(catchAll).href)) as { default?: VercelHandler }
  if (typeof mod.default !== 'function') return
  app.use('/api', adaptHandler(mod.default))
}
