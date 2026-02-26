import { nestPanelsRectangular, defaultNestingOptions } from './nesting'

const roundTo = (value, precision = 3) => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

const formatMm = (value) => `${roundTo(value, 1)}mm`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const intersectsRect = (left, right) => !(
  right.x >= (left.x + left.width) ||
  (right.x + right.width) <= left.x ||
  right.y >= (left.y + left.height) ||
  (right.y + right.height) <= left.y
)

const estimateTextWidthMm = (text, fontSizeMm) => text.length * fontSizeMm * 0.56

const buildLabelPlacements = ({ placements, fontSizeMm, area, reservedBoxes = [] }) => {
  const padding = Math.max(1.5, fontSizeMm * 0.22)
  const labelHeight = (fontSizeMm * 1.05) + (padding * 2)
  const occupied = [...reservedBoxes]

  return placements.map((placement) => {
    const text = `${placement.id}${placement.rotate90 ? ' (R)' : ''} - ${formatMm(placement.widthPlacedMm)} x ${formatMm(placement.heightPlacedMm)}`
    const labelWidth = estimateTextWidthMm(text, fontSizeMm) + (padding * 2)

    const candidateAnchors = [
      { x: placement.xMm + 2, y: placement.yMm + 2 },
      { x: placement.xMm + placement.widthPlacedMm - labelWidth - 2, y: placement.yMm + 2 },
      { x: placement.xMm + 2, y: placement.yMm + placement.heightPlacedMm - labelHeight - 2 },
      { x: placement.xMm + placement.widthPlacedMm - labelWidth - 2, y: placement.yMm + placement.heightPlacedMm - labelHeight - 2 },
      { x: placement.xMm + 2, y: placement.yMm - labelHeight - 2 },
      { x: placement.xMm + 2, y: placement.yMm + placement.heightPlacedMm + 2 },
    ]

    let chosenBox = null

    for (let index = 0; index < candidateAnchors.length; index += 1) {
      const anchor = candidateAnchors[index]
      const clampedBox = {
        x: clamp(anchor.x, area.minX, area.maxX - labelWidth),
        y: clamp(anchor.y, area.minY, area.maxY - labelHeight),
        width: labelWidth,
        height: labelHeight,
      }

      const collides = occupied.some((box) => intersectsRect(clampedBox, box))
      if (!collides) {
        chosenBox = clampedBox
        break
      }
    }

    if (!chosenBox) {
      chosenBox = {
        x: clamp(placement.xMm + 2, area.minX, area.maxX - labelWidth),
        y: clamp(placement.yMm + 2, area.minY, area.maxY - labelHeight),
        width: labelWidth,
        height: labelHeight,
      }
    }

    occupied.push(chosenBox)

    return {
      placementId: placement.id,
      text,
      box: chosenBox,
      textX: roundTo(chosenBox.x + padding, 3),
      textY: roundTo(chosenBox.y + padding + (fontSizeMm * 0.86), 3),
      fontSizeMm,
      padding,
    }
  })
}

const getRelativeTextSizes = (options) => {
  const base = Math.min(options.sheetWidthMm, options.sheetHeightMm)
  const scale = clamp(base / 1200, 1, 2.2)
  return {
    title: roundTo(18 * scale, 2),
    meta: roundTo(12 * scale, 2),
    part: roundTo(10 * scale, 2),
  }
}

