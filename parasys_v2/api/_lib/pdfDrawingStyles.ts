import type { PDFPage, PDFFont } from 'pdf-lib'
import { rgb } from 'pdf-lib'

/** ISO A4 in PDF points (72 dpi) */
export const A4_PT = { width: 595.28, height: 841.89 } as const

const ink = rgb(0.07, 0.09, 0.12)
const inkMuted = rgb(0.28, 0.32, 0.38)

export function drawOuterFramePt(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  marginPt: number,
  borderWidth = 0.75,
) {
  page.drawRectangle({
    x: marginPt,
    y: marginPt,
    width: pageWidth - 2 * marginPt,
    height: pageHeight - 2 * marginPt,
    borderWidth,
    borderColor: ink,
  })
}

export function drawInnerFramePt(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  marginPt: number,
  inset = 3,
  borderWidth = 0.35,
) {
  const m = marginPt + inset
  page.drawRectangle({
    x: m,
    y: m,
    width: pageWidth - 2 * m,
    height: pageHeight - 2 * m,
    borderWidth,
    borderColor: rgb(0.55, 0.58, 0.62),
  })
}

export type CoverTitleBlockFields = {
  productName: string
  slug: string
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  sheetIndex1Based: number
  totalSheets: number
  revision?: string
  dateIso: string
}

/**
 * Architectural-style title block, bottom-right (points, bottom-left origin).
 */
export function drawTitleBlockBottomRightPt(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  font: PDFFont,
  fontBold: PDFFont,
  fields: CoverTitleBlockFields,
) {
  const pad = 40
  const blockW = 220
  const blockH = 88
  const x0 = pageWidth - pad - blockW
  const y0 = pad

  page.drawRectangle({
    x: x0,
    y: y0,
    width: blockW,
    height: blockH,
    borderWidth: 0.75,
    borderColor: ink,
  })

  const lineY = (i: number) => y0 + blockH - 16 - i * 12.5
  let row = 0
  const draw = (text: string, size: number, f: PDFFont, color = ink) => {
    page.drawText(text, {
      x: x0 + 8,
      y: lineY(row),
      size,
      font: f,
      color,
      maxWidth: blockW - 16,
    })
    row += 1
  }

  draw('PARASYS', 7, fontBold, inkMuted)
  draw(fields.productName, 10, fontBold)
  draw(`${fields.slug} · ${fields.templateKey}`, 8, font)
  draw(
    `Overall: ${Math.round(fields.widthMm)} × ${Math.round(fields.depthMm)} × ${Math.round(fields.heightMm)} mm`,
    8,
    font,
  )
  draw(`Scale: NTS · Rev ${fields.revision ?? 'A'} · ${fields.dateIso}`, 8, font, inkMuted)
  draw(
    `Sheet ${fields.sheetIndex1Based} of ${fields.totalSheets}`,
    9,
    fontBold,
  )
}

export function drawTextPt(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = ink,
) {
  page.drawText(text, { x, y, size, font, color })
}

/** Small caption top-left (PDF bottom-left coords; y near top of page). */
export function drawViewCaptionTopLeftPt(
  page: PDFPage,
  pageHeight: number,
  marginPt: number,
  caption: string,
  fontBold: PDFFont,
) {
  page.drawText(caption, {
    x: marginPt + 4,
    y: pageHeight - marginPt - 14,
    size: 9,
    font: fontBold,
    color: inkMuted,
  })
}

/** One-line sheet footer bottom-left — minimal metadata. */
export function drawMinimalSheetFooterPt(
  page: PDFPage,
  marginPt: number,
  line: string,
  font: PDFFont,
) {
  page.drawText(line, {
    x: marginPt + 4,
    y: marginPt + 6,
    size: 7.5,
    font,
    color: inkMuted,
  })
}
