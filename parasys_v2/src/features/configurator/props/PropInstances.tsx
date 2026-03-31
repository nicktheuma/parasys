import { Suspense, useMemo } from 'react'
import { LayeredShaderMaterial } from '@/features/configurator/LayeredShaderMaterial'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import { mergeTemplateParametricPreset } from '@/features/parametric/mvp1/templateParametricPresets'
import type { ConfiguratorPropPlacement, ConfiguratorPropsSettings } from '@shared/types'
import { defaultMaterialSpec } from '@/lib/defaultMaterialSpec'
import { expandPropPlacementsForRender } from './expandPropPlacements'
import { panelAnchorsFromDimsMm } from './panelPropAnchors'
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
}

const MM = 0.001
/** Slight inset from shelf edges; higher = larger max uniform scale */
const SHELF_MARGIN = 0.998

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

export function PropInstances({
  templateKey,
  widthMm,
  depthMm,
  heightMm,
  templateParamOverrides,
  propsConfig,
  propLibrary,
}: Props) {
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
    const out: Array<{
      key: string
      kind: 'placeholder_cube' | 'glb'
      glbUrl: string | null
      position: [number, number, number]
      scale: number
      dims: [number, number, number]
      materialSpec: MaterialShaderSpec
    }> = []

    for (const pl of placements) {
      const anchor = anchorById.get(pl.anchorId)
      const lib = libById.get(pl.propLibraryId)
      if (!anchor || !lib) continue
      if (lib.kind !== 'placeholder_cube' && lib.kind !== 'glb') continue

      const [dw, dh, dd] = lib.placeholderDimsMm.map((x) => x * MM) as [number, number, number]
      const bias = pl.scaleBias ?? 1
      const sxMax = (anchor.halfWidth * 2) / dw
      const szMax = (anchor.halfDepth * 2) / dd
      const syMax = dh > 1e-9 ? anchor.maxHeight / dh : anchor.maxHeight
      const maxScale = Math.min(sxMax, szMax, syMax)
      const baseScale = maxScale * SHELF_MARGIN
      /* bias scales from a small inset (×1) up to the true shelf fit (capped at maxScale) */
      const scale = Math.max(0.02, Math.min(baseScale * bias, maxScale))

      const halfY = (dh * scale) / 2
      const hw = (dw * scale) / 2
      const hd = (dd * scale) / 2
      const gap = 0.003
      const maxOffsetX = Math.max(0, anchor.halfWidth - hw - gap)
      const maxOffsetZ = Math.max(0, anchor.halfDepth - hd - gap)
      const { ax, az } = alignFactors(pl.alignX, pl.alignZ)

      const pos: [number, number, number] = [
        anchor.center[0] + ax * maxOffsetX,
        anchor.center[1] + halfY,
        anchor.center[2] + az * maxOffsetZ,
      ]

      out.push({
        key: pl.id,
        kind: lib.kind,
        glbUrl: lib.glbUrl,
        position: pos,
        scale,
        dims: [dw, dh, dd],
        materialSpec: resolvePropMaterial(pl, lib),
      })
    }
    return out
  }, [placements, anchorById, libById])

  if (instances.length === 0) return null

  return (
    <group position={[0, heightM / 2, 0]}>
      <Suspense fallback={null}>
        {instances.map((inst) =>
          inst.kind === 'glb' && inst.glbUrl ? (
            <PropGlbMesh
              key={inst.key}
              url={inst.glbUrl}
              scale={inst.scale}
              position={inst.position}
              materialSpec={inst.materialSpec}
            />
          ) : (
            <mesh key={inst.key} position={inst.position} castShadow receiveShadow>
              <boxGeometry
                args={[inst.dims[0] * inst.scale, inst.dims[1] * inst.scale, inst.dims[2] * inst.scale]}
              />
              <LayeredShaderMaterial spec={inst.materialSpec} uvFaceMappings={[]} />
            </mesh>
          ),
        )}
      </Suspense>
    </group>
  )
}
