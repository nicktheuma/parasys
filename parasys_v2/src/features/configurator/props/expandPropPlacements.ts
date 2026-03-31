import type { ConfiguratorPropPlacement, ConfiguratorPropsSettings } from '@shared/types'
import { clampPropUnsigned, densityToFillFraction } from './propSettingsLimits'
import type { ShelfAnchor } from './panelPropAnchors'

const H: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right']
const D: Array<'back' | 'center' | 'front'> = ['back', 'center', 'front']

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

/**
 * Appends auto-generated placements from density + palette after manual placements.
 * Each shelf gets up to 9 slots (3×3 horizontal × depth alignment).
 */
export function expandPropPlacementsForRender(
  propsConfig: ConfiguratorPropsSettings | null | undefined,
  anchors: ShelfAnchor[],
  availablePropIds: string[],
): ConfiguratorPropPlacement[] {
  const manual = propsConfig?.placements ?? []
  const density = densityToFillFraction(propsConfig?.density)
  let palette = propsConfig?.palettePropIds?.filter(Boolean) ?? []
  if (palette.length === 0 && density > 0) {
    palette = [...availablePropIds]
  }
  if (density <= 0 || palette.length === 0) return manual

  type Slot = {
    anchorId: string
    alignX: (typeof H)[number]
    alignZ: (typeof D)[number]
  }
  const slots: Slot[] = []
  for (const a of anchors) {
    for (const hx of H) {
      for (const dz of D) {
        slots.push({ anchorId: a.id, alignX: hx, alignZ: dz })
      }
    }
  }
  if (slots.length === 0) return manual

  const occupied = new Set(
    manual.map((m) => `${m.anchorId}|${m.alignX ?? 'center'}|${m.alignZ ?? 'center'}`),
  )
  const freeSlots = slots.filter((s) => !occupied.has(`${s.anchorId}|${s.alignX}|${s.alignZ}`))
  const candidateSlots = freeSlots.length > 0 ? freeSlots : slots
  const rawAutoSeed = propsConfig?.autoSeed
  const seedFromAuto =
    rawAutoSeed != null && Number.isFinite(rawAutoSeed) && rawAutoSeed > 0
      ? Math.round(clampPropUnsigned(rawAutoSeed) * 1000)
      : 0
  const seed = Math.round(
    seedFromAuto + anchors.length * 97 + palette.length * 37 + Math.floor(density * 1000),
  )
  const rand = makeRng(seed)
  /** Stored 0.0001..10 → legacy 0..2 multiplier */
  const autoScaleJitter = Math.min(2, (clampPropUnsigned(propsConfig?.autoScaleJitter ?? 2.25) / 10) * 2)
  /** Stored 0..10 → 0..1 spawn amplitude */
  let autoSpawnJitterMin = Math.min(1, Math.max(0, (propsConfig?.autoSpawnJitterMin ?? 0) / 10))
  let autoSpawnJitterMax = Math.min(1, Math.max(0, (propsConfig?.autoSpawnJitterMax ?? 3.5) / 10))
  if (autoSpawnJitterMin > autoSpawnJitterMax) {
    const t = autoSpawnJitterMin
    autoSpawnJitterMin = autoSpawnJitterMax
    autoSpawnJitterMax = t
  }
  const shuffledSlots = [...candidateSlots].sort(() => rand() - 0.5)
  const shuffledPalette = [...palette].sort(() => rand() - 0.5)

  const targetCount = Math.max(1, Math.floor(slots.length * density))
  const auto: ConfiguratorPropPlacement[] = []
  for (let i = 0; i < targetCount; i += 1) {
    const slot = shuffledSlots[i % shuffledSlots.length]
    const propId = shuffledPalette[Math.floor(rand() * shuffledPalette.length)]
    const jitter = 1 + (rand() * 2 - 1) * autoScaleJitter * 0.45
    const spawnJitter = autoSpawnJitterMin + (autoSpawnJitterMax - autoSpawnJitterMin) * rand()
    auto.push({
      id: `auto-${i}-${slot.anchorId}-${slot.alignX}-${slot.alignZ}`,
      kind: 'library',
      propLibraryId: propId,
      anchorId: slot.anchorId,
      scaleBias: Math.max(0.2, jitter),
      alignX: slot.alignX,
      alignZ: slot.alignZ,
      offsetX: (rand() * 2 - 1) * spawnJitter,
      offsetZ: (rand() * 2 - 1) * spawnJitter,
    })
  }
  return [...manual, ...auto]
}
