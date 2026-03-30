import { useMemo } from 'react'
import * as THREE from 'three'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { mmToM } from '@/lib/configuratorDimensions'
import { DIM_MM } from '@/lib/configuratorDimensions'
import { DimensionLine } from './DimensionLine'

export function DimensionsOverlay3D() {
  const { driven, showDimensions, setDim } = useConfiguratorStore()
  const widthMm = driven.widthMm
  const depthMm = driven.depthMm
  const heightMm = driven.heightMm

  const w = mmToM(widthMm)
  const h = mmToM(heightMm)
  const d = mmToM(depthMm)

  const uiScale = useMemo(() => {
    const maxDim = Math.max(w, h, d)
    return THREE.MathUtils.clamp(maxDim / 0.55, 0.75, 2.2)
  }, [w, h, d])

  const widthLocked = driven.overrideAxis === 'width'
  const heightLocked = driven.overrideAxis === 'height'
  const depthLocked = driven.overrideAxis === 'depth'

  if (!showDimensions) return null

  return (
    <group name="DimensionsOverlay3D">
      {/* Width: along X, top-back edge */}
      <DimensionLine
        start={[-w / 2, h, -d / 2]}
        end={[w / 2, h, -d / 2]}
        label={widthMm}
        setDimension={widthLocked ? undefined : (v) => setDim('width', v)}
        min={DIM_MM.width.min}
        max={DIM_MM.width.max}
        step={1}
        dimensionGap={0.025}
        anchorGap={0.005}
        fontSize={0.01}
        uiScale={uiScale}
      />

      {/* Height: along Y, right-back edge (bottom=0, top=h) */}
      <DimensionLine
        start={[w / 2, 0, -d / 2]}
        end={[w / 2, h, -d / 2]}
        label={heightMm}
        setDimension={heightLocked ? undefined : (v) => setDim('height', v)}
        min={DIM_MM.height.min}
        max={DIM_MM.height.max}
        step={1}
        dimensionGap={0.025}
        anchorGap={0.005}
        fontSize={0.01}
        uiScale={uiScale}
      />

      {/* Depth: along Z, right-bottom edge */}
      <DimensionLine
        start={[w / 2, 0, d / 2]}
        end={[w / 2, 0, -d / 2]}
        label={depthMm}
        setDimension={depthLocked ? undefined : (v) => setDim('depth', v)}
        min={DIM_MM.depth.min}
        max={DIM_MM.depth.max}
        step={1}
        dimensionGap={0.025}
        anchorGap={0.005}
        fontSize={0.01}
        uiScale={uiScale}
      />
    </group>
  )
}
