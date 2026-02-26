import { nestPanelsRectangular, defaultNestingOptions } from './nesting'

const toMillimeters = (meters) => meters * 1000
const roundTo = (value, precision = 3) => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

const DEFAULT_DXF_LAYERS = {
  sheet: 'SHEET',
  usable: 'USABLE',
  cutOuter: 'CUT_OUTER',
  cutHoles: 'CUT_HOLES',
  annotations: 'ANNOTATIONS',
}

const resolveDxfLayers = (overrides = {}) => ({
  ...DEFAULT_DXF_LAYERS,
  ...(overrides.dxfLayers || {}),
})

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
  const yTopDown = placement.yMm + (mappedHeight - (yRot + (mappedHeight / 2)))
  return [roundTo(x), roundTo(yTopDown)]
}

const encodeText = (value) => String(value).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()

const buildPolylineEntity = ({ layer, points, closed = true }) => {
  if (!Array.isArray(points) || points.length < 2) return ''

  const lines = [
    '0', 'LWPOLYLINE',
    '8', layer,
    '90', String(points.length),
    '70', closed ? '1' : '0',
  ]

  points.forEach((point) => {
    lines.push('10', String(roundTo(point[0], 4)))
    lines.push('20', String(roundTo(point[1], 4)))
  })

  return `${lines.join('\n')}\n`
}

const buildTextEntity = ({ layer, x, y, height, text }) => {
  return [
    '0', 'TEXT',
    '8', layer,
    '10', String(roundTo(x, 4)),
    '20', String(roundTo(y, 4)),
    '30', '0',
    '40', String(roundTo(height, 4)),
    '1', encodeText(text),
    '7', 'STANDARD',
    '50', '0',
  ].join('\n') + '\n'
}

export function buildNestedDxf(panelSpecs, overrides = {}) {
  const nesting = nestPanelsRectangular(panelSpecs, { ...defaultNestingOptions, ...overrides })
  const { options, placements, sheetCount } = nesting
  const layers = resolveDxfLayers(overrides)
  const sheetLabelTextHeight = overrides.dxfSheetLabelTextHeight ?? 8
  const panelLabelTextHeight = overrides.dxfPanelLabelTextHeight ?? 5

  if (nesting.rejectedPanels.length > 0) {
    const rejectedList = nesting.rejectedPanels
      .map((panel) => `${panel.id} (${roundTo(panel.widthMm, 1)} x ${roundTo(panel.heightMm, 1)} mm)`)
      .join(', ')
    throw new Error(`Some panels do not fit the selected sheet size ${options.sheetWidthMm} x ${options.sheetHeightMm} mm: ${rejectedList}`)
  }

  const sheetGapMm = 100
  let entities = ''

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const sheetBaseY = sheetIndex * (options.sheetHeightMm + sheetGapMm)
    const sheetTopY = sheetBaseY + options.sheetHeightMm

    const sheetOutline = [
      [0, sheetBaseY],
      [options.sheetWidthMm, sheetBaseY],
      [options.sheetWidthMm, sheetTopY],
      [0, sheetTopY],
    ]
    entities += buildPolylineEntity({ layer: layers.sheet, points: sheetOutline, closed: true })

    const usableOutline = [
      [options.marginMm, sheetBaseY + options.marginMm],
      [options.sheetWidthMm - options.marginMm, sheetBaseY + options.marginMm],
      [options.sheetWidthMm - options.marginMm, sheetTopY - options.marginMm],
      [options.marginMm, sheetTopY - options.marginMm],
    ]
    entities += buildPolylineEntity({ layer: layers.usable, points: usableOutline, closed: true })

    entities += buildTextEntity({
      layer: layers.annotations,
      x: 6,
      y: sheetTopY + 20,
      height: sheetLabelTextHeight,
      text: `Sheet ${sheetIndex + 1} (${roundTo(options.sheetWidthMm, 1)} x ${roundTo(options.sheetHeightMm, 1)} mm)`,
    })

    const sheetPlacements = placements.filter((placement) => placement.sheetIndex === sheetIndex)
    sheetPlacements.forEach((placement) => {
      const loops = placement.vectorLoops || {}
      const panelWidthMm = toMillimeters(placement.widthMm / 1000)
      const panelHeightMm = toMillimeters(placement.heightMm / 1000)

      const emitLoop = (loop, layerName) => {
        if (!Array.isArray(loop) || loop.length < 2) return

        const points = loop.map((point) => {
          const [xMm, yTopDownMm] = transformPointToPlacement({
            point,
            panelWidthMm,
            panelHeightMm,
            placement,
          })

          const yDxf = sheetBaseY + (options.sheetHeightMm - yTopDownMm)
          return [xMm, roundTo(yDxf, 4)]
        })

        entities += buildPolylineEntity({ layer: layerName, points, closed: true })
      }

      emitLoop(loops.outerLoop || [], layers.cutOuter)
      ;(loops.holeLoops || []).forEach((holeLoop) => emitLoop(holeLoop, layers.cutHoles))

      const labelX = placement.xMm + 4
      const labelYTopDown = placement.yMm + 8
      const labelY = sheetBaseY + (options.sheetHeightMm - labelYTopDown)
      const dimText = `${roundTo(placement.widthPlacedMm, 1)} x ${roundTo(placement.heightPlacedMm, 1)} mm`

      entities += buildTextEntity({
        layer: layers.annotations,
        x: labelX,
        y: labelY,
        height: panelLabelTextHeight,
        text: `${placement.id}${placement.rotate90 ? ' (R)' : ''} - ${dimText}`,
      })
    })
  }

  const dxf = [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS',
    '70', '4',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
    entities.trimEnd(),
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n')

  return {
    dxf,
    nesting,
  }
}
