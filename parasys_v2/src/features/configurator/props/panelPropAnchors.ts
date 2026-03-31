import { mmToM } from '@/lib/configuratorDimensions'

/** Horizontal footprint on a shelf (product local space, origin at cabinet center, Y up) */
export type ShelfAnchor = {
  id: string
  label: string
  /** Center of the top face of the shelf board (meters) */
  center: [number, number, number]
  halfWidth: number
  halfDepth: number
  /** Max vertical extent for a prop sitting on this shelf (meters) */
  maxHeight: number
}

const MARGIN = 0.025

/**
 * Shelf layout matches `generatePanelSpecs` in panelSpecs.ts (shelves + 2 boards).
 */
export function computePanelShelfAnchors(args: {
  widthM: number
  heightM: number
  depthM: number
  shelves: number
  materialThickness: number
  edgeOffset: number
  slotOffset: number
}): ShelfAnchor[] {
  const { widthM, heightM, depthM, shelves, materialThickness, edgeOffset, slotOffset } = args
  const shelfCount = shelves + 2
  const verticalInterior = heightM - materialThickness
  const shelfStep = verticalInterior / Math.max(1, shelves + 1)
  const anchors: ShelfAnchor[] = []

  const usableHalfW = Math.max(0.02, widthM / 2 - edgeOffset - MARGIN)
  const usableHalfD = Math.max(0.02, (depthM - slotOffset) / 2 - MARGIN)

  for (let i = 0; i < shelfCount; i += 1) {
    const positionY = verticalInterior / 2 - shelfStep * i
    const yTop = positionY + materialThickness / 2
    const maxH = Math.max(0.05, shelfStep - materialThickness)

    anchors.push({
      id: `shelf:${i}`,
      label: i === 0 ? 'Top shelf' : i === shelfCount - 1 ? 'Bottom shelf' : `Shelf ${i}`,
      center: [0, yTop, 0],
      halfWidth: usableHalfW,
      halfDepth: usableHalfD,
      maxHeight: maxH,
    })
  }

  return anchors
}

export function anchorLabelList(anchors: ShelfAnchor[]): { id: string; label: string }[] {
  return anchors.map((a) => ({ id: a.id, label: a.label }))
}

/** Convert mm presets to meters for anchor helper */
export function panelAnchorsFromDimsMm(
  widthMm: number,
  depthMm: number,
  heightMm: number,
  shelves: number,
  materialThicknessM: number,
  edgeOffset: number,
  slotOffset: number,
): ShelfAnchor[] {
  return computePanelShelfAnchors({
    widthM: mmToM(widthMm),
    heightM: mmToM(heightMm),
    depthM: mmToM(depthMm),
    shelves,
    materialThickness: materialThicknessM,
    edgeOffset,
    slotOffset,
  })
}
