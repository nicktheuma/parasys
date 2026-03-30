import type { VercelRequest, VercelResponse } from '@vercel/node'

export function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(body)
}

export async function readJsonBody<T>(req: VercelRequest): Promise<T> {
  const r = req as unknown as { body?: unknown }
  if (r.body !== undefined && r.body !== null && typeof r.body === 'object' && !(r.body instanceof Buffer)) {
    return r.body as T
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw) {
          resolve({} as T)
          return
        }
        resolve(JSON.parse(raw) as T)
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

