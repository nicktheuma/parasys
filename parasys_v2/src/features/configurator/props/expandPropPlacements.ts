import type { ConfiguratorPropPlacement, ConfiguratorPropsSettings } from '@shared/types'
import type { ShelfAnchor } from './panelPropAnchors'

const H: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right']
const D: Array<'back' | 'center' | 'front'> = ['back', 'center', 'front']

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
  const density = propsConfig?.density ?? 0
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

  const targetCount = Math.max(1, Math.floor(slots.length * density))
  const auto: ConfiguratorPropPlacement[] = []
  for (let i = 0; i < targetCount; i += 1) {
    const slot = slots[i % slots.length]
    const propId = palette[i % palette.length]
    auto.push({
      id: `auto-${i}-${slot.anchorId}-${slot.alignX}-${slot.alignZ}`,
      propLibraryId: propId,
      anchorId: slot.anchorId,
      scaleBias: 1,
      alignX: slot.alignX,
      alignZ: slot.alignZ,
    })
  }
  return [...manual, ...auto]
}
