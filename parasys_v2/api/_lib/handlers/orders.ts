import { desc, eq } from 'drizzle-orm'
import { getDb } from '../../../db/index.js'
import { configurators, orders } from '../../../db/schema.js'

export type OrderListRow = {
  id: string
  status: string
  customerEmail: string | null
  amountCents: number | null
  currency: string
  stripeSessionId: string | null
  createdAt: string
  configurator: {
    id: string
    name: string
    slug: string
  }
}

export async function listOrders(): Promise<
  { ok: true; items: OrderListRow[] } | { ok: false; status: number; error: string }
> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      customerEmail: orders.customerEmail,
      amountCents: orders.amountCents,
      currency: orders.currency,
      stripeSessionId: orders.stripeSessionId,
      createdAt: orders.createdAt,
      configuratorId: configurators.id,
      configuratorName: configurators.name,
      configuratorSlug: configurators.slug,
    })
    .from(orders)
    .innerJoin(configurators, eq(orders.configuratorId, configurators.id))
    .orderBy(desc(orders.createdAt))

  const items: OrderListRow[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    customerEmail: r.customerEmail ?? null,
    amountCents: r.amountCents,
    currency: r.currency,
    stripeSessionId: r.stripeSessionId ?? null,
    createdAt: r.createdAt.toISOString(),
    configurator: {
      id: r.configuratorId,
      name: r.configuratorName,
      slug: r.configuratorSlug,
    },
  }))

  return { ok: true, items }
}
