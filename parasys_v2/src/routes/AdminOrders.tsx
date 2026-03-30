import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '@/lib/api'
import styles from './adminOrders.module.css'

type OrderRow = {
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

function formatAmount(cents: number | null, currency: string): string {
  if (cents == null) return '—'
  const code = currency.toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code.length === 3 ? code : 'USD',
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function AdminOrders() {
  const [items, setItems] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const r = await fetchJson<{ items: OrderRow[] }>('/api/admin/orders', { method: 'GET' })
      if (cancelled) return
      setLoading(false)
      if (!r.ok) {
        setError(r.error ?? 'Failed to load orders')
        return
      }
      setItems(r.data?.items ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1 className={styles.heading}>Orders</h1>
      <p className={styles.sub}>
        Design-package checkouts recorded from Stripe. Use this to confirm payments and match customer email to a
        configurator.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.panel}>
        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : items.length === 0 ? (
          <p className={styles.muted}>No orders yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Configurator</th>
                <th>Status</th>
                <th>Email</th>
                <th>Amount</th>
                <th>Stripe session</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>
                    <Link className={styles.link} to={`/c/${encodeURIComponent(o.configurator.slug)}`}>
                      {o.configurator.name}
                    </Link>
                  </td>
                  <td>{o.status}</td>
                  <td>{o.customerEmail ?? '—'}</td>
                  <td>{formatAmount(o.amountCents, o.currency)}</td>
                  <td className={styles.mono}>{o.stripeSessionId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
