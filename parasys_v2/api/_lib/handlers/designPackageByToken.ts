import { eq } from 'drizzle-orm'
import { getDb } from '../../../db/index'
import type { OrderDimensionsSnapshot } from '../../../db/schema'
import { configurators, orders } from '../../../db/schema'
import { buildDesignPackageZip } from './designPackageDownload'

export async function buildDesignPackageByDownloadToken(
  token: string,
): Promise<{ ok: true; buffer: Buffer; filename: string } | { ok: false; status: number; error: string }> {
  const t = token.trim()
  if (!t) {
    return { ok: false, status: 400, error: 'token required' }
  }
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }

  const match = await db
    .select({
      order: orders,
      slug: configurators.slug,
    })
    .from(orders)
    .innerJoin(configurators, eq(orders.configuratorId, configurators.id))
    .where(eq(orders.downloadToken, t))
    .limit(1)

  const row = match[0]
  if (!row) {
    return { ok: false, status: 404, error: 'Invalid or expired link' }
  }
  if (row.order.status !== 'paid') {
    return { ok: false, status: 403, error: 'Order not paid' }
  }

  const snap = row.order.dimensionsSnapshot as OrderDimensionsSnapshot | null | undefined
  return buildDesignPackageZip(row.slug, snap)
}
