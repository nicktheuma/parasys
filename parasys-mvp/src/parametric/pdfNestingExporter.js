import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { nestPanelsRectangular, defaultNestingOptions } from './nesting'

const mmToPt = (millimeters) => (millimeters * 72) / 25.4
const formatMm = (value) => `${value.toFixed(1)}mm`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const PDF_PAGE_SIZES_MM = {
  A4: { widthMm: 210, heightMm: 297 },
  A3: { widthMm: 297, heightMm: 420 },
}
const intersectsRect = (left, right) => !(
  right.x >= (left.x + left.width) ||
  (right.x + right.width) <= left.x ||
  right.y >= (left.y + left.height) ||
  (right.y + right.height) <= left.y
)

const estimateTextWidthMm = (text, fontSizeMm) => text.length * fontSizeMm * 0.56

const normalizePdfPageFormat = (value) => {
  const normalized = String(value || 'SHEET').trim().toUpperCase()
  if (normalized === 'A4' || normalized === 'A3') return normalized
  return 'SHEET'
}

const drawTopDownLine = ({ page, pageHeightMm, startX, startY, endX, endY, thickness = 0.35, color = rgb(0.06, 0.09, 0.16) }) => {
  page.drawLine({
    start: { x: mmToPt(startX), y: mmToPt(pageHeightMm - startY) },
    end: { x: mmToPt(endX), y: mmToPt(pageHeightMm - endY) },
    thickness,
    color,
  })
}

const drawTopDownRect = ({ page, pageHeightMm, x, y, width, height, borderWidth = 0.5, borderColor = rgb(0.39, 0.45, 0.53), color }) => {
  page.drawRectangle({
    x: mmToPt(x),
    y: mmToPt(pageHeightMm - (y + height)),
    width: mmToPt(width),
    height: mmToPt(height),
    borderWidth,
    borderColor,
    color,
  })
}

const buildLabelPlacements = ({ placements, fontSizeMm, area, reservedBoxes = [] }) => {
  const padding = Math.max(1.5, fontSizeMm * 0.22)
  const labelHeight = (fontSizeMm * 1.05) + (padding * 2)
  const occupied = [...reservedBoxes]

  return placements.map((placement) => {
    const labelWidthMm = placement.labelWidthMm ?? placement.widthPlacedMm
    const labelHeightMm = placement.labelHeightMm ?? placement.heightPlacedMm
    const text = `${placement.id}${placement.rotate90 ? ' (R)' : ''} - ${formatMm(labelWidthMm)} x ${formatMm(labelHeightMm)}`
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
      textX: chosenBox.x + padding,
      textYTopDown: chosenBox.y + padding + (fontSizeMm * 0.86),
      fontSizeMm,
    }
  })
}

const getRelativeTextSizesMm = (options) => {
  const base = Math.min(options.sheetWidthMm, options.sheetHeightMm)
  const scale = clamp(base / 1200, 1, 2.2)
  return {
    title: 6.5 * scale,
    meta: 4.5 * scale,
    part: 4.2 * scale,
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
    width: Math.max(0, footprintMaxX - footprintX),
    height: Math.max(0, footprintMaxY - footprintY),
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

const drawLoopTiled = ({
  page,
  loop,
  placement,
  panelWidthMm,
  panelHeightMm,
  pageHeightMm,
  tileX,
  tileY,
  contentOriginX,
  contentOriginY,
}) => {
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
    const startX = contentOriginX + (previous[0] - tileX)
    const startY = contentOriginY + (previous[1] - tileY)
    const endX = contentOriginX + (current[0] - tileX)
    const endY = contentOriginY + (current[1] - tileY)

    drawTopDownLine({
      page,
      pageHeightMm,
      startX,
      startY,
      endX,
      endY,
      thickness: 0.35,
      color: rgb(0.06, 0.09, 0.16),
    })
  }
}

const drawLoopScaled = ({
  page,
  loop,
  placement,
  panelWidthMm,
  panelHeightMm,
  pageHeightMm,
  scale,
  contentOriginX,
  contentOriginY,
}) => {
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
    const startX = contentOriginX + (previous[0] * scale)
    const startY = contentOriginY + (previous[1] * scale)
    const endX = contentOriginX + (current[0] * scale)
    const endY = contentOriginY + (current[1] * scale)

    drawTopDownLine({
      page,
      pageHeightMm,
      startX,
      startY,
      endX,
      endY,
      thickness: 0.3,
      color: rgb(0.06, 0.09, 0.16),
    })
  }
}

