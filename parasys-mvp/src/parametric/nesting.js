const toMillimeters = (meters) => meters * 1000

export const defaultNestingOptions = {
  sheetWidthMm: 2440,
  sheetHeightMm: 1220,
  marginMm: 12,
  spacingMm: 4,
  allowRotate90: true,
}

const fitsInRow = ({ x, width, sheetWidthMm, marginMm }) => (x + width) <= (sheetWidthMm - marginMm)
const fitsInSheet = ({ y, height, sheetHeightMm, marginMm }) => (y + height) <= (sheetHeightMm - marginMm)

const choosePlacementOrientation = ({ panel, cursorX, options }) => {
  const candidates = []

  candidates.push({
    rotate90: false,
    widthMm: panel.widthMm,
    heightMm: panel.heightMm,
  })

  if (options.allowRotate90) {
    candidates.push({
      rotate90: true,
      widthMm: panel.heightMm,
      heightMm: panel.widthMm,
    })
  }

  const fitting = candidates.filter((candidate) =>
    fitsInRow({
      x: cursorX,
      width: candidate.widthMm,
      sheetWidthMm: options.sheetWidthMm,
      marginMm: options.marginMm,
    }),
  )

  if (fitting.length === 0) {
    return candidates[0]
  }

  return fitting.sort((left, right) => {
    if (left.heightMm === right.heightMm) return left.widthMm - right.widthMm
    return left.heightMm - right.heightMm
  })[0]
}

export function nestPanelsRectangular(panelSpecs, overrides = {}) {
  const options = { ...defaultNestingOptions, ...overrides }

  const panels = panelSpecs
    .map((panelSpec) => ({
      id: panelSpec.id,
      kind: panelSpec.kind,
      widthMm: toMillimeters(panelSpec.width),
      heightMm: toMillimeters(panelSpec.height),
      vectorLoops: panelSpec.vectorLoops,
    }))
    .sort((left, right) => Math.max(right.widthMm, right.heightMm) - Math.max(left.widthMm, left.heightMm))

  const placements = []
  let sheetIndex = 0
  let cursorX = options.marginMm
  let cursorY = options.marginMm
  let rowHeight = 0

  panels.forEach((panel) => {
    let orientation = choosePlacementOrientation({ panel, cursorX, options })

    if (!fitsInRow({ x: cursorX, width: orientation.widthMm, sheetWidthMm: options.sheetWidthMm, marginMm: options.marginMm })) {
      cursorX = options.marginMm
      cursorY += rowHeight + options.spacingMm
      rowHeight = 0
      orientation = choosePlacementOrientation({ panel, cursorX, options })
    }

    if (!fitsInSheet({ y: cursorY, height: orientation.heightMm, sheetHeightMm: options.sheetHeightMm, marginMm: options.marginMm })) {
      sheetIndex += 1
      cursorX = options.marginMm
      cursorY = options.marginMm
      rowHeight = 0
      orientation = choosePlacementOrientation({ panel, cursorX, options })
    }

    placements.push({
      ...panel,
      sheetIndex,
      xMm: cursorX,
      yMm: cursorY,
      widthPlacedMm: orientation.widthMm,
      heightPlacedMm: orientation.heightMm,
      rotate90: orientation.rotate90,
    })

    cursorX += orientation.widthMm + options.spacingMm
    rowHeight = Math.max(rowHeight, orientation.heightMm)
  })

  return {
    options,
    sheetCount: placements.reduce((max, placement) => Math.max(max, placement.sheetIndex), 0) + 1,
    placements,
  }
}
