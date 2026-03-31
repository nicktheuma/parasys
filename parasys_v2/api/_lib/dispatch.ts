import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json } from './http.js'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>

/**
 * Full pathname starting with `/api`.
 * On Vercel, catch-all `api/[...path].ts` puts segments in `query['...path']`, not in `req.url`.
 * Local Express mounts this at `/api`, so `req.url` may be `/props` (we normalize to `/api/props`).
 */
export function getApiPathname(req: VercelRequest): string {
  const q = req.query as Record<string, string | string[] | undefined>
  const catchAll = q['...path']
  if (catchAll !== undefined) {
    const parts = Array.isArray(catchAll) ? catchAll : [catchAll]
    const joined = parts.map(String).filter(Boolean).join('/')
    return joined ? `/api/${joined}` : '/api'
  }
  const raw = (req as VercelRequest & { originalUrl?: string }).originalUrl ?? req.url ?? '/'
  const pathOnly = String(raw).split('?')[0]
  if (pathOnly.startsWith('/api')) return pathOnly
  return '/api' + (pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`)
}

/** Merge `:id` / `:slug` segments from the path into `req.query` (handlers expect query params). */
function mergePathParamsIntoQuery(req: VercelRequest, pathname: string): void {
  const base: Record<string, unknown> = { ...(req.query as Record<string, unknown>) }
  const rest = pathname.replace(/^\/api\/?/, '')
  const segments = rest.split('/').filter(Boolean)

  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'configurators') {
    base.id = segments[2]
  }
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'materials') {
    base.id = segments[2]
  }
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'users') {
    base.id = segments[2]
  }
  if (segments.length === 3 && segments[0] === 'public' && segments[1] === 'configurator') {
    base.slug = segments[2]
  }

  Object.defineProperty(req, 'query', { value: base, writable: true, configurable: true })
}

async function runRoute(mod: Promise<{ default: Handler }>, req: VercelRequest, res: VercelResponse) {
  const { default: handler } = await mod
  await handler(req, res)
}

export async function dispatchApi(req: VercelRequest, res: VercelResponse): Promise<void> {
  const pathname = getApiPathname(req)
  const method = (req.method ?? 'GET').toUpperCase()
  const rest = pathname.replace(/^\/api\/?/, '')
  const segments = rest.split('/').filter(Boolean)
  const pathKey = segments.join('/')

  mergePathParamsIntoQuery(req, pathname)

  const routes: Array<{ test: () => boolean; mod: () => Promise<{ default: Handler }> }> = [
    { test: () => method === 'POST' && pathKey === 'auth/login', mod: () => import('./routes/authLogin.js') },
    { test: () => method === 'POST' && pathKey === 'auth/logout', mod: () => import('./routes/authLogout.js') },
    { test: () => method === 'GET' && pathKey === 'auth/session', mod: () => import('./routes/authSession.js') },

    { test: () => method === 'GET' && pathKey === 'props', mod: () => import('./routes/propsPublic.js') },

    {
      test: () => method === 'POST' && pathKey === 'admin/props/upload',
      mod: () => import('./routes/adminPropsUpload.js'),
    },
    { test: () => method === 'GET' && pathKey === 'admin/orders', mod: () => import('./routes/adminOrders.js') },
    {
      test: () => (method === 'GET' || method === 'PATCH') && pathKey === 'admin/props',
      mod: () => import('./routes/adminProps.js'),
    },

    {
      test: () => (method === 'GET' || method === 'POST') && pathKey === 'admin/configurators',
      mod: () => import('./routes/adminConfiguratorsIndex.js'),
    },
    {
      test: () =>
        (method === 'PATCH' || method === 'DELETE') &&
        segments.length === 3 &&
        segments[0] === 'admin' &&
        segments[1] === 'configurators',
      mod: () => import('./routes/adminConfiguratorsById.js'),
    },

    {
      test: () => (method === 'GET' || method === 'POST') && pathKey === 'admin/materials',
      mod: () => import('./routes/adminMaterialsIndex.js'),
    },
    {
      test: () =>
        (method === 'PATCH' || method === 'DELETE' || method === 'GET') &&
        segments.length === 3 &&
        segments[0] === 'admin' &&
        segments[1] === 'materials',
      mod: () => import('./routes/adminMaterialsById.js'),
    },

    {
      test: () => (method === 'GET' || method === 'POST') && pathKey === 'admin/users',
      mod: () => import('./routes/adminUsersIndex.js'),
    },
    {
      test: () =>
        (method === 'PATCH' || method === 'DELETE') &&
        segments.length === 3 &&
        segments[0] === 'admin' &&
        segments[1] === 'users',
      mod: () => import('./routes/adminUsersById.js'),
    },

    {
      test: () =>
        method === 'GET' &&
        segments.length === 3 &&
        segments[0] === 'public' &&
        segments[1] === 'configurator',
      mod: () => import('./routes/publicConfiguratorBySlug.js'),
    },
    {
      test: () => method === 'GET' && pathKey === 'public/configurators',
      mod: () => import('./routes/publicConfiguratorsIndex.js'),
    },

    {
      test: () => method === 'POST' && pathKey === 'stripe/create-checkout',
      mod: () => import('./routes/stripeCreateCheckout.js'),
    },
    { test: () => method === 'POST' && pathKey === 'stripe/webhook', mod: () => import('./routes/stripeWebhook.js') },

    {
      test: () => method === 'POST' && pathKey === 'design-package/download',
      mod: () => import('./routes/designPackageDownload.js'),
    },
    {
      test: () => method === 'POST' && pathKey === 'design-package/download-paid',
      mod: () => import('./routes/designPackageDownloadPaid.js'),
    },
    {
      test: () => method === 'GET' && pathKey === 'design-package/download-by-token',
      mod: () => import('./routes/designPackageDownloadByToken.js'),
    },
  ]

  for (const { test, mod } of routes) {
    if (test()) {
      await runRoute(mod(), req, res)
      return
    }
  }

  json(res, 404, { error: 'Not found' })
}
