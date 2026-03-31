import { Suspense, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { LayeredShaderMaterial } from '@/features/configurator/LayeredShaderMaterial'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import { mergeTemplateParametricPreset } from '@/features/parametric/mvp1/templateParametricPresets'
import type { ConfiguratorPropPlacement, ConfiguratorPropsSettings } from '@shared/types'
import { defaultMaterialSpec } from '@/lib/defaultMaterialSpec'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { expandPropPlacementsForRender } from './expandPropPlacements'
import { panelAnchorsFromDimsMm } from './panelPropAnchors'
import type { ShelfAnchor } from './panelPropAnchors'
import {
  clampIntCount,
  clampPropUnsigned,
  PROP_SETTING_MAX,
  PROP_SETTING_MIN,
} from './propSettingsLimits'
import type { PropLibraryItem } from './types'
import { PropGlbMesh } from './PropGlbMesh'

export type { PropLibraryItem } from './types'

type Props = {
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  templateParamOverrides: Record<string, import('@shared/types').TemplateParametricPreset> | null
  propsConfig: ConfiguratorPropsSettings | null | undefined
  propLibrary: PropLibraryItem[]
  adminMode?: boolean
}

const MM = 0.001
const SHELF_MARGIN = 0.998
const PRIMITIVE_DIMS_M: [number, number, number] = [0.24, 0.24, 0.24]

function primitiveTypeFromPlacement(v: unknown): 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'icosahedron' {
  return v === 'sphere' || v === 'cylinder' || v === 'cone' || v === 'torus' || v === 'icosahedron' ? v : 'box'
}

function resolvePropMaterial(
  placement: ConfiguratorPropPlacement,
  lib: PropLibraryItem | undefined,
): MaterialShaderSpec {
  if (placement.materialSpec) return placement.materialSpec
  if (lib?.defaultShader) return lib.defaultShader
  return defaultMaterialSpec('#9ca3af')
}

function alignFactors(
  alignX?: string,
  alignZ?: string,
): { ax: number; az: number } {
  const ax = alignX === 'left' ? -1 : alignX === 'right' ? 1 : 0
  const az = alignZ === 'front' ? 1 : alignZ === 'back' ? -1 : 0
  return { ax, az }
}

function makeRng(seed: number) {
  let t = (seed >>> 0) + 0x6d2b79f5
  return () => {
    t |= 0
    t = (t + 0x6d2b79f5) | 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function hashPlacementId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

type EmitInstance = {
  key: string
  placementId: string
  kind: 'placeholder_cube' | 'glb' | 'primitive'
  glbUrl: string | null
  position: [number, number, number]
  scale: [number, number, number]
  dims: [number, number, number]
  primitiveType?: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'icosahedron'
  rotation: [number, number, number]
  materialSpec: MaterialShaderSpec
}

function jitterIncrementFromPlacement(pl: ConfiguratorPropPlacement): number {
  const clampInc = (v: number) => {
    if (!Number.isFinite(v) || v <= 0) return 0
    return Math.min(PROP_SETTING_MAX, Math.max(PROP_SETTING_MIN, v))
  }
  const inc = pl.arrayScaleJitterIncrement
  if (inc !== undefined && Number.isFinite(inc)) {
    return clampInc(inc)
  }
  const legacy = pl.arrayScaleJitter
  if (legacy !== undefined && Number.isFinite(legacy)) {
    return clampInc(legacy * 0.5)
  }
  return 0
}

function emitInstancesForPlacement(
  pl: ConfiguratorPropPlacement,
  anchor: ShelfAnchor,
  anchorCenter: [number, number, number],
  lib: PropLibraryItem | undefined,
  isPrimitive: boolean,
  globalSeed: number,
): EmitInstance[] {
  const out: EmitInstance[] = []

  const [dw, dh, dd] = isPrimitive
    ? PRIMITIVE_DIMS_M
    : (lib?.placeholderDimsMm.map((x) => x * MM) as [number, number, number])
  const bias = clampPropUnsigned(pl.scaleBias ?? 1)
  const sxMax = (anchor.halfWidth * 2) / dw
  const szMax = (anchor.halfDepth * 2) / dd
  const syMax = dh > 1e-9 ? anchor.maxHeight / dh : anchor.maxHeight
  const maxScale = Math.min(sxMax, szMax, syMax)
  const baseScale = maxScale * SHELF_MARGIN
  const uniformScale = Math.max(PROP_SETTING_MIN * 0.02, Math.min(baseScale * bias, maxScale))
  const axisScaleX = clampPropUnsigned(pl.scaleX ?? 1)
  const axisScaleY = clampPropUnsigned(pl.scaleY ?? 1)
  const axisScaleZ = clampPropUnsigned(pl.scaleZ ?? 1)
  const wantedX = dw * uniformScale * axisScaleX
  const wantedY = dh * uniformScale * axisScaleY
  const wantedZ = dd * uniformScale * axisScaleZ
  const fitX = wantedX > 1e-9 ? (anchor.halfWidth * 2) / wantedX : 1
  const fitY = wantedY > 1e-9 ? anchor.maxHeight / wantedY : 1
  const fitZ = wantedZ > 1e-9 ? (anchor.halfDepth * 2) / wantedZ : 1
  const axisFit = Math.max(0.02, Math.min(1, fitX, fitY, fitZ))
  const sx = uniformScale * axisScaleX * axisFit
  const sy = uniformScale * axisScaleY * axisFit
  const sz = uniformScale * axisScaleZ * axisFit

  const halfY = (dh * sy) / 2
  const hw = (dw * sx) / 2
  const hd = (dd * sz) / 2
  const gap = 0.003
  const maxOffsetX = Math.max(0, anchor.halfWidth - hw - gap)
  const maxOffsetZ = Math.max(0, anchor.halfDepth - hd - gap)
  const { ax, az } = alignFactors(pl.alignX, pl.alignZ)
  const ox = Math.max(-1, Math.min(1, pl.offsetX ?? 0))
  const oz = Math.max(-1, Math.min(1, pl.offsetZ ?? 0))
  const xFactor = Math.max(-1, Math.min(1, ax + ox))
  const zFactor = Math.max(-1, Math.min(1, az + oz))

  let nx = clampIntCount(pl.arrayCountX ?? 1, 1, 10)
  let ny = clampIntCount(pl.arrayCountY ?? 1, 1, 10)
  let nz = clampIntCount(pl.arrayCountZ ?? 1, 1, 10)
  const stackGap = gap
  const maxNy = Math.max(
    1,
    Math.min(10, Math.floor((anchor.maxHeight + stackGap) / (2 * halfY + stackGap))),
  )
  ny = Math.min(ny, maxNy)

  const spacingX = pl.arraySpacingX ?? 0
  const spacingY = pl.arraySpacingY ?? 0
  const spacingZ = pl.arraySpacingZ ?? 0

  const autoStepX = nx > 1 ? (2 * maxOffsetX) / Math.max(nx - 1, 1) : 0
  const autoStepZ = nz > 1 ? (2 * maxOffsetZ) / Math.max(nz - 1, 1) : 0
  const stepX = nx > 1 ? (spacingX > 0 ? spacingX : autoStepX) : 0
  const stepZ = nz > 1 ? (spacingZ > 0 ? spacingZ : autoStepZ) : 0

  const jitterAmt = jitterIncrementFromPlacement(pl)
  const rng = makeRng(globalSeed + hashPlacementId(pl.id))

  const rot: [number, number, number] = [
    pl.rotationX ?? 0,
    pl.rotationY ?? 0,
    pl.rotationZ ?? 0,
  ]

  const oxPos = pl.positionOffsetX ?? 0
  const oyPos = pl.positionOffsetY ?? 0
  const ozPos = pl.positionOffsetZ ?? 0

  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let iz = 0; iz < nz; iz += 1) {
        const posX =
          nx > 1
            ? anchorCenter[0] + (ix - (nx - 1) / 2) * stepX
            : anchorCenter[0] + xFactor * maxOffsetX
        const posZ =
          nz > 1
            ? anchorCenter[2] + (iz - (nz - 1) / 2) * stepZ
            : anchorCenter[2] + zFactor * maxOffsetZ
        const layerGap = spacingY > 0 ? spacingY : stackGap
        const posY =
          anchorCenter[1] + (2 * iy + 1) * halfY + iy * layerGap

        let jx = sx
        let jy = sy
        let jz = sz
        if (jitterAmt > 0) {
          const t = rng()
          const m = Math.max(0.35, Math.min(1.65, 1 + (t * 2 - 1) * jitterAmt))
          jx *= m
          jy *= m
          jz *= m
        }

        const pos: [number, number, number] = [
          posX + oxPos,
          posY + oyPos,
          posZ + ozPos,
        ]

        out.push({
          key: `${pl.id}-${ix}-${iy}-${iz}`,
          placementId: pl.id,
          kind: isPrimitive ? 'primitive' : (lib?.kind ?? 'placeholder_cube'),
          glbUrl: isPrimitive ? null : (lib?.glbUrl ?? null),
          position: pos,
          scale: [jx, jy, jz],
          dims: [dw, dh, dd],
          primitiveType: isPrimitive ? primitiveTypeFromPlacement(pl.primitiveType) : undefined,
          rotation: rot,
          materialSpec: resolvePropMaterial(pl, lib),
        })
      }
    }
  }
  return out
}

