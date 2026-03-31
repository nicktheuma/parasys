import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '@/lib/api'
import { ConfiguratorThumbnail } from '@/components/ConfiguratorThumbnail'
import styles from './home.module.css'

type PublicConfiguratorItem = {
  slug: string
  name: string
  templateKey: string
  clientLabel: string | null
}

export function Home() {
  const [items, setItems] = useState<PublicConfiguratorItem[]>([])
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await fetchJson<{ items: PublicConfiguratorItem[] }>('/api/public/configurators', { method: 'GET' })
      if (!cancelled && r.ok) setItems(r.data?.items ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (showAdmin) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') setShowAdmin(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showAdmin])

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Parasys Platform</p>
        <h1 className={styles.title}>High-end furniture configurators built for modern manufacturing teams</h1>
        <p className={styles.lead}>
          Deliver photorealistic product experiences with deep parametric control and a production-ready pipeline.
          Configure faster, present better, and move from concept to fabrication in minutes.
        </p>
        <div className={styles.metrics}>
          <div>
            <strong>Photorealistic</strong>
            <span>Realtime physically-based rendering</span>
          </div>
          <div>
            <strong>Parametric</strong>
            <span>Template-driven flexibility per client line</span>
          </div>
          <div>
            <strong>Manufacture-ready</strong>
            <span>Instant downloadable fabrication files (DXF pipeline enabled)</span>
          </div>
        </div>
      </section>

      <section className={styles.catalog}>
        <h2 className={styles.catalogTitle}>Public configurators</h2>
        <p className={styles.catalogLead}>Select a product line to launch the interactive configurator.</p>
        <ul className={styles.tiles}>
          {items.map((it) => (
            <li key={it.slug} className={styles.tile}>
              <Link to={`/c/${encodeURIComponent(it.slug)}`} className={styles.tileLink}>
                <div className={styles.thumbWrap}>
                  <ConfiguratorThumbnail templateKey={it.templateKey} settings={null} />
                </div>
                <div className={styles.tileBody}>
                  <h3>{it.name}</h3>
                  <p>{it.clientLabel ?? it.templateKey.replace(/_/g, ' ')}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {showAdmin ? (
        <div className={styles.adminReveal}>
          <Link to="/admin/login">Admin sign-in</Link>
        </div>
      ) : null}
    </div>
  )
}
