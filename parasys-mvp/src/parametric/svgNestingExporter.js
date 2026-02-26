import { nestPanelsRectangular, defaultNestingOptions } from './nesting'

const roundTo = (value, precision = 3) => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
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
  const sheetGapMm = 40
  const canvasWidth = options.sheetWidthMm
  const canvasHeight = (sheetCount * options.sheetHeightMm) + ((sheetCount - 1) * sheetGapMm)

  const sheetFrames = Array.from({ length: sheetCount }).map((_, index) => {
    const sheetY = index * (options.sheetHeightMm + sheetGapMm)
    return `
      <g>
        <rect x="0" y="${sheetY}" width="${options.sheetWidthMm}" height="${options.sheetHeightMm}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="6 4" />
        <text x="8" y="${sheetY + 20}" fill="#334155" font-size="14" font-family="system-ui, sans-serif">Sheet ${index + 1}</text>
      </g>`
  }).join('\n')

  const placedPaths = placements.map((placement) => {
    const sheetOffsetY = placement.sheetIndex * (options.sheetHeightMm + sheetGapMm)
    const shiftedPlacement = {
      ...placement,
      yMm: placement.yMm + sheetOffsetY,
    }
    const d = buildPlacementPath(shiftedPlacement)
    const labelX = roundTo(shiftedPlacement.xMm + 4)
    const labelY = roundTo(shiftedPlacement.yMm + 16)
    return `
      <g data-panel-id="${placement.id}">
        <path d="${d}" fill="none" stroke="#0f172a" stroke-width="0.25" />
        <text x="${labelX}" y="${labelY}" fill="#1e293b" font-size="9" font-family="system-ui, sans-serif">${placement.id}${placement.rotate90 ? ' (R)' : ''}</text>
      </g>`
  }).join('\n')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}mm" height="${canvasHeight}mm" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <title>Nested Panels</title>
  <desc>Closed-loop nested vector export generated from parametric panel profiles.</desc>
  <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="#ffffff" />
  ${sheetFrames}
  ${placedPaths}
</svg>`

  return {
    svg,
    nesting,
  }
}
