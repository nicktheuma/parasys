import { DIM_MM } from '@/lib/configuratorDimensions'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import styles from '@/routes/configuratorPublic.module.css'

export function DimensionsPanel({ alwaysVisible }: { alwaysVisible?: boolean } = {}) {
  const { widthMm, depthMm, heightMm, paramGraph, driven, showDimensions, setDim } =
    useConfiguratorStore()

  return (
    <aside
      className={alwaysVisible ? undefined : styles.dimPanel}
      aria-label="Dimensions"
      hidden={alwaysVisible ? false : !showDimensions}
    >
      <h2 className={styles.dimHeading}>Size (mm)</h2>
      {paramGraph?.nodes?.length ? (
        <div className={styles.graphPanel}>
          <h3 className={styles.graphHeading}>Parametric graph</h3>
          {driven.eval.ok && driven.eval.outputValue !== null ? (
            <p className={styles.graphLine}>
              Output: <strong>{Math.round(driven.eval.outputValue)}</strong> mm
            </p>
          ) : null}
          {!driven.eval.ok && driven.eval.error ? (
            <p className={styles.graphErr} role="alert">
              {driven.eval.error}
            </p>
          ) : null}
          {driven.overrideAxis ? (
            <p className={styles.graphHint}>
              {driven.overrideAxis.charAt(0).toUpperCase() + driven.overrideAxis.slice(1)} is driven
              by the graph; adjust other axes or the graph in admin.
            </p>
          ) : null}
        </div>
      ) : null}
      {(['width', 'depth', 'height'] as const).map((axis) => {
        const mm = axis === 'width' ? widthMm : axis === 'depth' ? depthMm : heightMm
        const locked = driven.overrideAxis === axis
        return (
          <label
            key={axis}
            className={`${styles.dimRow} ${locked ? styles.dimRowLocked : ''}`.trim()}
          >
            {axis.charAt(0).toUpperCase() + axis.slice(1)}
            <input
              type="range"
              min={DIM_MM[axis].min}
              max={DIM_MM[axis].max}
              step={axis === 'height' ? 5 : 10}
              value={mm}
              disabled={locked}
              onChange={(e) => setDim(axis, Number(e.target.value))}
            />
            <input
              type="number"
              className={styles.dimNumber}
              min={DIM_MM[axis].min}
              max={DIM_MM[axis].max}
              step={axis === 'height' ? 5 : 10}
              value={mm}
              disabled={locked}
              onChange={(e) => setDim(axis, Number(e.target.value))}
            />
          </label>
        )
      })}
    </aside>
  )
}
