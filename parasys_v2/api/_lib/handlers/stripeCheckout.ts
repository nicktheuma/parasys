import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { sendPurchaseReceiptEmail } from '../email'
import { getDb } from '../../../db/index'
import { configurators, orders } from '../../../db/schema'
import type { OrderDimensionsSnapshot } from '../../../db/schema'
import { getConfiguratorBySlug } from './configurators'

export function getStripeClient(): Stripe | null {
  const k = process.env.STRIPE_SECRET_KEY
  if (!k) return null
  return new Stripe(k, { apiVersion: '2024-11-20.acacia' })
}

export async function createDesignCheckout(
  slug: string,
  dimensionsSnapshot?: OrderDimensionsSnapshot | null,
): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  const s = slug.trim()
  if (!s) {
    return { ok: false, status: 400, error: 'slug required' }
  }
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const stripe = getStripeClient()
  if (!stripe) {
    return { ok: false, status: 503, error: 'Stripe not configured (STRIPE_SECRET_KEY)' }
  }
  const priceId = process.env.STRIPE_PRICE_ID
  const publicUrl = process.env.PUBLIC_APP_URL
  if (!priceId || !publicUrl) {
    return { ok: false, status: 503, error: 'Checkout not configured (STRIPE_PRICE_ID / PUBLIC_APP_URL)' }
  }

  const c = await getConfiguratorBySlug(s)
  if (!c.ok) {
    return { ok: false, status: c.status, error: c.error }
  }

  const [order] = await db
    .insert(orders)
    .values({
      configuratorId: c.item.id,
      status: 'pending',
      dimensionsSnapshot: dimensionsSnapshot ?? null,
    })
    .returning()
  if (!order) {
    return { ok: false, status: 500, error: 'Order create failed' }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${publicUrl.replace(/\/$/, '')}/c/${encodeURIComponent(c.item.slug)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicUrl.replace(/\/$/, '')}/c/${encodeURIComponent(c.item.slug)}?checkout=cancel`,
      metadata: { orderId: order.id, configuratorId: c.item.id },
    })
    if (!session.url) {
      return { ok: false, status: 500, error: 'Stripe session missing URL' }
    }
    await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, order.id))
    return { ok: true, url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stripe error'
    return { ok: false, status: 502, error: msg }
  }
}

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const stripe = getStripeClient()
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !whSecret) {
    return { ok: false, status: 503, error: 'Webhook not configured' }
  }
  if (!signature) {
    return { ok: false, status: 400, error: 'Missing signature' }
  }
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, whSecret)
  } catch {
    return { ok: false, status: 400, error: 'Invalid signature' }
  }

  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured' }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId
    if (!orderId) {
      return { ok: true }
    }
    const existing = await db
      .select({
        order: orders,
        productName: configurators.name,
      })
      .from(orders)
      .innerJoin(configurators, eq(orders.configuratorId, configurators.id))
      .where(eq(orders.id, orderId))
      .limit(1)
    const row = existing[0]
    if (!row || row.order.status === 'paid') {
      return { ok: true }
    }
    const emailAddr = session.customer_email ?? session.customer_details?.email ?? null
    const downloadToken = randomBytes(32).toString('hex')
    const publicUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, '')

    await db
      .update(orders)
      .set({
        status: 'paid',
        customerEmail: emailAddr,
        amountCents: session.amount_total,
        downloadToken,
      })
      .where(eq(orders.id, orderId))

    if (emailAddr && publicUrl && process.env.RESEND_API_KEY) {
      const base = `${publicUrl}/api/design-package/download-by-token?token=${encodeURIComponent(downloadToken)}`
      const downloadUrlPdf = `${base}&format=pdf`
      const downloadUrlStl = `${base}&format=stl`
      const sent = await sendPurchaseReceiptEmail({
        to: emailAddr,
        downloadUrlPdf,
        downloadUrlStl,
        productName: row.productName,
      })
      if (sent.ok) {
        await db
          .update(orders)
          .set({ purchaseEmailSentAt: new Date() })
          .where(eq(orders.id, orderId))
      } else {
        console.warn('[parasys] purchase email failed:', sent.error)
      }
    } else if (emailAddr && publicUrl && !process.env.RESEND_API_KEY) {
      console.warn('[parasys] RESEND_API_KEY not set; skipping purchase receipt email')
    } else if (emailAddr && process.env.RESEND_API_KEY && !publicUrl) {
      console.warn('[parasys] PUBLIC_APP_URL not set; cannot include download link in email')
    }
  }

  return { ok: true }
}
