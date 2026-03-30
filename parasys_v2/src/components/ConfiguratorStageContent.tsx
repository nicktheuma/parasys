import { useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Stage } from '@react-three/drei'
import { TemplateProduct } from '@/features/configurator/TemplateProduct'
import type { MaterialShaderSpec, SurfaceUvMapping, TemplateParametricPreset } from '@shared/types'
import { DimensionsOverlay3D } from '@/components/DimensionsOverlay3D'

type Props = {
  stageKey: string
  adminMode?: boolean
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  materialSpec: MaterialShaderSpec
  materialId: string | null
  templateParamOverrides: Record<string, TemplateParametricPreset> | null
  uvMappings: Record<string, SurfaceUvMapping> | null
}

/**
 * Wraps mesh in a ref so drei's Center can measure bbox from the product only.
 * Dimension overlays stay siblings (same transform) but are excluded from bounds —
 * otherwise Stage's contact shadow Y uses height that includes long dimension lines,
 * and the shadow sits far below the model.
 */
export function ConfiguratorStageContent({
  stageKey,
  adminMode,
  templateKey,
  widthMm,
  depthMm,
  heightMm,
  materialSpec,
  materialId,
  templateParamOverrides,
  uvMappings,
}: Props) {
  const meshRootRef = useRef<THREE.Group>(null)
  const [meshForBounds, setMeshForBounds] = useState<THREE.Object3D | null>(null)

  useLayoutEffect(() => {
    const o = meshRootRef.current
    if (o) setMeshForBounds(o)
  }, [stageKey, templateKey, widthMm, depthMm, heightMm])

  return (
    <Stage
      key={stageKey}
      intensity={1.2}
      preset="rembrandt"
      center={
        meshForBounds
          ? { bottom: true, object: meshForBounds }
          : { bottom: true }
      }
      shadows={{
        type: 'contact',
        color: 'black',
        blur: 2.5,
        opacity: 0.22,
        offset: 0,
        bias: -0.0001,
        normalBias: 0,
        size: 2048,
      }}
      adjustCamera={adminMode ? false : 1.1}
      environment={null}
    >
      <group ref={meshRootRef}>
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
      </group>
      <DimensionsOverlay3D />
    </Stage>
  )
}
