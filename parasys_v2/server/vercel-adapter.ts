import type { Express, Request, Response } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

type VercelHandler = (req: unknown, res: unknown) => Promise<void>

function scanRouteFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...scanRouteFiles(full))
    } else if (entry.name.endsWith('.ts')) {
      files.push(full)
    }
  }
  return files
}

function fileToRoute(apiRoot: string, filePath: string): string {
  const rel = path
    .relative(apiRoot, filePath)
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '')
    .replace(/\/index$/, '')
  return '/api/' + rel.replace(/\[([^\]]+)\]/g, ':$1')
}

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
 * Scans `api/` for Vercel-style route files and mounts them on the Express app.
 * File paths map to routes: `api/admin/configurators/[id].ts` -> `/api/admin/configurators/:id`.
 * Skips directories starting with `_` (e.g. `_lib/`).
 * Express route params are merged into `req.query` for Vercel handler compat.
 *
 * No body-parser middleware is applied — each Vercel handler parses its own body
 * via `readJsonBody` / `getRawBody`, which keeps the Stripe webhook working.
 */
export async function registerVercelRoutes(
  app: Express,
  apiRoot: string,
): Promise<void> {
  const files = scanRouteFiles(apiRoot)

  for (const file of files) {
    const route = fileToRoute(apiRoot, file)
    const mod = (await import(pathToFileURL(file).href)) as { default?: VercelHandler }
    if (typeof mod.default !== 'function') continue
    app.all(route, adaptHandler(mod.default))
  }

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' })
  })
}
