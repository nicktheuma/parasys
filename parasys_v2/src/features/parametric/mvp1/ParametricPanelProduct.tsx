import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { MaterialOrMatcap } from '@/features/configurator/MaterialOrMatcap'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import type { SurfaceUvMapping } from '@shared/types'
import { getUvFaceMappings, useConfiguratorStore } from '@/stores/configuratorStore'
import { generatePanelSpecs } from './panelSpecs'
import { createExtrudedPanelGeometry } from './profileBuilder'

type Props = {
  widthM: number
  heightM: number
  depthM: number
  materialSpec: MaterialShaderSpec
  materialId: string | null
  materialHydrated?: boolean
  adminMode?: boolean
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
  materialHydrated = true,
  adminMode = false,
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
  const productRootRef = useRef<THREE.Group | null>(null)
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
  const dimensionUi = useConfiguratorStore((s) => s.dimensionUi)
  const dimensionEditorEnabled = useConfiguratorStore((s) => s.dimensionEditorEnabled)
  const panelSelectionEnabled = useConfiguratorStore((s) => s.panelSelectionEnabled)
  const dimensionPickMode = useConfiguratorStore((s) => s.dimensionPickMode)
  const pushDimensionPickPoint = useConfiguratorStore((s) => s.pushDimensionPickPoint)
  const setDimensionPickHoverPoint = useConfiguratorStore((s) => s.setDimensionPickHoverPoint)
  const showVertexDebug = useConfiguratorStore((s) => s.showVertexDebug)
  const setDimensionUi = useConfiguratorStore((s) => s.setDimensionUi)
  const selectedPropPlacementId = useConfiguratorStore((s) => s.selectedPropPlacementId)
  const setSelectedPropPlacementId = useConfiguratorStore((s) => s.setSelectedPropPlacementId)
  const highlightOutlineColor = dimensionUi?.highlightOutlineColor ?? '#ffd84d'
  const highlightFaceColor = dimensionUi?.lockFaceColorToOutline
    ? highlightOutlineColor
    : (dimensionUi?.highlightFaceColor ?? '#fff07a')
  const debugVertexColor = dimensionUi?.debugVertexColor ?? '#111111'
  const debugVertexSize = Math.max(0.001, Math.min(0.05, dimensionUi?.debugVertexSize ?? 0.0036))
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)

  useEffect(() => {
    if (selectedPropPlacementId) setSelectedPanelId(null)
  }, [selectedPropPlacementId])
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
  const canSelectPanels = Boolean(adminMode && !dimensionEditorEnabled && panelSelectionEnabled)
  const selectedMesh = canSelectPanels && selectedPanelId ? meshRefs.current[selectedPanelId] : null
  const pickBoxById = useMemo(() => {
    const out: Record<string, { center: [number, number, number]; size: [number, number, number] }> = {}
    for (const m of panelMeshes) {
      m.geometry.computeBoundingBox()
      const box = m.geometry.boundingBox
      if (!box) continue
      const c = new THREE.Vector3()
      const s = new THREE.Vector3()
      box.getCenter(c)
      box.getSize(s)
      out[m.panelSpec.id] = {
        center: [c.x, c.y, c.z],
        size: [Math.max(0.01, s.x), Math.max(0.01, s.y), Math.max(0.01, s.z)],
      }
    }
    return out
  }, [panelMeshes])
  const gizmoAnchorRef = useRef<THREE.Object3D | null>(null)
  const lastAnchorPosRef = useRef(new THREE.Vector3())
  const centerLocalById = useMemo(() => {
    const out: Record<string, THREE.Vector3> = {}
    for (const m of panelMeshes) {
      m.geometry.computeBoundingBox()
      const box = m.geometry.boundingBox
      if (!box) continue
      out[m.panelSpec.id] = box.getCenter(new THREE.Vector3())
    }
    return out
  }, [panelMeshes])
  const placeGizmoAtPanelCenter = (panelId: string | null) => {
    if (!panelId || !gizmoAnchorRef.current) return
    const mesh = meshRefs.current[panelId]
    if (!mesh) return
    const geom = mesh.geometry
    geom.computeBoundingBox()
    const box = geom.boundingBox
    if (!box) return
    // True geometry center in world coordinates (independent of object origin).
    const worldCenter = box.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
    const group = mesh.parent
    if (!group) return
    const groupCenter = group.worldToLocal(worldCenter.clone())
    gizmoAnchorRef.current.position.copy(groupCenter)
    gizmoAnchorRef.current.updateMatrixWorld(true)
    lastAnchorPosRef.current.copy(groupCenter)
  }

  useEffect(() => {
    const rows = dimensionUi?.customDimensions ?? []
    if (rows.length === 0) return
    let changed = false
    const overlayRoot = productRootRef.current?.parent ?? productRootRef.current
    if (!overlayRoot) return
    const updated = rows.map((row) => {
      const resolveAnchor = (a?: { panelId: string; vertexIndex: number }) => {
        if (!a) return null
        const mesh = meshRefs.current[a.panelId]
        if (!mesh) return null
        const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
        if (!attr || a.vertexIndex < 0 || a.vertexIndex >= attr.count) return null
        const v = new THREE.Vector3(
          attr.getX(a.vertexIndex),
          attr.getY(a.vertexIndex),
          attr.getZ(a.vertexIndex),
        )
        const world = mesh.localToWorld(v)
        const local = overlayRoot.worldToLocal(world)
        return [local.x, local.y, local.z] as [number, number, number]
      }
      const s = resolveAnchor(row.startAnchor)
      const e = resolveAnchor(row.endAnchor)
      if (!s || !e) return row
      const d =
        Math.abs((row.start?.[0] ?? 0) - s[0]) +
        Math.abs((row.start?.[1] ?? 0) - s[1]) +
        Math.abs((row.start?.[2] ?? 0) - s[2]) +
        Math.abs((row.end?.[0] ?? 0) - e[0]) +
        Math.abs((row.end?.[1] ?? 0) - e[1]) +
        Math.abs((row.end?.[2] ?? 0) - e[2])
      if (d > 1e-6) changed = true
      return { ...row, start: s, end: e }
    })
    if (changed) setDimensionUi({ customDimensions: updated })
  }, [dimensionUi?.customDimensions, panelOffsets, setDimensionUi])

  useEffect(() => {
    setSelectedPanelId(null)
    setPanelOffsets({})
  }, [widthM, heightM, depthM, dividers, shelves, showBackPanel, showVerticalPanels, showShelfPanels, edgeOffset, slotOffsetFactor, interlockEnabled, interlockClearanceFactor, interlockLengthFactor, panelThickness])

  useEffect(() => {
    if (!adminMode) setSelectedPanelId(null)
  }, [adminMode])

  useEffect(() => {
    if (!adminMode) return
    placeGizmoAtPanelCenter(selectedPanelId)
  }, [adminMode, selectedPanelId, selectedMesh, centerLocalById, panelOffsets])

  return (
    <group ref={productRootRef} position={[0, heightM / 2, 0]}>
      {canSelectPanels ? (
        <mesh
          onPointerDown={() => {
            setSelectedPanelId(null)
          }}
        >
          <sphereGeometry args={[100, 12, 12]} />
          <meshBasicMaterial
            side={THREE.BackSide}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ) : null}
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
          >
            {showVertexDebug ? (
              <meshStandardMaterial
                color="#9aa0a6"
                wireframe
                transparent
                opacity={0.3}
                metalness={0}
                roughness={1}
              />
            ) : (
              <MaterialOrMatcap
                materialId={materialId}
                materialSpec={materialSpec}
                materialHydrated={materialHydrated}
                uvFaceMappings={faceMaps}
                opacity={adminMode && selected ? 0.3 : 1}
              />
            )}
            {adminMode && selected ? (
              <lineSegments raycast={() => []}>
                <edgesGeometry args={[geometry]} />
                <lineBasicMaterial color={highlightOutlineColor} />
              </lineSegments>
            ) : null}
            {adminMode && selected ? (
              <mesh geometry={geometry} raycast={() => []}>
                <meshBasicMaterial
                  color={highlightFaceColor}
                  transparent
                  opacity={0.28}
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-1}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : null}
            {canSelectPanels || dimensionPickMode ? (
              <mesh
                position={pickBoxById[panelSpec.id]?.center ?? [0, 0, 0]}
                onPointerMove={(e) => {
                  if (!dimensionPickMode) return
                  e.stopPropagation()
                  const pt = e.point.clone()
                  const posAttr = geometry.getAttribute('position')
                  if (!posAttr) return
                  const panelObj = (e.eventObject as THREE.Object3D).parent
                  if (!panelObj) return
                  const hitLocal = panelObj.worldToLocal(pt.clone())
                  let best = new THREE.Vector3()
                  let bestD = Number.POSITIVE_INFINITY
                  const v = new THREE.Vector3()
                  for (let i = 0; i < posAttr.count; i += 1) {
                    v.fromBufferAttribute(posAttr as THREE.BufferAttribute, i)
                    const d2 = v.distanceToSquared(hitLocal)
                    if (d2 < bestD) {
                      bestD = d2
                      best.copy(v)
                    }
                  }
                  const worldBest = panelObj.localToWorld(best.clone())
                  const root = productRootRef.current?.parent ?? productRootRef.current
                  if (!root) return
                  const local = root.worldToLocal(worldBest.clone())
                  setDimensionPickHoverPoint([local.x, local.y, local.z])
                }}
                onPointerOut={() => {
                  if (dimensionPickMode) setDimensionPickHoverPoint(null)
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  if (dimensionPickMode) {
                    const pt = e.point.clone()
                    const posAttr = geometry.getAttribute('position')
                    if (posAttr) {
                      const panelObj = (e.eventObject as THREE.Object3D).parent
                      if (!panelObj) return
                      const hitLocal = panelObj.worldToLocal(pt.clone())
                      let best = new THREE.Vector3()
                      let bestD = Number.POSITIVE_INFINITY
                      const v = new THREE.Vector3()
                      for (let i = 0; i < posAttr.count; i += 1) {
                        v.fromBufferAttribute(posAttr as THREE.BufferAttribute, i)
                        const d2 = v.distanceToSquared(hitLocal)
                        if (d2 < bestD) {
                          bestD = d2
                          best.copy(v)
                        }
                      }
                      const worldBest = panelObj.localToWorld(best.clone())
                      const root = productRootRef.current?.parent ?? productRootRef.current
                      if (root) {
                        const local = root.worldToLocal(worldBest.clone())
                        pushDimensionPickPoint([local.x, local.y, local.z], {
                          panelId: panelSpec.id,
                          vertexIndex: (() => {
                            const attr = geometry.getAttribute('position') as THREE.BufferAttribute
                            const hitLocal = panelObj.worldToLocal(pt.clone())
                            const v = new THREE.Vector3()
                            let bestI = 0
                            let bestD = Number.POSITIVE_INFINITY
                            for (let i = 0; i < attr.count; i += 1) {
                              v.fromBufferAttribute(attr, i)
                              const d2 = v.distanceToSquared(hitLocal)
                              if (d2 < bestD) {
                                bestD = d2
                                bestI = i
                              }
                            }
                            return bestI
                          })(),
                        })
                        return
                      }
                    }
                    return
                  }
                  if (canSelectPanels) {
                    setSelectedPropPlacementId(null)
                    setSelectedPanelId(panelSpec.id)
                    placeGizmoAtPanelCenter(panelSpec.id)
                  }
                }}
              >
                <boxGeometry args={pickBoxById[panelSpec.id]?.size ?? [0.01, 0.01, 0.01]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            ) : null}
            {adminMode && showVertexDebug ? (
              <group raycast={() => null}>
                {(() => {
                  const c = centerLocalById[panelSpec.id] ?? new THREE.Vector3()
                  const box = pickBoxById[panelSpec.id]
                  const minDim = box ? Math.min(box.size[0], box.size[1], box.size[2]) : 0.1
                  const arm = Math.max(0.008, minDim * 0.2)
                  const thick = Math.max(0.0007, arm * 0.09)
                  return (
                    <group position={[c.x, c.y, c.z]}>
                      <mesh>
                        <boxGeometry args={[arm, thick, thick]} />
                        <meshBasicMaterial color="#111111" />
                      </mesh>
                      <mesh>
                        <boxGeometry args={[thick, arm, thick]} />
                        <meshBasicMaterial color="#111111" />
                      </mesh>
                      <mesh>
                        <boxGeometry args={[thick, thick, arm]} />
                        <meshBasicMaterial color="#111111" />
                      </mesh>
                    </group>
                  )
                })()}
                {(() => {
                  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
                  if (!posAttr) return null
                  const pts: Array<[number, number, number]> = []
                  const seen = new Set<string>()
                  for (let i = 0; i < posAttr.count; i += 1) {
                    const x = posAttr.getX(i)
                    const y = posAttr.getY(i)
                    const z = posAttr.getZ(i)
                    const key = `${Math.round(x * 10000)}|${Math.round(y * 10000)}|${Math.round(z * 10000)}`
                    if (seen.has(key)) continue
                    seen.add(key)
                    pts.push([x, y, z])
                  }
                  return pts.map((p, i) => (
                    <mesh key={`v-${panelSpec.id}-${i}`} position={p}>
                      <sphereGeometry args={[debugVertexSize, 8, 8]} />
                      <meshBasicMaterial color={debugVertexColor} />
                    </mesh>
                  ))
                })()}
              </group>
            ) : null}
          </mesh>
        )
      })}
      {canSelectPanels && selectedMesh ? (
        <TransformControls
          object={gizmoAnchorRef.current ?? undefined}
          mode="translate"
          onMouseDown={() => {
            if (controls && 'enabled' in controls) controls.enabled = false
          }}
          onMouseUp={() => {
            if (controls && 'enabled' in controls) controls.enabled = true
          }}
          onObjectChange={() => {
            const anchor = gizmoAnchorRef.current
            if (!selectedPanelId || !selectedMesh || !anchor) return
            const delta = anchor.position.clone().sub(lastAnchorPosRef.current)
            if (delta.lengthSq() <= 1e-10) return
            selectedMesh.position.add(delta)
            lastAnchorPosRef.current.copy(anchor.position)
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
      <object3D ref={gizmoAnchorRef} />
    </group>
  )
}
