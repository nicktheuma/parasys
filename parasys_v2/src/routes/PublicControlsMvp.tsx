import { useMemo, useState } from 'react'
import type { PublicMat } from '@shared/types'
import { DownloadIcon, EyeIcon, EyeOffIcon } from '@/components/icons'
import styles from './publicControlsMvp.module.css'

type Props = {
  materials: PublicMat[]
  materialId: string | null
  onMaterialChange: (id: string | null) => void
  showDimensions: boolean
  onToggleDimensions: () => void
  allowFreeDownload: boolean
  freeBusyPdf: boolean
  freeBusyStl: boolean
  checkoutBusy: boolean
  onDownloadPdf: () => void
  onDownloadStl: () => void
  onBuy: () => void
  /** Panel-based manufacturing estimate (EUR); omitted when unavailable */
  productionPriceFormatted?: string | null
}

export function PublicControlsMvp(props: Props) {
  const [openPanel, setOpenPanel] = useState<'material' | 'download' | null>(null)
  const activeMaterial = useMemo(
    () =>
      props.materialId ? props.materials.find((m) => m.id === props.materialId) ?? null : null,
    [props.materialId, props.materials],
  )
  const hasMaterials = props.materials.length > 0

  return (
    <div className={styles.publicControls} role="region" aria-label="Viewer controls">
      {openPanel === 'material' && hasMaterials ? (
        <div className={`${styles.nestedPanel} ${styles.materialCarousel}`} role="listbox" aria-label="Material options">
          {props.materials.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                props.onMaterialChange(option.id)
                setOpenPanel(null)
              }}
              className={`${styles.materialChip} ${props.materialId === option.id ? styles.isActive : ''}`}
              aria-selected={props.materialId === option.id}
            >
              <span className={styles.materialThumb} aria-hidden="true" style={{ backgroundColor: option.colorHex }} />
              <span className={styles.materialLabel}>{option.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {openPanel === 'download' ? (
        <div className={`${styles.nestedPanel} ${styles.optionGrid}`} role="group" aria-label="Download options">
          {props.allowFreeDownload ? (
            <>
              <button
                type="button"
                className={styles.publicButton}
                onClick={props.onDownloadPdf}
                disabled={props.freeBusyPdf || props.freeBusyStl}
              >
                {props.freeBusyPdf ? 'Preparing…' : 'PDF'}
              </button>
              <button
                type="button"
                className={styles.publicButton}
                onClick={props.onDownloadStl}
                disabled={props.freeBusyPdf || props.freeBusyStl}
              >
                {props.freeBusyStl ? 'Preparing…' : 'STL'}
              </button>
            </>
          ) : null}
          <button type="button" className={styles.publicButton} onClick={props.onBuy} disabled={props.checkoutBusy}>
            {props.checkoutBusy ? 'Redirecting...' : 'Buy'}
          </button>
        </div>
      ) : null}

      {props.productionPriceFormatted ? (
        <div
          className={styles.productionEstimate}
          title="Indicative production cost from sheet count, cut length, and assembly complexity (not a quote)."
        >
          <span className={styles.productionEstimateLabel}>Est. production</span>
          <span className={styles.productionEstimateValue}>{props.productionPriceFormatted}</span>
        </div>
      ) : null}

      <div className={styles.primaryActions} role="group" aria-label="Primary controls">
        <button
          type="button"
          className={`${styles.actionBubble} ${styles.actionBubbleIcon}`}
          aria-expanded={openPanel === 'download'}
          aria-label="Download options"
          onClick={() => setOpenPanel((v) => (v === 'download' ? null : 'download'))}
        >
          <DownloadIcon size={22} />
        </button>
        <button
          type="button"
          className={styles.actionBubble}
          disabled={!hasMaterials}
          aria-expanded={openPanel === 'material'}
          aria-label={
            hasMaterials
              ? `Material picker, current: ${activeMaterial?.name ?? 'Choose'}`
              : 'No materials configured'
          }
          title={!hasMaterials ? 'Add materials in admin' : undefined}
          onClick={() => {
            if (!hasMaterials) return
            setOpenPanel((v) => (v === 'material' ? null : 'material'))
          }}
        >
          <span
            className={styles.materialThumb}
            aria-hidden="true"
            style={{ backgroundColor: activeMaterial?.colorHex ?? '#8a8a8a' }}
          />
        </button>
        <button
          type="button"
          className={`${styles.actionBubble} ${styles.actionBubbleIcon}`}
          aria-pressed={props.showDimensions}
          aria-label={props.showDimensions ? 'Hide dimensions' : 'Show dimensions'}
          onClick={() => {
            props.onToggleDimensions()
            setOpenPanel(null)
          }}
        >
          {props.showDimensions ? <EyeIcon size={22} /> : <EyeOffIcon size={22} />}
        </button>
      </div>
    </div>
  )
}
