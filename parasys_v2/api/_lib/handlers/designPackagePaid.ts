import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { getDb } from '../../../db/index'
import type { OrderDimensionsSnapshot } from '../../../db/schema'
import { configurators, orders } from '../../../db/schema'
import { buildDesignAsset, type DesignAssetFormat } from './designPackageDownload'
import { getStripeClient } from './stripeCheckout'

export async function buildPaidDesignAsset(
  format: DesignAssetFormat,
  sessionId: string,
): Promise<
  | { ok: true; buffer: Buffer; filename: string; contentType: string }
  | { ok: false; status: number; error: string }
> {
  const sid = sessionId.trim()
  if (!sid) {
    return { ok: false, status: 400, error: 'session_id required' }
  }
  const stripe = getStripeClient()
  if (!stripe) {
    return { ok: false, status: 503, error: 'Stripe not configured (STRIPE_SECRET_KEY)' }
  }

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sid)
  } catch {
    return { ok: false, status: 400, error: 'Invalid or expired checkout session' }
  }

  if (session.payment_status !== 'paid') {
    return { ok: false, status: 402, error: 'Payment not completed' }
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
    .where(eq(orders.stripeSessionId, sid))
    .limit(1)

  const row = match[0]
  if (!row) {
    return { ok: false, status: 404, error: 'Order not found for this session' }
  }

  if (row.order.status !== 'paid') {
    const email = session.customer_email ?? session.customer_details?.email ?? null
    const downloadToken = row.order.downloadToken ?? randomBytes(32).toString('hex')
    await db
      .update(orders)
      .set({
        status: 'paid',
        customerEmail: email,
        amountCents: session.amount_total,
        downloadToken,
      })
      .where(eq(orders.id, row.order.id))
  }

  const snap = row.order.dimensionsSnapshot as OrderDimensionsSnapshot | null | undefined
  return buildDesignAsset(format, row.slug, snap)
}
