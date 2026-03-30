import { useEffect, useMemo } from 'react'
import { LayeredShaderMaterial } from '@/features/configurator/LayeredShaderMaterial'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import { generatePanelSpecs } from './panelSpecs'
import { createExtrudedPanelGeometry } from './profileBuilder'

type Props = {
  widthM: number
  heightM: number
  depthM: number
  materialSpec: MaterialShaderSpec
  dividers?: number
  shelves?: number
  edgeOffset?: number
  slotOffsetFactor?: number
  interlockEnabled?: boolean
  interlockClearanceFactor?: number
  interlockLengthFactor?: number
}

export function ParametricPanelProduct({
  widthM,
  heightM,
  depthM,
  materialSpec,
  dividers = 2,
  shelves = 2,
  edgeOffset = 0,
  slotOffsetFactor = 0.5,
  interlockEnabled = true,
  interlockClearanceFactor = 0.12,
  interlockLengthFactor = 1.6,
}: Props) {
  const panelMeshes = useMemo(() => {
    const materialThickness = Math.max(0.002, Math.min(widthM, depthM, heightM) * 0.03)
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
    shelves,
    slotOffsetFactor,
    widthM,
  ])

  useEffect(() => {
    return () => {
      panelMeshes.forEach(({ geometry }) => geometry.dispose())
    }
  }, [panelMeshes])

  return (
    <group>
      {panelMeshes.map(({ panelSpec, geometry }) => (
        <mesh
          key={panelSpec.id}
          castShadow
          receiveShadow
          position={panelSpec.center}
          rotation={panelSpec.rotation}
          geometry={geometry}
        >
          <LayeredShaderMaterial spec={materialSpec} />
        </mesh>
      ))}
    </group>
  )
}
