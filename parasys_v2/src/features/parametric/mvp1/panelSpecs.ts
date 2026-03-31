export type PanelPlane = 'XY' | 'YZ' | 'XZ'
export type PanelKind = 'back' | 'vertical' | 'shelf'

export type PanelCutout = {
  centerX: number
  centerY: number
  width: number
  height: number
}

export type PanelSpec = {
  id: string
  kind: PanelKind
  plane: PanelPlane
  width: number
  height: number
  thickness: number
  center: [number, number, number]
  rotation: [number, number, number]
  quantity: number
  cutouts: PanelCutout[]
}

const roundTo = (value: number, precision = 6): number => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

const makePanelId = (kind: PanelKind, index: number): string => `${kind}-${String(index).padStart(2, '0')}`

export function generatePanelSpecs(input: {
  width: number
  height: number
  depth: number
  dividers: number
  shelves: number
  showBackPanel?: boolean
  showVerticalPanels?: boolean
  showShelfPanels?: boolean
  edgeOffset: number
  slotOffset: number
  materialThickness: number
}): PanelSpec[] {
  const {
    width,
    height,
    depth,
    dividers,
    shelves,
    showBackPanel = true,
    showVerticalPanels = true,
    showShelfPanels = true,
    edgeOffset,
    slotOffset,
    materialThickness,
  } = input
  const panels: PanelSpec[] = []

  const addPanel = (panel: PanelSpec) => {
    panels.push({
      ...panel,
      width: roundTo(panel.width),
      height: roundTo(panel.height),
      thickness: roundTo(panel.thickness),
      center: panel.center.map((value) => roundTo(value)) as [number, number, number],
      rotation: panel.rotation.map((value) => roundTo(value)) as [number, number, number],
    })
  }

  if (showBackPanel) {
    addPanel({
      id: makePanelId('back', 0),
      kind: 'back',
      plane: 'XY',
      width,
      height,
      thickness: materialThickness,
      center: [0, 0, -(depth / 2) + materialThickness / 2],
      rotation: [0, 0, 0],
      quantity: 1,
      cutouts: [],
    })
  }

  const dividerCount = Math.max(2, Math.round(dividers))
  const verticalSpanX = width - materialThickness - edgeOffset * 2
  const verticalStep = dividerCount > 1 ? verticalSpanX / (dividerCount - 1) : 0
  const verticalHeight = Math.max(0.001, height + slotOffset * 2 - materialThickness * 2)
  const verticalDepth = Math.max(0.001, depth - slotOffset)

  if (showVerticalPanels) {
    for (let index = 0; index < dividerCount; index += 1) {
      const positionX = -(verticalSpanX / 2) + verticalStep * index
      addPanel({
        id: makePanelId('vertical', index),
        kind: 'vertical',
        plane: 'YZ',
        width: verticalDepth,
        height: verticalHeight,
        thickness: materialThickness,
        center: [positionX, 0, -(slotOffset / 2)],
        rotation: [0, -Math.PI / 2, 0],
        quantity: 1,
        cutouts: [],
      })
    }
  }

  const shelfCount = shelves + 2
  const verticalInterior = height - materialThickness
  const shelfStep = verticalInterior / Math.max(1, shelves + 1)

  if (showShelfPanels) {
    for (let index = 0; index < shelfCount; index += 1) {
      const positionY = verticalInterior / 2 - shelfStep * index
      addPanel({
        id: makePanelId('shelf', index),
        kind: 'shelf',
        plane: 'XZ',
        width,
        height: depth,
        thickness: materialThickness,
        center: [0, positionY, 0],
        rotation: [Math.PI / 2, 0, 0],
        quantity: 1,
        cutouts: [],
      })
    }
  }

  return panels
}
