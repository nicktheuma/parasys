import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { MaterialOrMatcap } from '@/features/configurator/MaterialOrMatcap'
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
  showBackPanel?: boolean
  showVerticalPanels?: boolean
  showShelfPanels?: boolean
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
  showBackPanel = true,
  showVerticalPanels = true,
  showShelfPanels = true,
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
        showBackPanel,
        showVerticalPanels,
        showShelfPanels,
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
    showBackPanel,
    showVerticalPanels,
    showShelfPanels,
    slotOffsetFactor,
    widthM,
  ])

  useEffect(() => {
    return () => {
      panelMeshes.forEach(({ geometry }) => {
        geometry.dispose()
      })
    }
  }, [panelMeshes])

  const mid = materialId ?? ''
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | undefined
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [panelOffsets, setPanelOffsets] = useState<Record<string, [number, number, number]>>({})
  const meshRefs = useRef<Record<string, THREE.Mesh | null>>({})
  const baseCenterById = useMemo(
    () =>
      Object.fromEntries(panelMeshes.map((m) => [m.panelSpec.id, m.panelSpec.center])) as Record<
        string,
        [number, number, number]
      >,
    [panelMeshes],
  )
  const selectedMesh = selectedPanelId ? meshRefs.current[selectedPanelId] : null

  useEffect(() => {
    setSelectedPanelId(null)
    setPanelOffsets({})
  }, [widthM, heightM, depthM, dividers, shelves, showBackPanel, showVerticalPanels, showShelfPanels, edgeOffset, slotOffsetFactor, interlockEnabled, interlockClearanceFactor, interlockLengthFactor, panelThickness])

  return (
    <group position={[0, heightM / 2, 0]}>
      {panelMeshes.map(({ panelSpec, geometry }) => {
        const faceMaps = getUvFaceMappings(uvMappings ?? null, panelSpec.kind, mid)
        const offset = panelOffsets[panelSpec.id] ?? [0, 0, 0]
        const [cx, cy, cz] = panelSpec.center
        const selected = selectedPanelId === panelSpec.id
        return (
          <mesh
            key={panelSpec.id}
            castShadow
            receiveShadow
            ref={(el) => {
              meshRefs.current[panelSpec.id] = el
            }}
            position={[cx + offset[0], cy + offset[1], cz + offset[2]]}
            rotation={panelSpec.rotation}
            geometry={geometry}
            onPointerDown={(e) => {
              e.stopPropagation()
              setSelectedPanelId(panelSpec.id)
            }}
          >
            <MaterialOrMatcap materialId={materialId} materialSpec={materialSpec} uvFaceMappings={faceMaps} />
            {selected ? (
              <lineSegments>
                <edgesGeometry args={[geometry]} />
                <lineBasicMaterial color="#8bc3ff" />
              </lineSegments>
            ) : null}
          </mesh>
        )
      })}
      {selectedMesh ? (
        <TransformControls
          object={selectedMesh}
          mode="translate"
          onMouseDown={() => {
            if (controls && 'enabled' in controls) controls.enabled = false
          }}
          onMouseUp={() => {
            if (controls && 'enabled' in controls) controls.enabled = true
          }}
          onObjectChange={() => {
            if (!selectedPanelId || !selectedMesh) return
            const base = baseCenterById[selectedPanelId]
            if (!base) return
            setPanelOffsets((prev) => ({
              ...prev,
              [selectedPanelId]: [
                selectedMesh.position.x - base[0],
                selectedMesh.position.y - base[1],
                selectedMesh.position.z - base[2],
              ],
            }))
          }}
        />
      ) : null}
    </group>
  )
}
