import { type ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { fetchJson } from '@/lib/api'

type SessionRes = { ok: boolean; role?: string; userId?: string | null }

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await fetchJson<SessionRes>('/api/auth/session', { method: 'GET' })
      if (cancelled) return
      if (r.ok && r.data?.ok) setState('in')
      else setState('out')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)' }} aria-busy="true">
        Checking session…
      </div>
    )
  }

  if (state === 'out') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}
