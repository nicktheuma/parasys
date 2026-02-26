const toMillimeters = (meters) => meters * 1000

export const defaultNestingOptions = {
  sheetWidthMm: 2400,
  sheetHeightMm: 1200,
  marginMm: 12,
  spacingMm: 12,
  allowRotate90: true,
}

const fitsInRect = ({ widthMm, heightMm, rect }) => widthMm <= rect.width && heightMm <= rect.height

const fitsWithinSheetUsableArea = ({ widthMm, heightMm, options }) => {
  const usableWidth = options.sheetWidthMm - (options.marginMm * 2)
  const usableHeight = options.sheetHeightMm - (options.marginMm * 2)
  return widthMm <= usableWidth && heightMm <= usableHeight
}

const intersectsRect = (left, right) => !(
  right.x >= (left.x + left.width) ||
  (right.x + right.width) <= left.x ||
  right.y >= (left.y + left.height) ||
  (right.y + right.height) <= left.y
)

const containsRect = (outer, inner) => (
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  (inner.x + inner.width) <= (outer.x + outer.width) &&
  (inner.y + inner.height) <= (outer.y + outer.height)
)

const splitFreeRect = (freeRect, usedRect) => {
  if (!intersectsRect(freeRect, usedRect)) return [freeRect]

  const fragments = []
  const freeRight = freeRect.x + freeRect.width
  const freeBottom = freeRect.y + freeRect.height
  const usedRight = usedRect.x + usedRect.width
  const usedBottom = usedRect.y + usedRect.height

  if (usedRect.x > freeRect.x) {
    fragments.push({
      x: freeRect.x,
      y: freeRect.y,
      width: usedRect.x - freeRect.x,
      height: freeRect.height,
    })
  }

  if (usedRight < freeRight) {
    fragments.push({
      x: usedRight,
      y: freeRect.y,
      width: freeRight - usedRight,
      height: freeRect.height,
    })
  }

  if (usedRect.y > freeRect.y) {
    fragments.push({
      x: freeRect.x,
      y: freeRect.y,
      width: freeRect.width,
      height: usedRect.y - freeRect.y,
    })
  }

  if (usedBottom < freeBottom) {
    fragments.push({
      x: freeRect.x,
      y: usedBottom,
      width: freeRect.width,
      height: freeBottom - usedBottom,
    })
  }

  return fragments.filter((rect) => rect.width > 0 && rect.height > 0)
}

const pruneContainedFreeRects = (rects) => rects.filter((rect, index) => (
  !rects.some((otherRect, otherIndex) => otherIndex !== index && containsRect(otherRect, rect))
))

const buildInitialSheet = (options) => ({
  freeRects: [
    {
      x: options.marginMm,
      y: options.marginMm,
      width: options.sheetWidthMm - (options.marginMm * 2),
      height: options.sheetHeightMm - (options.marginMm * 2),
    },
  ],
})

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

const chooseBestFreeRectPlacement = ({ sheet, panel, options }) => {
  const spacingMm = Math.max(0, options.spacingMm || 0)
  const orientationCandidates = buildOrientationCandidates({ panel, options }).filter((candidate) =>
    fitsWithinSheetUsableArea({
      widthMm: candidate.widthMm,
      heightMm: candidate.heightMm,
      options,
    }),
  )

  if (orientationCandidates.length === 0) return null

  let bestPlacement = null

  sheet.freeRects.forEach((rect) => {
    orientationCandidates.forEach((candidate) => {
      const occupiedWidth = candidate.widthMm + spacingMm
      const occupiedHeight = candidate.heightMm + spacingMm

      if (!fitsInRect({ widthMm: occupiedWidth, heightMm: occupiedHeight, rect })) {
        return
      }

      const wasteX = rect.width - occupiedWidth
      const wasteY = rect.height - occupiedHeight
      const shortSideFit = Math.min(wasteX, wasteY)
      const longSideFit = Math.max(wasteX, wasteY)

      if (
        !bestPlacement ||
        shortSideFit < bestPlacement.shortSideFit ||
        (shortSideFit === bestPlacement.shortSideFit && longSideFit < bestPlacement.longSideFit)
      ) {
        bestPlacement = {
          xMm: rect.x,
          yMm: rect.y,
          widthPlacedMm: candidate.widthMm,
          heightPlacedMm: candidate.heightMm,
          rotate90: candidate.rotate90,
          occupiedRect: {
            x: rect.x,
            y: rect.y,
            width: occupiedWidth,
            height: occupiedHeight,
          },
          shortSideFit,
          longSideFit,
        }
      }
    })
  })

  return bestPlacement
}

const applyPlacementToSheet = ({ sheet, placement }) => {
  const nextFreeRects = []

  sheet.freeRects.forEach((freeRect) => {
    nextFreeRects.push(...splitFreeRect(freeRect, placement.occupiedRect))
  })

  sheet.freeRects = pruneContainedFreeRects(nextFreeRects)
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
  const sheets = []

  panels.forEach((panel) => {
    let placedSheetIndex = -1
    let bestPlacement = null

    for (let index = 0; index < sheets.length; index += 1) {
      const candidatePlacement = chooseBestFreeRectPlacement({
        sheet: sheets[index],
        panel,
        options,
      })

      if (candidatePlacement) {
        placedSheetIndex = index
        bestPlacement = candidatePlacement
        break
      }
    }

    if (!bestPlacement) {
      const newSheet = buildInitialSheet(options)
      sheets.push(newSheet)
      const candidatePlacement = chooseBestFreeRectPlacement({ sheet: newSheet, panel, options })
      if (candidatePlacement) {
        placedSheetIndex = sheets.length - 1
        bestPlacement = candidatePlacement
      }
    }

    if (!bestPlacement || placedSheetIndex < 0) {
      rejectedPanels.push({
        id: panel.id,
        kind: panel.kind,
        widthMm: panel.widthMm,
        heightMm: panel.heightMm,
      })
      return
    }

    applyPlacementToSheet({
      sheet: sheets[placedSheetIndex],
      placement: bestPlacement,
    })

    placements.push({
      ...panel,
      sheetIndex: placedSheetIndex,
      xMm: bestPlacement.xMm,
      yMm: bestPlacement.yMm,
      widthPlacedMm: bestPlacement.widthPlacedMm,
      heightPlacedMm: bestPlacement.heightPlacedMm,
      rotate90: bestPlacement.rotate90,
    })
  })

  return {
    options,
    rejectedPanels,
    sheetCount: sheets.length,
    placements,
  }
}
