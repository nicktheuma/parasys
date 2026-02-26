const toMillimeters = (meters) => meters * 1000

export const defaultNestingOptions = {
  sheetWidthMm: 2400,
  sheetHeightMm: 1200,
  marginMm: 12,
  spacingMm: 12,
  allowRotate90: true,
}

const fitsInRow = ({ x, width, sheetWidthMm, marginMm }) => (x + width) <= (sheetWidthMm - marginMm)
const fitsInSheet = ({ y, height, sheetHeightMm, marginMm }) => (y + height) <= (sheetHeightMm - marginMm)

const fitsWithinSheetUsableArea = ({ widthMm, heightMm, options }) => {
  const usableWidth = options.sheetWidthMm - (options.marginMm * 2)
  const usableHeight = options.sheetHeightMm - (options.marginMm * 2)
  return widthMm <= usableWidth && heightMm <= usableHeight
}

const buildOrientationCandidates = ({ panel, options }) => {
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

  return candidates
}

const choosePlacementOrientation = ({ panel, cursorX, cursorY, rowHeight, options }) => {
  const candidates = buildOrientationCandidates({ panel, options })

  const sheetFittable = candidates.filter((candidate) =>
    fitsWithinSheetUsableArea({
      widthMm: candidate.widthMm,
      heightMm: candidate.heightMm,
      options,
    }),
  )

  if (sheetFittable.length === 0) return null

  const fitting = sheetFittable.filter((candidate) => {
    const nextRowHeight = Math.max(rowHeight, candidate.heightMm)
    return (
    fitsInRow({
      x: cursorX,
      width: candidate.widthMm,
      sheetWidthMm: options.sheetWidthMm,
      marginMm: options.marginMm,
    }) &&
    fitsInSheet({
      y: cursorY,
      height: nextRowHeight,
      sheetHeightMm: options.sheetHeightMm,
      marginMm: options.marginMm,
    })
    )
  })

  if (fitting.length === 0) {
    return null
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
  const rejectedPanels = []
  let sheetIndex = 0
  let cursorX = options.marginMm
  let cursorY = options.marginMm
  let rowHeight = 0

  panels.forEach((panel) => {
    let orientation = choosePlacementOrientation({ panel, cursorX, cursorY, rowHeight, options })

    if (!orientation) {
      cursorX = options.marginMm
      cursorY += rowHeight + options.spacingMm
      rowHeight = 0
      orientation = choosePlacementOrientation({ panel, cursorX, cursorY, rowHeight, options })
    }

    if (!orientation) {
      sheetIndex += 1
      cursorX = options.marginMm
      cursorY = options.marginMm
      rowHeight = 0
      orientation = choosePlacementOrientation({ panel, cursorX, cursorY, rowHeight, options })
    }

    if (!orientation) {
      rejectedPanels.push({
        id: panel.id,
        kind: panel.kind,
        widthMm: panel.widthMm,
        heightMm: panel.heightMm,
      })
      return
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
    rejectedPanels,
    sheetCount: placements.length > 0
      ? placements.reduce((max, placement) => Math.max(max, placement.sheetIndex), 0) + 1
      : 0,
    placements,
  }
}
