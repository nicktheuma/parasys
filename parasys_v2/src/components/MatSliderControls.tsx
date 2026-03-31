import styles from './matSliderControls.module.css'

export function clampMat(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function MatSliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  className,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  /** Override label row layout (e.g. Materials library modal) */
  className?: string
}) {
  return (
    <label className={className ?? styles.row}>
      <span>{label}</span>
      <input
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        className={styles.numInput}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') return
          const n = Number(raw)
          if (!Number.isFinite(n)) return
          onChange(clampMat(n, min, max))
        }}
      />
    </label>
  )
}

export function MatSliderRowScaleOptional({
  label,
  min,
  max,
  step,
  value,
  onChange,
  emptyLabel,
  className,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number | undefined
  onChange: (v: number | undefined) => void
  emptyLabel: string
  className?: string
}) {
  const sliderVal = value ?? 0
  return (
    <label className={className ?? styles.row}>
      <span>{label}</span>
      <input
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={sliderVal}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(v > 0 ? v : undefined)
        }}
      />
      <input
        type="number"
        className={styles.numInput}
        min={min}
        max={max}
        step={step}
        value={value === undefined ? '' : value}
        placeholder={emptyLabel}
        title={emptyLabel}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(undefined)
            return
          }
          const n = Number(raw)
          if (!Number.isFinite(n)) return
          onChange(n <= 0 ? undefined : clampMat(n, min, max))
        }}
      />
    </label>
  )
}
