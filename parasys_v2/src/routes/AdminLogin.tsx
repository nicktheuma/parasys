import { type FormEvent, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { fetchJson } from '@/lib/api'
import styles from './adminLogin.module.css'

type LoginRes = { ok: boolean }

export function AdminLogin() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [authed, setAuthed] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const body: Record<string, string> = { password }
    if (email.trim()) body.email = email.trim()
    const r = await fetchJson<LoginRes>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!r.ok) {
      setError(r.error ?? 'Sign-in failed')
      return
    }
    if (r.data?.ok) setAuthed(true)
  }

  if (authed) {
    return <Navigate to={from} replace />
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Admin</h1>
        <p className={styles.hint}>Operator access only. Not shown on client domains.</p>
        <form onSubmit={onSubmit} className={styles.form}>
          <label className={styles.label}>
            Email (optional for legacy login)
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="admin@parasys.local"
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="submit" className={styles.button} disabled={busy}>
            {busy ? 'Signing in\u2026' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
