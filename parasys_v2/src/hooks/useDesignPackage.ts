import { useCallback, useState } from 'react'
import { apiUrl, fetchJson } from '@/lib/api'
import { useConfiguratorStore } from '@/stores/configuratorStore'

function triggerBlobDownload(blob: Blob, headers: Headers, fallbackName: string) {
  const cd = headers.get('Content-Disposition')
  const m = cd?.match(/filename="([^"]+)"/)
  const name = m?.[1] ?? fallbackName
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
  URL.revokeObjectURL(href)
}

export function useDesignPackage(slug: string | undefined) {
  const [freeBusy, setFreeBusy] = useState(false)
  const [freeErr, setFreeErr] = useState<string | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null)
  const [paidDownloadBusy, setPaidDownloadBusy] = useState(false)
  const [paidDownloadErr, setPaidDownloadErr] = useState<string | null>(null)

  const driven = useConfiguratorStore((s) => s.driven)

  const downloadFree = useCallback(async () => {
    if (!slug) return
    setFreeErr(null)
    setFreeBusy(true)
    try {
      const res = await fetch(apiUrl('/api/design-package/download'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          widthMm: driven.widthMm,
          depthMm: driven.depthMm,
          heightMm: driven.heightMm,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setFreeErr(j.error ?? res.statusText)
        return
      }
      const blob = await res.blob()
      triggerBlobDownload(blob, res.headers, `parasys-design-${slug}.zip`)
    } finally {
      setFreeBusy(false)
    }
  }, [slug, driven.widthMm, driven.depthMm, driven.heightMm])

  const buyPackage = useCallback(async () => {
    if (!slug) return
    setCheckoutErr(null)
    setCheckoutBusy(true)
    const r = await fetchJson<{ url: string }>('/api/stripe/create-checkout', {
      method: 'POST',
      body: JSON.stringify({
        slug,
        widthMm: driven.widthMm,
        depthMm: driven.depthMm,
        heightMm: driven.heightMm,
      }),
    })
    setCheckoutBusy(false)
    if (!r.ok || !r.data?.url) {
      setCheckoutErr(r.error ?? 'Checkout unavailable')
      return
    }
    window.location.href = r.data.url
  }, [slug, driven.widthMm, driven.depthMm, driven.heightMm])

  const downloadPaid = useCallback(
    async (sessionId: string) => {
      setPaidDownloadErr(null)
      setPaidDownloadBusy(true)
      try {
        const res = await fetch(apiUrl('/api/design-package/download-paid'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          setPaidDownloadErr(j.error ?? res.statusText)
          return
        }
        const blob = await res.blob()
        triggerBlobDownload(blob, res.headers, `parasys-design-${slug ?? 'order'}.zip`)
      } finally {
        setPaidDownloadBusy(false)
      }
    },
    [slug],
  )

  return {
    freeBusy,
    freeErr,
    checkoutBusy,
    checkoutErr,
    paidDownloadBusy,
    paidDownloadErr,
    downloadFree,
    buyPackage,
    downloadPaid,
  }
}
