const roundTo = (value, precision = 6) => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

const makePanelId = (kind, index) => `${kind}-${String(index).padStart(2, '0')}`

export function generatePanelSpecs({
  width,
  height,
  depth,
  dividers,
  shelves,
  edgeOffset,
  slotOffset,
  materialThickness,
}) {
  const panels = []

  const addPanel = (panel) => {
    panels.push({
      ...panel,
      width: roundTo(panel.width),
      height: roundTo(panel.height),
      thickness: roundTo(panel.thickness),
      center: panel.center.map((value) => roundTo(value)),
      rotation: panel.rotation.map((value) => roundTo(value)),
    })
  }

  addPanel({
    id: makePanelId('back', 0),
    kind: 'back',
    plane: 'XY',
    width,
    height,
    thickness: materialThickness,
    center: [0, 0, -(depth / 2) + (materialThickness / 2)],
    rotation: [0, 0, 0],
    quantity: 1,
    cutouts: [],
  })

  const dividerCount = dividers + 2
  const verticalSpanX = width - materialThickness - (edgeOffset * 2)
  const verticalStep = verticalSpanX / Math.max(1, dividers + 1)
  const verticalHeight = Math.max(0.001, height + (slotOffset * 2) - (materialThickness * 2))
  const verticalDepth = Math.max(0.001, depth - slotOffset)

  for (let index = 0; index < dividerCount; index += 1) {
    const positionX = -(verticalSpanX / 2) + (verticalStep * index)
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

  const shelfCount = shelves + 2
  const verticalInterior = height - materialThickness
  const shelfStep = verticalInterior / Math.max(1, shelves + 1)

  for (let index = 0; index < shelfCount; index += 1) {
    const positionY = (verticalInterior / 2) - (shelfStep * index)
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

  return panels
}
