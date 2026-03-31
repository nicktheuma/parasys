import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fetchJson } from '@/lib/api'
import type {
  ConfiguratorLightingSettings,
  DimLimits,
  ParamGraphSettings,
  PublicMat,
  SurfaceUvMapping,
  TemplateParametricPreset,
  TemplateParamLimits,
} from '@shared/types'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { useDesignPackage } from '@/hooks/useDesignPackage'
import { ConfiguratorCanvas } from '@/components/ConfiguratorCanvas'
import { AdminSettingsPanel } from '@/components/AdminSettingsPanel'
import { PublicControlsMvp } from './PublicControlsMvp'
import styles from './configuratorPublic.module.css'

export function ConfiguratorPublic() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const checkout = searchParams.get('checkout')
  const stripeSessionId = searchParams.get('session_id')

  const allowFreeDownload = import.meta.env.VITE_ALLOW_FREE_DESIGN_PACKAGE === 'true'

  const { productName, materials, materialId, showDimensions, loadErr } =
    useConfiguratorStore()
  const { loadConfigurator, setLoadErr, setMaterialId, toggleDimensions } =
    useConfiguratorStore()

  const [showAdminPanel, setShowAdminPanel] = useState(false)

  const pkg = useDesignPackage(slug)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'p' || e.key === 'P') {
        setShowAdminPanel((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoadErr(null)
    void (async () => {
      const r = await fetchJson<{
        item: {
          id: string
          name: string
          templateKey: string
          settings: {
            defaultDims?: { widthMm?: number; depthMm?: number; heightMm?: number }
            defaultMaterialId?: string | null
            dimLimits?: DimLimits | null
            paramGraph?: ParamGraphSettings | null
            templateParams?: Record<string, TemplateParametricPreset> | null
            paramLimits?: Record<string, TemplateParamLimits> | null
            uvMappings?: Record<string, SurfaceUvMapping> | null
            lighting?: ConfiguratorLightingSettings | null
          } | null
          materials: PublicMat[]
        }
      }>(`/api/public/configurator/${encodeURIComponent(slug)}`, { method: 'GET' })
      if (cancelled) return
      if (!r.ok || !r.data?.item) {
        setLoadErr(r.error ?? 'Configurator not found')
        return
      }
      loadConfigurator(r.data.item)
    })()
    return () => {
      cancelled = true
    }
  }, [slug, loadConfigurator, setLoadErr])

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.title}>{productName ?? 'Configurator'}</div>
        <div className={styles.actions}>
          <code className={styles.slug}>{slug}</code>
        </div>
      </header>

      {loadErr ? (
        <p className={styles.bannerErr} role="alert">
          {loadErr}
        </p>
      ) : null}

      {checkout === 'success' && stripeSessionId ? (
        <div className={styles.banner} role="status">
          <p className={styles.bannerLead}>
            Payment received. Download your drawings (PDF) or 3D model (STL).
          </p>
          <div className={styles.downloadPaidRow}>
            <button
              type="button"
              className={styles.downloadPaid}
              onClick={() => void pkg.downloadPaid(stripeSessionId, 'pdf')}
              disabled={pkg.paidBusyPdf || pkg.paidBusyStl}
            >
              {pkg.paidBusyPdf ? 'Preparing\u2026' : 'Download PDF'}
            </button>
            <button
              type="button"
              className={styles.downloadPaid}
              onClick={() => void pkg.downloadPaid(stripeSessionId, 'stl')}
              disabled={pkg.paidBusyPdf || pkg.paidBusyStl}
            >
              {pkg.paidBusyStl ? 'Preparing\u2026' : 'Download STL'}
            </button>
          </div>
        </div>
      ) : null}
      {checkout === 'success' && !stripeSessionId ? (
        <p className={styles.banner} role="status">
          Payment received. If you do not see a download link, open the confirmation link from
          Stripe or contact support.
        </p>
      ) : null}
      {checkout === 'cancel' ? (
        <p className={styles.bannerMuted} role="status">
          Checkout cancelled.
        </p>
      ) : null}
      {pkg.checkoutErr ? (
        <p className={styles.bannerErr} role="alert">
          {pkg.checkoutErr}
        </p>
      ) : null}
      {pkg.paidDownloadErr ? (
        <p className={styles.bannerErr} role="alert">
          {pkg.paidDownloadErr}
        </p>
      ) : null}
      {pkg.freeErr ? (
        <p className={styles.bannerErr} role="alert">
          {pkg.freeErr}
        </p>
      ) : null}

      <ConfiguratorCanvas adminMode={showAdminPanel} />

      {!showAdminPanel ? (
        <PublicControlsMvp
          materials={materials}
          materialId={materialId}
          onMaterialChange={setMaterialId}
          showDimensions={showDimensions}
          onToggleDimensions={toggleDimensions}
          allowFreeDownload={allowFreeDownload}
          freeBusyPdf={pkg.freeBusyPdf}
          freeBusyStl={pkg.freeBusyStl}
          checkoutBusy={pkg.checkoutBusy}
          onDownloadPdf={() => void pkg.downloadFree('pdf')}
          onDownloadStl={() => void pkg.downloadFree('stl')}
          onBuy={() => void pkg.buyPackage()}
        />
      ) : null}

      {showAdminPanel ? (
        <aside className={styles.adminOverlay}>
          <AdminSettingsPanel onClose={() => setShowAdminPanel(false)} />
        </aside>
      ) : null}
    </div>
  )
}
