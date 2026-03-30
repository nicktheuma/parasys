import { type FormEvent, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchJson } from '@/lib/api'
import { DIM_MM } from '@/lib/configuratorDimensions'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { getTemplateParametricPreset } from '@/features/parametric/mvp1/templateParametricPresets'
import type { TemplateParametricPreset, TemplateParamLimits, ParamRange } from '@shared/types'
import styles from './adminSettingsPanel.module.css'

type NumericParamKey = Exclude<keyof TemplateParametricPreset, 'interlockEnabled'>

const PARAM_DEFS: { key: NumericParamKey; label: string; step: number; fallbackMin: number; fallbackMax: number }[] = [
  { key: 'dividers', label: 'Dividers', step: 1, fallbackMin: 0, fallbackMax: 12 },
  { key: 'shelves', label: 'Shelves', step: 1, fallbackMin: 0, fallbackMax: 12 },
  { key: 'edgeOffset', label: 'Edge offset', step: 0.001, fallbackMin: 0, fallbackMax: 0.1 },
  { key: 'slotOffsetFactor', label: 'Slot offset', step: 0.05, fallbackMin: 0, fallbackMax: 2 },
  { key: 'interlockClearanceFactor', label: 'Interlock clearance', step: 0.01, fallbackMin: 0, fallbackMax: 1 },
  { key: 'interlockLengthFactor', label: 'Interlock length', step: 0.05, fallbackMin: 1, fallbackMax: 5 },
]

function limitKey(k: NumericParamKey): keyof TemplateParamLimits {
  return k as keyof TemplateParamLimits
}

export function AdminSettingsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const {
    configuratorId,
    templateKey,
    widthMm,
    depthMm,
    heightMm,
    templateParamOverrides,
    paramLimits,
    setDim,
    setTemplateParam,
  } = useConfiguratorStore()

  const defaults = getTemplateParametricPreset(templateKey)
  const overrides = templateParamOverrides?.[templateKey] ?? {}
  const merged: TemplateParametricPreset = { ...defaults, ...overrides }
  const limits: TemplateParamLimits = paramLimits?.[templateKey] ?? {}

  const [localLimits, setLocalLimits] = useState<TemplateParamLimits>(limits)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [showLimits, setShowLimits] = useState(false)

  const setParam = useCallback(
    (key: NumericParamKey, value: number | undefined) => {
      setTemplateParam(templateKey, { [key]: value })
    },
    [templateKey, setTemplateParam],
  )

  const setInterlock = useCallback(
    (enabled: boolean) => {
      setTemplateParam(templateKey, { interlockEnabled: enabled })
    },
    [templateKey, setTemplateParam],
  )

  function setLimit(paramKey: NumericParamKey, side: 'min' | 'max', raw: string) {
    const lk = limitKey(paramKey)
    const prev = localLimits[lk] ?? {}
    const num = raw.trim() === '' ? undefined : Number(raw)
    const next: ParamRange = { ...prev, [side]: Number.isFinite(num) ? num : undefined }
    setLocalLimits({ ...localLimits, [lk]: next })
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!configuratorId) return
    setSaving(true)
    setSaveMsg(null)

    const r = await fetchJson(
      `/api/admin/configurators/${encodeURIComponent(configuratorId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          settings: {
            defaultDims: { widthMm, depthMm, heightMm },
            templateParams: { [templateKey]: merged },
            paramLimits: { [templateKey]: localLimits },
          },
        }),
      },
    )
    setSaving(false)
    setSaveMsg(r.ok ? 'Saved' : (r.error ?? 'Save failed'))
    if (r.ok) setTimeout(() => setSaveMsg(null), 2500)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Admin Settings</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>

      <form className={styles.form} onSubmit={onSave}>
        <p className={styles.sectionTitle}>Dimensions (mm)</p>

        {(['width', 'depth', 'height'] as const).map((axis) => {
          const mm = axis === 'width' ? widthMm : axis === 'depth' ? depthMm : heightMm
          return (
            <label key={axis} className={styles.dimRow}>
              <span className={styles.dimLabel}>{axis.charAt(0).toUpperCase() + axis.slice(1)}</span>
              <input
                type="range"
                className={styles.range}
                min={DIM_MM[axis].min}
                max={DIM_MM[axis].max}
                step={1}
                value={mm}
                onChange={(e) => setDim(axis, Number(e.target.value))}
              />
              <input
                type="number"
                className={styles.numInput}
                min={DIM_MM[axis].min}
                max={DIM_MM[axis].max}
                step={1}
                value={mm}
                onChange={(e) => setDim(axis, Number(e.target.value))}
              />
            </label>
          )
        })}

        <div className={styles.sectionRow}>
          <p className={styles.sectionTitle}>Template Parameters</p>
          <button
            type="button"
            className={styles.toggleLimits}
            onClick={() => setShowLimits((v) => !v)}
          >
            {showLimits ? 'Hide limits' : 'Edit limits'}
          </button>
        </div>

        {PARAM_DEFS.map((def) => {
          const range = localLimits[limitKey(def.key)]
          const lo = range?.min ?? def.fallbackMin
          const hi = range?.max ?? def.fallbackMax
          const val = merged[def.key] ?? lo
          return (
            <div key={def.key} className={styles.paramBlock}>
              <label className={styles.dimRow}>
                <span className={styles.dimLabel}>{def.label}</span>
                <input
                  type="range"
                  className={styles.range}
                  min={lo}
                  max={hi}
                  step={def.step}
                  value={val}
                  onChange={(e) => setParam(def.key, Number(e.target.value))}
                />
                <input
                  type="number"
                  className={styles.numInput}
                  min={lo}
                  max={hi}
                  step={def.step}
                  value={val}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    setParam(def.key, v === '' ? undefined : Number(v))
                  }}
                />
              </label>
              {showLimits ? (
                <div className={styles.limitsRow}>
                  <label className={styles.limitLabel}>
                    Min
                    <input
                      type="number"
                      className={styles.limitInput}
                      step={def.step}
                      value={range?.min ?? ''}
                      placeholder={String(def.fallbackMin)}
                      onChange={(e) => setLimit(def.key, 'min', e.target.value)}
                    />
                  </label>
                  <label className={styles.limitLabel}>
                    Max
                    <input
                      type="number"
                      className={styles.limitInput}
                      step={def.step}
                      value={range?.max ?? ''}
                      placeholder={String(def.fallbackMax)}
                      onChange={(e) => setLimit(def.key, 'max', e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          )
        })}

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={merged.interlockEnabled ?? true}
            onChange={(e) => setInterlock(e.target.checked)}
          />
          <span>Interlock enabled</span>
        </label>

        <div className={styles.actions}>
          <button type="submit" className={styles.saveBtn} disabled={saving || !configuratorId}>
            {saving ? 'Saving\u2026' : 'Save as defaults'}
          </button>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/admin')}
          >
            Back to dashboard
          </button>
        </div>

        {saveMsg ? (
          <p className={`${styles.msg} ${saveMsg === 'Saved' ? styles.msgOk : styles.msgErr}`}>
            {saveMsg}
          </p>
        ) : null}
      </form>

      <p className={styles.hint}>
        All changes update the 3D preview live. Click &ldquo;Save as defaults&rdquo; to persist.
        Press <kbd>P</kbd> to toggle this panel.
      </p>
    </div>
  )
}