const getSheetPlacementBounds = (sheetPlacements) => {
  if (!sheetPlacements.length) return null

  const minX = Math.min(...sheetPlacements.map((placement) => placement.xMm))
  const minY = Math.min(...sheetPlacements.map((placement) => placement.yMm))
  const maxX = Math.max(...sheetPlacements.map((placement) => placement.xMm + placement.widthPlacedMm))
  const maxY = Math.max(...sheetPlacements.map((placement) => placement.yMm + placement.heightPlacedMm))

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

const getSingleSheetFootprint = ({ placements, options }) => {
  const bounds = getSheetPlacementBounds(placements)
  if (!bounds) return null

  const footprintX = clamp(bounds.minX - options.marginMm, 0, options.sheetWidthMm)
  const footprintY = clamp(bounds.minY - options.marginMm, 0, options.sheetHeightMm)
  const footprintMaxX = clamp(bounds.maxX + options.marginMm, 0, options.sheetWidthMm)
  const footprintMaxY = clamp(bounds.maxY + options.marginMm, 0, options.sheetHeightMm)

  return {
    x: footprintX,
    y: footprintY,
    width: roundTo(Math.max(0, footprintMaxX - footprintX), 2),
    height: roundTo(Math.max(0, footprintMaxY - footprintY), 2),
  }
}

const transformPointToPlacement = ({ point, panelWidthMm, panelHeightMm, placement }) => {
  const xLocal = point[0] * 1000
  const yLocal = point[1] * 1000

  let xRot = xLocal
  let yRot = yLocal
  let mappedWidth = panelWidthMm
  let mappedHeight = panelHeightMm

  if (placement.rotate90) {
    xRot = yLocal
    yRot = -xLocal
    mappedWidth = panelHeightMm
    mappedHeight = panelWidthMm
  }

  const x = placement.xMm + (xRot + (mappedWidth / 2))
  const y = placement.yMm + (mappedHeight - (yRot + (mappedHeight / 2)))
  return [roundTo(x), roundTo(y)]
}

const pathFromLoop = (loop, panelWidthMm, panelHeightMm, placement) => {
  if (!loop || loop.length === 0) return ''
  const transformed = loop.map((point) => transformPointToPlacement({
    point,
    panelWidthMm,
    panelHeightMm,
    placement,
  }))
  const [firstPoint, ...remaining] = transformed
  const commands = [`M ${firstPoint[0]} ${firstPoint[1]}`]
  remaining.forEach((point) => commands.push(`L ${point[0]} ${point[1]}`))
  commands.push('Z')
  return commands.join(' ')
}

const buildPlacementPath = (placement) => {
  const loops = placement.vectorLoops || {}
  const outerLoop = loops.outerLoop || []
  const holeLoops = loops.holeLoops || []
  const panelWidthMm = placement.widthMm
  const panelHeightMm = placement.heightMm

  const outerPath = pathFromLoop(outerLoop, panelWidthMm, panelHeightMm, placement)
  const holePaths = holeLoops
    .map((holeLoop) => pathFromLoop(holeLoop, panelWidthMm, panelHeightMm, placement))
    .filter(Boolean)

  return [outerPath, ...holePaths].filter(Boolean).join(' ')
}

export function buildNestedSvg(panelSpecs, overrides = {}) {
  const nesting = nestPanelsRectangular(panelSpecs, { ...defaultNestingOptions, ...overrides })
  const { options, placements, sheetCount } = nesting
  const textSizes = getRelativeTextSizes(options)
  const pagePadding = Math.max(14, roundTo(textSizes.meta + 4, 2))
  const headerBandHeight = roundTo(textSizes.title + textSizes.meta + 8, 2)

  if (nesting.rejectedPanels.length > 0) {
    const rejectedList = nesting.rejectedPanels
      .map((panel) => `${panel.id} (${roundTo(panel.widthMm, 1)} x ${roundTo(panel.heightMm, 1)} mm)`)
      .join(', ')
    throw new Error(`Some panels do not fit the selected sheet size ${options.sheetWidthMm} x ${options.sheetHeightMm} mm: ${rejectedList}`)
  }

  const singleSheetPlacements = placements.filter((placement) => placement.sheetIndex === 0)
  const singleSheetFootprint = sheetCount === 1
    ? getSingleSheetFootprint({ placements: singleSheetPlacements, options })
    : null

  const compactSingleSheet = (
    sheetCount === 1 &&
    singleSheetFootprint &&
    (singleSheetFootprint.width < options.sheetWidthMm || singleSheetFootprint.height < options.sheetHeightMm)
  )

  if (compactSingleSheet) {
    const sheetWidth = singleSheetFootprint.width
    const sheetHeight = singleSheetFootprint.height
    const sheetOriginX = pagePadding
    const sheetOriginY = pagePadding + headerBandHeight
    const canvasWidth = roundTo(sheetWidth + (pagePadding * 2), 2)
    const canvasHeight = roundTo(sheetHeight + (pagePadding * 2) + headerBandHeight, 2)
    const clipId = 'sheet-clip-0'
    const noteText = `Sheet 1 (${formatMm(sheetWidth)} x ${formatMm(sheetHeight)}) | Max sheet: ${formatMm(options.sheetWidthMm)} x ${formatMm(options.sheetHeightMm)}`
    const noteX = pagePadding
    const noteY = roundTo(pagePadding + textSizes.title, 2)
    const noteBox = {
      x: noteX - 1,
      y: pagePadding - 2,
      width: estimateTextWidthMm(noteText, textSizes.title) + 4,
      height: textSizes.title + 5,
    }
    const area = {
      minX: sheetOriginX,
      minY: sheetOriginY,
      maxX: sheetOriginX + sheetWidth,
      maxY: sheetOriginY + sheetHeight,
    }
    const shiftedPlacements = singleSheetPlacements.map((placement) => ({
      ...placement,
      xMm: roundTo((placement.xMm - singleSheetFootprint.x) + sheetOriginX, 3),
      yMm: roundTo((placement.yMm - singleSheetFootprint.y) + sheetOriginY, 3),
    }))
    const labelPlacements = buildLabelPlacements({
      placements: shiftedPlacements,
      fontSizeMm: textSizes.part,
      area,
      reservedBoxes: [noteBox],
    })
    const labelById = Object.fromEntries(labelPlacements.map((label) => [label.placementId, label]))

    const placedPaths = shiftedPlacements.map((shiftedPlacement) => {
      const d = buildPlacementPath(shiftedPlacement)
      const label = labelById[shiftedPlacement.id]
      return `
        <g data-panel-id="${shiftedPlacement.id}">
          <path d="${d}" fill="none" stroke="#0f172a" stroke-width="0.25" />
          <rect x="${roundTo(label.box.x, 3)}" y="${roundTo(label.box.y, 3)}" width="${roundTo(label.box.width, 3)}" height="${roundTo(label.box.height, 3)}" fill="#ffffff" />
          <text x="${label.textX}" y="${label.textY}" fill="#1e293b" font-size="${label.fontSizeMm}" font-family="system-ui, sans-serif">${label.text}</text>
        </g>`
    }).join('\n')

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}mm" height="${canvasHeight}mm" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <title>Nested Panels</title>
  <desc>Compact single-sheet footprint export generated from parametric panel profiles.</desc>
  <defs>
    <clipPath id="${clipId}"><rect x="${sheetOriginX}" y="${sheetOriginY}" width="${sheetWidth}" height="${sheetHeight}" /></clipPath>
  </defs>
  <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="#ffffff" />
  <rect x="${sheetOriginX}" y="${sheetOriginY}" width="${sheetWidth}" height="${sheetHeight}" fill="none" stroke="#b45309" stroke-width="1.2" />
  <rect x="${noteBox.x}" y="${noteBox.y}" width="${roundTo(noteBox.width, 3)}" height="${roundTo(noteBox.height, 3)}" fill="#ffffff" />
  <text x="${noteX}" y="${noteY}" fill="#92400e" font-size="${textSizes.title}" font-family="system-ui, sans-serif">${noteText}</text>
  <g clip-path="url(#${clipId})">
    ${placedPaths}
  </g>
</svg>`

    return {
      svg,
      nesting,
    }
  }

  const sheetGapMm = 40
  const canvasWidth = roundTo(options.sheetWidthMm + (pagePadding * 2), 2)
  const canvasHeight = roundTo((sheetCount * options.sheetHeightMm) + ((sheetCount - 1) * sheetGapMm) + (pagePadding * 2) + headerBandHeight, 2)
  const sheetOriginX = pagePadding
  const sheetOriginY = pagePadding + headerBandHeight

  const sheetFrames = Array.from({ length: sheetCount }).map((_, index) => {
    const sheetY = sheetOriginY + (index * (options.sheetHeightMm + sheetGapMm))
    const usableX = sheetOriginX + options.marginMm
    const usableY = sheetY + options.marginMm
    const usableWidth = options.sheetWidthMm - (options.marginMm * 2)
    const usableHeight = options.sheetHeightMm - (options.marginMm * 2)
    const sheetTitle = `Sheet ${index + 1} (${formatMm(options.sheetWidthMm)} x ${formatMm(options.sheetHeightMm)})`
    return `
      <g>
        <rect x="${sheetOriginX}" y="${sheetY}" width="${options.sheetWidthMm}" height="${options.sheetHeightMm}" fill="#ffffff" stroke="#1f2937" stroke-width="1.5" />
        <rect x="${usableX}" y="${usableY}" width="${usableWidth}" height="${usableHeight}" fill="none" stroke="#64748b" stroke-width="0.6" stroke-dasharray="4 3" />
        <text x="${sheetOriginX}" y="${roundTo(sheetY - 4, 2)}" fill="#111827" font-size="${textSizes.title}" font-family="system-ui, sans-serif">${sheetTitle}</text>
      </g>`
  }).join('\n')

  const sheetClipDefs = Array.from({ length: sheetCount }).map((_, index) => {
    const sheetY = sheetOriginY + (index * (options.sheetHeightMm + sheetGapMm))
    return `<clipPath id="sheet-clip-${index}"><rect x="${sheetOriginX}" y="${sheetY}" width="${options.sheetWidthMm}" height="${options.sheetHeightMm}" /></clipPath>`
  }).join('\n')

  const placedPaths = Array.from({ length: sheetCount }).map((_, sheetIndex) => {
    const sheetOffsetY = sheetOriginY + (sheetIndex * (options.sheetHeightMm + sheetGapMm))
    const sheetPlacements = placements.filter((placement) => placement.sheetIndex === sheetIndex)
    const shiftedPlacements = sheetPlacements.map((placement) => ({
      ...placement,
      xMm: placement.xMm + sheetOriginX,
      yMm: placement.yMm + sheetOffsetY,
    }))
    const area = {
      minX: sheetOriginX,
      minY: sheetOffsetY,
      maxX: sheetOriginX + options.sheetWidthMm,
      maxY: sheetOffsetY + options.sheetHeightMm,
    }
    const sheetTitleText = `Sheet ${sheetIndex + 1} (${formatMm(options.sheetWidthMm)} x ${formatMm(options.sheetHeightMm)})`
    const sheetTitleBox = {
      x: 6,
      y: sheetOffsetY + 1,
      width: estimateTextWidthMm(sheetTitleText, textSizes.title) + 8,
      height: textSizes.title + 8,
    }
    const labelPlacements = buildLabelPlacements({
      placements: shiftedPlacements,
      fontSizeMm: textSizes.part,
      area,
      reservedBoxes: [sheetTitleBox],
    })
    const labelById = Object.fromEntries(labelPlacements.map((label) => [label.placementId, label]))

    const paths = shiftedPlacements.map((shiftedPlacement) => {
      const d = buildPlacementPath(shiftedPlacement)
      const label = labelById[shiftedPlacement.id]
      return `
        <g data-panel-id="${shiftedPlacement.id}">
          <path d="${d}" fill="none" stroke="#0f172a" stroke-width="0.25" />
          <rect x="${roundTo(label.box.x, 3)}" y="${roundTo(label.box.y, 3)}" width="${roundTo(label.box.width, 3)}" height="${roundTo(label.box.height, 3)}" fill="#ffffff" />
          <text x="${label.textX}" y="${label.textY}" fill="#1e293b" font-size="${label.fontSizeMm}" font-family="system-ui, sans-serif">${label.text}</text>
        </g>`
    }).join('\n')

    return `<g clip-path="url(#sheet-clip-${sheetIndex})">${paths}\n</g>`
  }).join('\n')

  const footprintOverlay = (sheetCount === 1 && singleSheetFootprint)
    ? (() => {
      const noteText = `Required footprint incl. margin: ${formatMm(singleSheetFootprint.width)} x ${formatMm(singleSheetFootprint.height)} | Max sheet: ${formatMm(options.sheetWidthMm)} x ${formatMm(options.sheetHeightMm)}`
      const footprintX = roundTo(singleSheetFootprint.x + sheetOriginX, 2)
      const footprintY = roundTo(singleSheetFootprint.y + sheetOriginY, 2)
      const noteX = roundTo(footprintX + 4)
      const noteY = roundTo(clamp(footprintY - 3, pagePadding + textSizes.meta + 2, sheetOriginY + options.sheetHeightMm - 4))
      return `
        <g>
          <rect x="${footprintX}" y="${footprintY}" width="${singleSheetFootprint.width}" height="${singleSheetFootprint.height}" fill="none" stroke="#b45309" stroke-width="0.8" />
          <text x="${noteX}" y="${noteY}" fill="#92400e" font-size="${textSizes.meta}" font-family="system-ui, sans-serif">${noteText}</text>
        </g>`
    })()
    : ''

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}mm" height="${canvasHeight}mm" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <title>Nested Panels</title>
  <desc>Closed-loop nested vector export generated from parametric panel profiles.</desc>
  <defs>
    ${sheetClipDefs}
  </defs>
  <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="#ffffff" />
  ${sheetFrames}
  ${placedPaths}
  ${footprintOverlay}
</svg>`

  return {
    svg,
    nesting,
  }
}
