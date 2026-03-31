import type { SurfaceUvMapping } from '@shared/types'

/** Duplicate UV entries from `sourceMaterialId` to `targetMaterialId` (same surface + face keys). */
export function copyUvMappingsBetweenMaterials(
  uv: Record<string, SurfaceUvMapping> | null | undefined,
  sourceMaterialId: string,
  targetMaterialId: string,
): Record<string, SurfaceUvMapping> {
  const out: Record<string, SurfaceUvMapping> = {}
  const needle = `|${sourceMaterialId}|`
  for (const [k, v] of Object.entries(uv ?? {})) {
    if (!k.includes(needle)) continue
    const dst = k.replace(`|${sourceMaterialId}|`, `|${targetMaterialId}|`)
    out[dst] = structuredClone(v)
  }
  return out
}
