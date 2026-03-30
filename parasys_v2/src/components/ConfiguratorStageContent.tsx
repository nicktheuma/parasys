import { Bounds, Center, ContactShadows, useBounds } from '@react-three/drei'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import type { SpotLight } from 'three'
import { TemplateProduct } from '@/features/configurator/TemplateProduct'
import type { MaterialShaderSpec, SurfaceUvMapping, TemplateParametricPreset } from '@shared/types'
import { DimensionsOverlay3D } from '@/components/DimensionsOverlay3D'

type Props = {
  stageKey: string
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  materialSpec: MaterialShaderSpec
  materialId: string | null
  templateParamOverrides: Record<string, TemplateParametricPreset> | null
  uvMappings: Record<string, SurfaceUvMapping> | null
}

/** drei Stage "rembrandt" light directions; radius drives falloff with product size */
const PRESET = {
  main: [1, 2, 1] as const,
  fill: [-2, -0.5, -2] as const,
}

function FitOnceOnStageKey({ stageKey }: { stageKey: string }) {
  const bounds = useBounds()
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    // Fit only on stage changes (template/material swap), not on every dimension tweak.
    bounds.refresh().fit()
    invalidate()
  }, [bounds, invalidate, stageKey])

  return null
}

/**
 * Studio framing without drei Stage: Stage's `adjustCamera` refits the camera whenever the
 * bounding sphere changes (every dimension tweak), which causes jitter. We use Bounds with
 * fit/clip off so the camera is driven only by OrbitControls.
 *
 * ContactShadows sits at y ≈ 0 with bottom-aligned Center content (product floor at y = 0).
 * It is a sibling of Bounds (same as drei Stage), not inside Center, so it is not part of bbox.
 */
export function ConfiguratorStageContent({
  stageKey,
  templateKey,
  widthMm,
  depthMm,
  heightMm,
  materialSpec,
  materialId,
  templateParamOverrides,
  uvMappings,
}: Props) {
  const [radius, setRadius] = useState(0.25)
  const onCentered = useCallback(
    (p: { boundingSphere: { radius: number } }) => {
      const r = p.boundingSphere.radius
      if (r > 0.001) setRadius(r)
    },
    [],
  )

  const contactShadow = useMemo(
    () => ({
      scale: Math.max(18, radius * 5),
      far: Math.max(12, radius * 8),
      opacity: 0.82,
      blur: 2.25,
      resolution: 2048,
      color: '#000000' as const,
      smooth: true,
    }),
    [radius],
  )

  const keyLightRef = useRef<SpotLight>(null)
  useLayoutEffect(() => {
    const l = keyLightRef.current
    if (!l) return
    const sh = l.shadow
    sh.mapSize.set(4096, 4096)
    sh.radius = 8
    sh.bias = -0.00008
    sh.normalBias = 0.02
  }, [])

  return (
    <group key={stageKey}>
      <ambientLight intensity={1.2 / 3} />
      <spotLight
        ref={keyLightRef}
        penumbra={1}
        position={[PRESET.main[0] * radius, PRESET.main[1] * radius, PRESET.main[2] * radius]}
        intensity={1.2 * 2}
        castShadow
        shadow-bias={-0.00008}
        shadow-normalBias={0.02}
        shadow-mapSize={4096}
      />
      <pointLight
        position={[PRESET.fill[0] * radius, PRESET.fill[1] * radius, PRESET.fill[2] * radius]}
        intensity={1.2}
      />

      <Bounds fit={false} clip={false} margin={1.1} observe={false}>
        <FitOnceOnStageKey stageKey={stageKey} />
        <Center bottom onCentered={onCentered}>
          <TemplateProduct
            templateKey={templateKey}
            widthMm={widthMm}
            depthMm={depthMm}
            heightMm={heightMm}
            materialSpec={materialSpec}
            materialId={materialId}
            templateParamOverrides={templateParamOverrides}
            uvMappings={uvMappings}
          />
          <DimensionsOverlay3D />
        </Center>
      </Bounds>

      {/* Slightly below y=0 avoids z-fighting with bottom faces; world floor matches bbox bottom */}
      <ContactShadows position={[0, -0.0008, 0]} {...contactShadow} />
    </group>
  )
}
