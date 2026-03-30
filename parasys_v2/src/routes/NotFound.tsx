import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ marginTop: 0 }}>Not found</h1>
      <p style={{ color: 'var(--muted)' }}>
        <Link to="/">Back home</Link>
      </p>
    </div>
  )
}