const choosePaperPageSize = ({ format, sheetWidthMm, sheetHeightMm, pagePaddingMm, headerBandHeightMm }) => {
  const base = PDF_PAGE_SIZES_MM[format]
  const candidates = [
    { widthMm: base.widthMm, heightMm: base.heightMm },
    { widthMm: base.heightMm, heightMm: base.widthMm },
  ]

  let best = null

  candidates.forEach((candidate) => {
    const contentWidth = candidate.widthMm - (pagePaddingMm * 2)
    const contentHeight = candidate.heightMm - ((pagePaddingMm * 2) + headerBandHeightMm)
    if (contentWidth <= 0 || contentHeight <= 0) return

    const scale = Math.min(contentWidth / sheetWidthMm, contentHeight / sheetHeightMm)
    const score = scale

    if (!best || score > best.score) {
      best = {
        ...candidate,
        contentWidth,
        contentHeight,
        scale,
        score,
      }
    }
  })

  return best
}

export async function buildNestedPdfBytes(panelSpecs, overrides = {}) {
  const nesting = nestPanelsRectangular(panelSpecs, { ...defaultNestingOptions, ...overrides })
  const { options, placements, sheetCount } = nesting
  const pdfPageFormat = normalizePdfPageFormat(overrides.pdfPageFormat)
  const textSizes = getRelativeTextSizesMm(options)
  const pagePadding = Math.max(14, textSizes.meta + 4)
  const headerBandHeight = textSizes.title + textSizes.meta + 8

  if (nesting.rejectedPanels.length > 0) {
    const rejectedList = nesting.rejectedPanels
      .map((panel) => `${panel.id} (${panel.widthMm.toFixed(1)} x ${panel.heightMm.toFixed(1)} mm)`)
      .join(', ')
    throw new Error(`Some panels do not fit the selected sheet size ${options.sheetWidthMm} x ${options.sheetHeightMm} mm: ${rejectedList}`)
  }

  const pdfDocument = await PDFDocument.create()
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica)

  if (pdfPageFormat === 'A4' || pdfPageFormat === 'A3') {
    const paperSize = PDF_PAGE_SIZES_MM[pdfPageFormat]
    const paperTextSizes = getRelativeTextSizesMm({
      sheetWidthMm: paperSize.widthMm,
      sheetHeightMm: paperSize.heightMm,
    })
    const paperPadding = Math.max(8, paperTextSizes.meta + 3)
    const paperHeaderBand = paperTextSizes.title + paperTextSizes.meta + 6

    for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
      const sheetPlacements = placements.filter((placement) => placement.sheetIndex === sheetIndex)
      const pagePlan = choosePaperPageSize({
        format: pdfPageFormat,
        sheetWidthMm: options.sheetWidthMm,
        sheetHeightMm: options.sheetHeightMm,
        pagePaddingMm: paperPadding,
        headerBandHeightMm: paperHeaderBand,
      })

      if (!pagePlan) {
        throw new Error(`Selected paper format ${pdfPageFormat} does not have enough drawable area.`)
      }

      const page = pdfDocument.addPage([mmToPt(pagePlan.widthMm), mmToPt(pagePlan.heightMm)])
      const scale = pagePlan.scale
      const scaledSheetWidth = options.sheetWidthMm * scale
      const scaledSheetHeight = options.sheetHeightMm * scale
      const contentOriginX = paperPadding + ((pagePlan.contentWidth - scaledSheetWidth) / 2)
      const contentOriginY = paperPadding + paperHeaderBand + ((pagePlan.contentHeight - scaledSheetHeight) / 2)
      const noteText = `${pdfPageFormat} scaled ${(scale * 100).toFixed(1)}% | Sheet ${sheetIndex + 1} (${formatMm(options.sheetWidthMm)} x ${formatMm(options.sheetHeightMm)})`

      drawTopDownRect({
        page,
        pageHeightMm: pagePlan.heightMm,
        x: contentOriginX,
        y: contentOriginY,
        width: scaledSheetWidth,
        height: scaledSheetHeight,
        borderWidth: 0.8,
        borderColor: rgb(0.12, 0.16, 0.23),
      })

      drawTopDownRect({
        page,
        pageHeightMm: pagePlan.heightMm,
        x: contentOriginX + (options.marginMm * scale),
        y: contentOriginY + (options.marginMm * scale),
        width: (options.sheetWidthMm - (options.marginMm * 2)) * scale,
        height: (options.sheetHeightMm - (options.marginMm * 2)) * scale,
        borderWidth: 0.4,
        borderColor: rgb(0.39, 0.45, 0.53),
      })

      page.drawText(noteText, {
        x: mmToPt(paperPadding),
        y: mmToPt(pagePlan.heightMm - (paperPadding + paperTextSizes.title)),
        size: mmToPt(paperTextSizes.title),
        font,
        color: rgb(0.2, 0.25, 0.31),
      })

      const scaledPlacements = sheetPlacements.map((placement) => ({
        ...placement,
        xMm: contentOriginX + (placement.xMm * scale),
        yMm: contentOriginY + (placement.yMm * scale),
        widthPlacedMm: placement.widthPlacedMm * scale,
        heightPlacedMm: placement.heightPlacedMm * scale,
        labelWidthMm: placement.widthPlacedMm,
        labelHeightMm: placement.heightPlacedMm,
      }))

      const labelPlacements = buildLabelPlacements({
        placements: scaledPlacements,
        fontSizeMm: Math.max(2.2, paperTextSizes.part),
        area: {
          minX: contentOriginX,
          minY: contentOriginY,
          maxX: contentOriginX + scaledSheetWidth,
          maxY: contentOriginY + scaledSheetHeight,
        },
        reservedBoxes: [{
          x: paperPadding - 1,
          y: paperPadding - 2,
          width: estimateTextWidthMm(noteText, paperTextSizes.title) + 6,
          height: paperTextSizes.title + 8,
        }],
      })
      const labelById = Object.fromEntries(labelPlacements.map((label) => [label.placementId, label]))

      sheetPlacements.forEach((placement) => {
        const loops = placement.vectorLoops || {}
        const panelWidthMm = placement.widthMm
        const panelHeightMm = placement.heightMm

        drawLoopScaled({
          page,
          loop: loops.outerLoop || [],
          placement,
          panelWidthMm,
          panelHeightMm,
          pageHeightMm: pagePlan.heightMm,
          scale,
          contentOriginX,
          contentOriginY,
        })

        ;(loops.holeLoops || []).forEach((holeLoop) => {
          drawLoopScaled({
            page,
            loop: holeLoop,
            placement,
            panelWidthMm,
            panelHeightMm,
            pageHeightMm: pagePlan.heightMm,
            scale,
            contentOriginX,
            contentOriginY,
          })
        })

        const label = labelById[placement.id]
        if (!label) return

        drawTopDownRect({
          page,
          pageHeightMm: pagePlan.heightMm,
          x: label.box.x,
          y: label.box.y,
          width: label.box.width,
          height: label.box.height,
          borderWidth: 0,
          color: rgb(1, 1, 1),
        })

        page.drawText(label.text, {
          x: mmToPt(label.textX),
          y: mmToPt(pagePlan.heightMm - label.textYTopDown),
          size: mmToPt(label.fontSizeMm),
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
    const sheetOriginYTopDown = pagePadding + headerBandHeight
    const pageWidth = sheetWidth + (pagePadding * 2)
    const pageHeight = sheetHeight + (pagePadding * 2) + headerBandHeight
    const page = pdfDocument.addPage([mmToPt(pageWidth), mmToPt(pageHeight)])
    const noteText = `Sheet 1 (${formatMm(sheetWidth)} x ${formatMm(sheetHeight)}) | Max sheet: ${formatMm(options.sheetWidthMm)} x ${formatMm(options.sheetHeightMm)}`
    const noteBox = {
      x: pagePadding - 1,
      y: pagePadding - 2,
      width: estimateTextWidthMm(noteText, textSizes.title) + 4,
      height: textSizes.title + 5,
    }
    const shiftedPlacements = singleSheetPlacements.map((placement) => ({
      ...placement,
      xMm: (placement.xMm - singleSheetFootprint.x) + sheetOriginX,
      yMm: (placement.yMm - singleSheetFootprint.y) + sheetOriginYTopDown,
    }))
    const labelPlacements = buildLabelPlacements({
      placements: shiftedPlacements,
      fontSizeMm: textSizes.part,
      area: {
        minX: sheetOriginX,
        minY: sheetOriginYTopDown,
        maxX: sheetOriginX + sheetWidth,
        maxY: sheetOriginYTopDown + sheetHeight,
      },
      reservedBoxes: [noteBox],
    })
    const labelById = Object.fromEntries(labelPlacements.map((label) => [label.placementId, label]))

    page.drawRectangle({
      x: mmToPt(sheetOriginX),
      y: mmToPt(pageHeight - (sheetOriginYTopDown + sheetHeight)),
      width: mmToPt(sheetWidth),
      height: mmToPt(sheetHeight),
      borderWidth: 1,
      borderColor: rgb(0.71, 0.33, 0.03),
    })

    page.drawRectangle({
      x: mmToPt(noteBox.x),
      y: mmToPt(pageHeight - (noteBox.y + noteBox.height)),
      width: mmToPt(noteBox.width),
      height: mmToPt(noteBox.height),
      color: rgb(1, 1, 1),
    })

    page.drawText(noteText, {
      x: mmToPt(pagePadding),
      y: mmToPt(pageHeight - (pagePadding + textSizes.title)),
      size: mmToPt(textSizes.title),
      font,
      color: rgb(0.57, 0.25, 0.0),
    })

    shiftedPlacements.forEach((shiftedPlacement) => {
      const loops = shiftedPlacement.vectorLoops || {}
      const panelWidthMm = shiftedPlacement.widthMm
      const panelHeightMm = shiftedPlacement.heightMm

      drawLoop({
        page,
        loop: loops.outerLoop || [],
        placement: shiftedPlacement,
        panelWidthMm,
        panelHeightMm,
        sheetHeightMm: pageHeight,
      })

      ;(loops.holeLoops || []).forEach((holeLoop) => {
        drawLoop({
          page,
          loop: holeLoop,
          placement: shiftedPlacement,
          panelWidthMm,
          panelHeightMm,
          sheetHeightMm: pageHeight,
        })
      })

      const label = labelById[shiftedPlacement.id]
      page.drawRectangle({
        x: mmToPt(label.box.x),
        y: mmToPt(pageHeight - (label.box.y + label.box.height)),
        width: mmToPt(label.box.width),
        height: mmToPt(label.box.height),
        color: rgb(1, 1, 1),
      })
      page.drawText(label.text, {
        x: mmToPt(label.textX),
        y: mmToPt(pageHeight - label.textYTopDown),
        size: mmToPt(label.fontSizeMm),
        font,
        color: rgb(0.12, 0.16, 0.23),
      })
    })

    const pdfBytes = await pdfDocument.save()
    return {
      pdfBytes,
      nesting,
    }
  }

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const pageWidth = options.sheetWidthMm + (pagePadding * 2)
    const pageHeight = options.sheetHeightMm + (pagePadding * 2) + headerBandHeight
    const sheetOriginX = pagePadding
    const sheetOriginYTopDown = pagePadding + headerBandHeight
    const page = pdfDocument.addPage([mmToPt(pageWidth), mmToPt(pageHeight)])
    const sheetPlacements = placements.filter((placement) => placement.sheetIndex === sheetIndex)
    const shiftedPlacements = sheetPlacements.map((placement) => ({
      ...placement,
      xMm: placement.xMm + sheetOriginX,
      yMm: placement.yMm + sheetOriginYTopDown,
    }))
    const sheetTitleText = `Sheet ${sheetIndex + 1}`
    const sheetTitleBox = {
      x: pagePadding - 1,
      y: pagePadding - 2,
      width: estimateTextWidthMm(sheetTitleText, textSizes.title) + 6,
      height: textSizes.title + 7,
    }
    const labelPlacements = buildLabelPlacements({
      placements: shiftedPlacements,
      fontSizeMm: textSizes.part,
      area: {
        minX: sheetOriginX,
        minY: sheetOriginYTopDown,
        maxX: sheetOriginX + options.sheetWidthMm,
        maxY: sheetOriginYTopDown + options.sheetHeightMm,
      },
      reservedBoxes: [sheetTitleBox],
    })
    const labelById = Object.fromEntries(labelPlacements.map((label) => [label.placementId, label]))

    page.drawRectangle({
      x: mmToPt(sheetOriginX),
      y: mmToPt(pageHeight - (sheetOriginYTopDown + options.sheetHeightMm)),
      width: mmToPt(options.sheetWidthMm),
      height: mmToPt(options.sheetHeightMm),
      borderWidth: 1,
      borderColor: rgb(0.12, 0.16, 0.23),
    })

    page.drawRectangle({
      x: mmToPt(sheetOriginX + options.marginMm),
      y: mmToPt(pageHeight - (sheetOriginYTopDown + options.sheetHeightMm - options.marginMm)),
      width: mmToPt(options.sheetWidthMm - (options.marginMm * 2)),
      height: mmToPt(options.sheetHeightMm - (options.marginMm * 2)),
      borderWidth: 0.5,
      borderColor: rgb(0.39, 0.45, 0.53),
    })

    page.drawText(`Sheet ${sheetIndex + 1}`, {
      x: mmToPt(pagePadding),
      y: mmToPt(pageHeight - (pagePadding + textSizes.title)),
      size: mmToPt(textSizes.title),
      font,
      color: rgb(0.2, 0.25, 0.31),
    })

    page.drawText(`Sheet size: ${formatMm(options.sheetWidthMm)} x ${formatMm(options.sheetHeightMm)}`, {
      x: mmToPt(pagePadding),
      y: mmToPt(pageHeight - (pagePadding + textSizes.title + textSizes.meta + 2)),
      size: mmToPt(textSizes.meta),
      font,
      color: rgb(0.34, 0.39, 0.45),
    })

    if (sheetCount === 1) {
      const bounds = getSheetPlacementBounds(sheetPlacements)
      if (bounds) {
        const footprintX = clamp(bounds.minX - options.marginMm, 0, options.sheetWidthMm)
        const footprintY = clamp(bounds.minY - options.marginMm, 0, options.sheetHeightMm)
        const footprintMaxX = clamp(bounds.maxX + options.marginMm, 0, options.sheetWidthMm)
        const footprintMaxY = clamp(bounds.maxY + options.marginMm, 0, options.sheetHeightMm)
        const footprintWidth = Math.max(0, footprintMaxX - footprintX)
        const footprintHeight = Math.max(0, footprintMaxY - footprintY)
        const shiftedFootprintX = footprintX + sheetOriginX
        const shiftedFootprintY = footprintY + sheetOriginYTopDown

        page.drawRectangle({
          x: mmToPt(shiftedFootprintX),
          y: mmToPt(pageHeight - (shiftedFootprintY + footprintHeight)),
          width: mmToPt(footprintWidth),
          height: mmToPt(footprintHeight),
          borderWidth: 0.8,
          borderColor: rgb(0.71, 0.33, 0.03),
        })

        const noteText = `Required footprint incl. margin: ${formatMm(footprintWidth)} x ${formatMm(footprintHeight)} | Max sheet: ${formatMm(options.sheetWidthMm)} x ${formatMm(options.sheetHeightMm)}`
        const noteYTopDown = clamp(shiftedFootprintY - 4, pagePadding + textSizes.meta + 2, sheetOriginYTopDown + options.sheetHeightMm - 2)
        page.drawText(noteText, {
          x: mmToPt(shiftedFootprintX + 4),
          y: mmToPt(pageHeight - noteYTopDown),
          size: mmToPt(textSizes.meta),
          font,
          color: rgb(0.57, 0.25, 0.0),
        })
      }
    }

    shiftedPlacements.forEach((shiftedPlacement) => {
      const loops = shiftedPlacement.vectorLoops || {}
      const panelWidthMm = shiftedPlacement.widthMm
      const panelHeightMm = shiftedPlacement.heightMm

      drawLoop({
        page,
        loop: loops.outerLoop || [],
        placement: shiftedPlacement,
        panelWidthMm,
        panelHeightMm,
        sheetHeightMm: pageHeight,
      })

      ;(loops.holeLoops || []).forEach((holeLoop) => {
        drawLoop({
          page,
          loop: holeLoop,
          placement: shiftedPlacement,
          panelWidthMm,
          panelHeightMm,
          sheetHeightMm: pageHeight,
        })
      })

      const label = labelById[shiftedPlacement.id]
      page.drawRectangle({
        x: mmToPt(label.box.x),
        y: mmToPt(pageHeight - (label.box.y + label.box.height)),
        width: mmToPt(label.box.width),
        height: mmToPt(label.box.height),
        color: rgb(1, 1, 1),
      })
      page.drawText(label.text, {
        x: mmToPt(label.textX),
        y: mmToPt(pageHeight - label.textYTopDown),
        size: mmToPt(label.fontSizeMm),
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
