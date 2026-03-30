import { useEffect, useMemo } from 'react'
import { LayeredShaderMaterial } from '@/features/configurator/LayeredShaderMaterial'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import type { SurfaceUvMapping } from '@shared/types'
import { getUvFaceMappings } from '@/stores/configuratorStore'
import { generatePanelSpecs } from './panelSpecs'
import { createExtrudedPanelGeometry } from './profileBuilder'

type Props = {
  widthM: number
  heightM: number
  depthM: number
  materialSpec: MaterialShaderSpec
  materialId: string | null
  uvMappings?: Record<string, SurfaceUvMapping> | null
  dividers?: number
  shelves?: number
  edgeOffset?: number
  slotOffsetFactor?: number
  interlockEnabled?: boolean
  interlockClearanceFactor?: number
  interlockLengthFactor?: number
  panelThickness?: number
}

export function ParametricPanelProduct({
  widthM,
  heightM,
  depthM,
  materialSpec,
  materialId,
  uvMappings,
  dividers = 2,
  shelves = 2,
  edgeOffset = 0,
  slotOffsetFactor = 0.5,
  interlockEnabled = true,
  interlockClearanceFactor = 0.12,
  interlockLengthFactor = 1.6,
  panelThickness,
}: Props) {
  const panelMeshes = useMemo(() => {
    const autoThickness = Math.max(0.002, Math.min(widthM, depthM, heightM) * 0.03)
    const materialThickness = panelThickness != null ? Math.max(0.001, panelThickness) : autoThickness
    const slotOffset = materialThickness * slotOffsetFactor
    const panelSpecs = generatePanelSpecs({
      width: widthM,
      height: heightM,
      depth: depthM,
      dividers,
      shelves,
      edgeOffset,
      slotOffset,
      materialThickness,
    })
    return panelSpecs.map((panelSpec) => ({
      panelSpec,
      ...createExtrudedPanelGeometry(
        panelSpec,
        {
          enabled: true,
          size: Math.min(materialThickness * 0.18, 0.0012),
          thickness: Math.min(materialThickness * 0.18, 0.0012),
          segments: 2,
        },
        {
          allPanelSpecs: panelSpecs,
          interlockSlots: {
            enabled: interlockEnabled,
            clearance: materialThickness * interlockClearanceFactor,
            lengthFactor: interlockLengthFactor,
          },
        },
      ),
    }))
  }, [
    depthM,
    dividers,
    edgeOffset,
    heightM,
    interlockClearanceFactor,
    interlockEnabled,
    interlockLengthFactor,
    panelThickness,
    shelves,
    slotOffsetFactor,
    widthM,
  ])

  useEffect(() => {
    return () => {
      panelMeshes.forEach(({ geometry }) => geometry.dispose())
    }
  }, [panelMeshes])

  const mid = materialId ?? ''

  return (
    <group>
      {panelMeshes.map(({ panelSpec, geometry }) => {
        const faceMaps = getUvFaceMappings(uvMappings ?? null, panelSpec.kind, mid)
        return (
          <mesh
            key={panelSpec.id}
            castShadow
            receiveShadow
            position={panelSpec.center}
            rotation={panelSpec.rotation}
            geometry={geometry}
          >
            <LayeredShaderMaterial spec={materialSpec} uvFaceMappings={faceMaps} />
          </mesh>
        )
      })}
    </group>
  )
}
