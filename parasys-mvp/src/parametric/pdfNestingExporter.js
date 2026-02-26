import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { nestPanelsRectangular, defaultNestingOptions } from './nesting'

const mmToPt = (millimeters) => (millimeters * 72) / 25.4

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
  return [x, yTopDown]
}

const drawLoop = ({ page, loop, placement, panelWidthMm, panelHeightMm, sheetHeightMm }) => {
  if (!Array.isArray(loop) || loop.length < 2) return

  const pointsMm = loop.map((point) => transformPointToPlacement({
    point,
    panelWidthMm,
    panelHeightMm,
    placement,
  }))

  for (let index = 1; index < pointsMm.length; index += 1) {
    const previous = pointsMm[index - 1]
    const current = pointsMm[index]
    page.drawLine({
      start: { x: mmToPt(previous[0]), y: mmToPt(sheetHeightMm - previous[1]) },
      end: { x: mmToPt(current[0]), y: mmToPt(sheetHeightMm - current[1]) },
      thickness: 0.35,
      color: rgb(0.06, 0.09, 0.16),
    })
  }
}

export async function buildNestedPdfBytes(panelSpecs, overrides = {}) {
  const nesting = nestPanelsRectangular(panelSpecs, { ...defaultNestingOptions, ...overrides })
  const { options, placements, sheetCount } = nesting

  const pdfDocument = await PDFDocument.create()
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica)

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const page = pdfDocument.addPage([mmToPt(options.sheetWidthMm), mmToPt(options.sheetHeightMm)])

    page.drawRectangle({
      x: 0,
      y: 0,
      width: mmToPt(options.sheetWidthMm),
      height: mmToPt(options.sheetHeightMm),
      borderWidth: 0.5,
      borderColor: rgb(0.58, 0.64, 0.72),
    })

    page.drawText(`Sheet ${sheetIndex + 1}`, {
      x: mmToPt(8),
      y: mmToPt(options.sheetHeightMm - 10),
      size: 10,
      font,
      color: rgb(0.2, 0.25, 0.31),
    })

    const sheetPlacements = placements.filter((placement) => placement.sheetIndex === sheetIndex)

    sheetPlacements.forEach((placement) => {
      const loops = placement.vectorLoops || {}
      const panelWidthMm = placement.widthMm
      const panelHeightMm = placement.heightMm

      drawLoop({
        page,
        loop: loops.outerLoop || [],
        placement,
        panelWidthMm,
        panelHeightMm,
        sheetHeightMm: options.sheetHeightMm,
      })

      ;(loops.holeLoops || []).forEach((holeLoop) => {
        drawLoop({
          page,
          loop: holeLoop,
          placement,
          panelWidthMm,
          panelHeightMm,
          sheetHeightMm: options.sheetHeightMm,
        })
      })

      page.drawText(`${placement.id}${placement.rotate90 ? ' (R)' : ''}`, {
        x: mmToPt(placement.xMm + 4),
        y: mmToPt(options.sheetHeightMm - (placement.yMm + 8)),
        size: 8,
        font,
        color: rgb(0.12, 0.16, 0.23),
      })
    })
  }

  const pdfBytes = await pdfDocument.save()
  return {
    pdfBytes,
    nesting,
  }
}