export function PropInstances({
  templateKey,
  widthMm,
  depthMm,
  heightMm,
  templateParamOverrides,
  propsConfig,
  propLibrary,
  adminMode = false,
}: Props) {
  const panelSelectionEnabled = useConfiguratorStore((s) => s.panelSelectionEnabled)
  const dimensionEditorEnabled = useConfiguratorStore((s) => s.dimensionEditorEnabled)
  const selectedPropPlacementId = useConfiguratorStore((s) => s.selectedPropPlacementId)
  const setSelectedPropPlacementId = useConfiguratorStore((s) => s.setSelectedPropPlacementId)
  const canPickProps = Boolean(adminMode && panelSelectionEnabled && !dimensionEditorEnabled)

  const onPropPointerDown = (placementId: string) => (e: ThreeEvent<PointerEvent>) => {
    if (!canPickProps) return
    e.stopPropagation()
    setSelectedPropPlacementId(placementId)
  }
  const preset = mergeTemplateParametricPreset(templateKey, templateParamOverrides?.[templateKey] ?? null)
  const shelves = preset?.shelves ?? 2
  const edgeOffset = preset?.edgeOffset ?? 0
  const widthM = widthMm * MM
  const depthM = depthMm * MM
  const heightM = heightMm * MM
  const autoThickness = Math.max(0.002, Math.min(widthM, depthM, heightM) * 0.03)
  const materialThickness =
    preset?.panelThickness != null ? Math.max(0.001, preset.panelThickness) : autoThickness
  const slotOffsetFactor = preset?.slotOffsetFactor ?? 0.5
  const slotOffset = materialThickness * slotOffsetFactor

  const anchors = useMemo(
    () =>
      panelAnchorsFromDimsMm(widthMm, depthMm, heightMm, shelves, materialThickness, edgeOffset, slotOffset),
    [widthMm, depthMm, heightMm, shelves, materialThickness, edgeOffset, slotOffset],
  )

  const anchorById = useMemo(() => new Map(anchors.map((a) => [a.id, a])), [anchors])
  const libById = useMemo(() => new Map(propLibrary.map((p) => [p.id, p])), [propLibrary])

  const availablePropIds = useMemo(() => propLibrary.map((p) => p.id), [propLibrary])

  const placements = useMemo(
    () => expandPropPlacementsForRender(propsConfig, anchors, availablePropIds),
    [propsConfig, anchors, availablePropIds],
  )

  const instances = useMemo(() => {
    const globalSeed = Math.round(propsConfig?.autoSeed ?? 0)

    const groupPivotId = new Map<string, string>()
    const byGroup = new Map<string, ConfiguratorPropPlacement[]>()
    for (const pl of placements) {
      const gid = pl.groupId?.trim()
      if (!gid) continue
      if (!byGroup.has(gid)) byGroup.set(gid, [])
      byGroup.get(gid)!.push(pl)
    }
    for (const [gid, list] of byGroup) {
      const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id))
      groupPivotId.set(gid, sorted[0]!.id)
    }

    const pivotFirstCellPos = new Map<string, [number, number, number]>()

    for (const pl of placements) {
      const gid = pl.groupId?.trim()
      if (!gid) continue
      if (groupPivotId.get(gid) !== pl.id) continue
      const anchor = anchorById.get(pl.anchorId)
      if (!anchor) continue
      const isPrimitive = pl.kind === 'primitive'
      const lib = !isPrimitive && pl.propLibraryId ? libById.get(pl.propLibraryId) : undefined
      if (!isPrimitive && !lib) continue
      if (!isPrimitive && lib && lib.kind !== 'placeholder_cube' && lib.kind !== 'glb') continue

      const ac: [number, number, number] = [anchor.center[0], anchor.center[1], anchor.center[2]]
      const emitted = emitInstancesForPlacement(pl, anchor, ac, lib, isPrimitive, globalSeed)
      const first = emitted[0]
      if (first) {
        pivotFirstCellPos.set(gid, first.position)
      }
    }

    const out: EmitInstance[] = []

    for (const pl of placements) {
      const anchor = anchorById.get(pl.anchorId)
      if (!anchor) continue
      const isPrimitive = pl.kind === 'primitive'
      const lib = !isPrimitive && pl.propLibraryId ? libById.get(pl.propLibraryId) : undefined
      if (!isPrimitive && !lib) continue
      if (!isPrimitive && lib && lib.kind !== 'placeholder_cube' && lib.kind !== 'glb') continue

      const gid = pl.groupId?.trim()
      let anchorCenter: [number, number, number] = [anchor.center[0], anchor.center[1], anchor.center[2]]

      if (gid && groupPivotId.get(gid) !== pl.id && pivotFirstCellPos.has(gid)) {
        const p0 = pivotFirstCellPos.get(gid)!
        anchorCenter = [
          p0[0] + (pl.groupOffsetX ?? 0),
          p0[1] + (pl.groupOffsetY ?? 0),
          p0[2] + (pl.groupOffsetZ ?? 0),
        ]
      }

      out.push(...emitInstancesForPlacement(pl, anchor, anchorCenter, lib, isPrimitive, globalSeed))
    }

    return out
  }, [placements, anchorById, libById, propsConfig?.autoSeed])

  if (instances.length === 0) return null

  return (
    <group position={[0, heightM / 2, 0]}>
      <Suspense fallback={null}>
        {instances.map((inst) =>
          inst.kind === 'glb' && inst.glbUrl ? (
            <PropGlbMesh
              key={inst.key}
              url={inst.glbUrl}
              scale={inst.scale[0]}
              position={inst.position}
              materialSpec={inst.materialSpec}
              rotation={inst.rotation}
              onPointerDown={canPickProps ? onPropPointerDown(inst.placementId) : undefined}
              selected={selectedPropPlacementId === inst.placementId}
            />
          ) : inst.kind === 'primitive' ? (
            <mesh
              key={inst.key}
              position={inst.position}
              scale={inst.scale.map((s) => s * (selectedPropPlacementId === inst.placementId ? 1.045 : 1)) as [number, number, number]}
              rotation={inst.rotation}
              castShadow
              receiveShadow
              onPointerDown={canPickProps ? onPropPointerDown(inst.placementId) : undefined}
            >
              {inst.primitiveType === 'sphere' ? (
                <sphereGeometry args={[Math.max(1e-3, inst.dims[0] * 0.5), 24, 24]} />
              ) : inst.primitiveType === 'cylinder' ? (
                <cylinderGeometry args={[inst.dims[0] * 0.35, inst.dims[0] * 0.35, inst.dims[1], 20]} />
              ) : inst.primitiveType === 'cone' ? (
                <coneGeometry args={[inst.dims[0] * 0.4, inst.dims[1], 20]} />
              ) : inst.primitiveType === 'torus' ? (
                <torusGeometry args={[inst.dims[0] * 0.35, inst.dims[0] * 0.12, 14, 24]} />
              ) : inst.primitiveType === 'icosahedron' ? (
                <icosahedronGeometry args={[inst.dims[0] * 0.4, 0]} />
              ) : (
                <boxGeometry args={inst.dims} />
              )}
              <LayeredShaderMaterial spec={inst.materialSpec} uvFaceMappings={[]} />
            </mesh>
          ) : (
            <mesh
              key={inst.key}
              position={inst.position}
              scale={inst.scale.map((s) => s * (selectedPropPlacementId === inst.placementId ? 1.045 : 1)) as [number, number, number]}
              rotation={inst.rotation}
              castShadow
              receiveShadow
              onPointerDown={canPickProps ? onPropPointerDown(inst.placementId) : undefined}
            >
              <boxGeometry args={inst.dims} />
              <LayeredShaderMaterial spec={inst.materialSpec} uvFaceMappings={[]} />
            </mesh>
          ),
        )}
      </Suspense>
    </group>
  )
}
