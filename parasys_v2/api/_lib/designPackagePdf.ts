import type { TemplateParametricPreset } from '@shared/types'
import { PDFDocument, StandardFonts, type PDFPage, rgb } from 'pdf-lib'
import { buildPanelProfile } from '../../src/features/parametric/mvp1/profileBuilder.ts'
import type { PanelSpec } from '../../src/features/parametric/mvp1/panelSpecs.ts'
import type { NestingPanelInput } from './nesting'
import {
  A4_PT,
  drawInnerFramePt,
  drawMinimalSheetFooterPt,
  drawOuterFramePt,
  drawTextPt,
  drawViewCaptionTopLeftPt,
} from './pdfDrawingStyles.js'
import { buildNestedPdfBytes } from './pdfNestedExport.js'

const MM_TO_PT = 72 / 25.4

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT
}

type PdfFont = Awaited<ReturnType<PDFDocument['embedFont']>>

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w = 0.4,
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: w,
    color: rgb(0.1, 0.1, 0.12),
  })
}

function drawRectOutline(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  drawLine(page, x, y, x + w, y)
  drawLine(page, x + w, y, x + w, y + h)
  drawLine(page, x + w, y + h, x, y + h)
  drawLine(page, x, y + h, x, y)
}

function panelsToNestingInput(
  panels: PanelSpec[],
  templateMerged: TemplateParametricPreset | null,
  widthM: number,
  depthM: number,
  heightM: number,
): NestingPanelInput[] {
  const materialThickness =
    templateMerged?.panelThickness != null
      ? Math.max(0.001, templateMerged.panelThickness)
      : Math.max(0.002, Math.min(widthM, depthM, heightM) * 0.03)

  return panels.map((p) => {
    const { outerLoop, holeLoops } = buildPanelProfile(p, {
      allPanelSpecs: panels,
      interlockSlots: {
        enabled: templateMerged?.interlockEnabled ?? true,
        clearance: materialThickness * (templateMerged?.interlockClearanceFactor ?? 0.12),
        lengthFactor: templateMerged?.interlockLengthFactor ?? 1.6,
      },
    })
    return {
      id: p.id,
      kind: p.kind,
      width: p.width,
      height: p.height,
      vectorLoops: { outerLoop, holeLoops },
    }
  })
}

function addFallbackPartsGridPage(doc: PDFDocument, panels: PanelSpec[], font: PdfFont, fontBold: PdfFont) {
  const p2 = doc.addPage([A4_PT.width, A4_PT.height])
  drawOuterFramePt(p2, A4_PT.width, A4_PT.height, 36)
  drawInnerFramePt(p2, A4_PT.width, A4_PT.height, 36)
  let y = 760
  drawTextPt(p2, 'Parts — flat outlines (fallback grid)', 48, y, 14, fontBold)
  y -= 18
  drawTextPt(
    p2,
    'Nested sheet export was skipped (e.g. panel larger than stock). Rectangles show cut sizes in mm.',
    48,
    y,
    9,
    font,
  )
  y -= 28

  const cols = 2
  const cellW = 230
  const cellH = 125
  const gapX = 22
  const gapY = 18
  const originY = y

  panels.forEach((panel, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cellLeft = 48 + col * (cellW + gapX)
    const cellTop = originY - row * (cellH + gapY)

    const faceWmm = panel.width * 1000
    const faceHmm = panel.height * 1000
    const tmm = panel.thickness * 1000
    const s = Math.min((cellW - 24) / mmToPt(faceWmm), (cellH - 50) / mmToPt(faceHmm), 4)
    const rw = mmToPt(faceWmm) * s
    const rh = mmToPt(faceHmm) * s
    const rectLeft = cellLeft + (cellW - rw) / 2
    const rectBottom = cellTop - cellH + 40

    drawTextPt(p2, `${panel.kind} · ${panel.id}`, cellLeft, cellTop - 4, 9, fontBold)
    drawRectOutline(p2, rectLeft, rectBottom, rw, rh)
    drawTextPt(
      p2,
      `Face: ${faceWmm.toFixed(1)} × ${faceHmm.toFixed(1)} mm · t = ${tmm.toFixed(2)} mm`,
      cellLeft,
      rectBottom - 12,
      7,
      font,
    )
  })
}

function addNoPanelsPartsPage(doc: PDFDocument, font: PdfFont, fontBold: PdfFont) {
  const p2 = doc.addPage([A4_PT.width, A4_PT.height])
  drawOuterFramePt(p2, A4_PT.width, A4_PT.height, 36)
  drawInnerFramePt(p2, A4_PT.width, A4_PT.height, 36)
  let y = 760
  drawTextPt(p2, 'Parts', 48, y, 14, fontBold)
  y -= 24
  drawTextPt(
    p2,
    'No panel breakdown for this template — export the STL solid for manufacturing reference.',
    48,
    y,
    10,
    font,
  )
}

/**
 * Manufacturing PDF: title, dimensioned plan + elevations, then MVP-style nested cut sheets (or fallback grid).
 */
export async function buildManufacturingPdf(args: {
  slug: string
  name: string
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  panels: PanelSpec[] | null
  templateMerged?: TemplateParametricPreset | null
  renderedPages?: {
    planPngDataUrl?: string | null
    sectionPngDataUrl?: string | null
    elevationPngDataUrl?: string | null
  } | null
}): Promise<Buffer> {
  const dateIso = new Date().toISOString().slice(0, 10)
  const { widthMm: W, depthMm: D, heightMm: H } = args
  const widthM = W / 1000
  const depthM = D / 1000
  const heightM = H / 1000

  let nestedPdfBytes: Uint8Array | null = null
  let nestedPageCount = 0
  const frontMatterPages = 4

  if (args.panels && args.panels.length > 0) {
    const nestingInput = panelsToNestingInput(
      args.panels,
      args.templateMerged ?? null,
      widthM,
      depthM,
      heightM,
    )
    try {
      const { pdfBytes, nesting } = await buildNestedPdfBytes(nestingInput, {
        pdfPageFormat: 'A4',
        drawingMeta: {
          projectTitle: args.name,
          slug: args.slug,
          dateIso,
          sheetStartIndex1Based: frontMatterPages + 1,
        },
      })
      nestedPdfBytes = pdfBytes
      nestedPageCount = nesting.sheetCount
    } catch {
      nestedPdfBytes = null
    }
  }

  const totalSheets =
    args.panels && args.panels.length > 0
      ? nestedPdfBytes
        ? frontMatterPages + nestedPageCount
        : frontMatterPages + 1
      : frontMatterPages + 1

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const PW = A4_PT.width
  const PH = A4_PT.height
  const margin = 48
  const captionBand = 26

  async function embedPngCoverFill(
    page: PDFPage,
    pngBytes: Buffer,
    content: { x: number; y: number; w: number; h: number },
  ) {
    const png = await doc.embedPng(pngBytes)
    const iw = png.width
    const ih = png.height
    const s = Math.max(content.w / iw, content.h / ih)
    const dw = iw * s
    const dh = ih * s
    const x = content.x + (content.w - dw) / 2
    const y = content.y + (content.h - dh) / 2
    page.drawImage(png, { x, y, width: dw, height: dh })
  }

  // Page 1: black cover
  const cover = doc.addPage([PW, PH])
  cover.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: rgb(0, 0, 0) })
  cover.drawText('PARASYS', {
    x: margin,
    y: PH - margin - 52,
    size: 26,
    font: fontBold,
    color: rgb(1, 1, 1),
  })
  cover.drawText(args.name, {
    x: margin,
    y: PH - margin - 92,
    size: 16,
    font,
    color: rgb(0.92, 0.94, 0.97),
  })
  cover.drawText(`${args.slug} · ${dateIso}`, {
    x: margin,
    y: PH - margin - 116,
    size: 10,
    font,
    color: rgb(0.7, 0.72, 0.76),
  })

  // View pages: plan / section / elevation (separate sheets)
  const viewPages: Array<{ title: string; dataUrl?: string | null }> = [
    { title: 'Plan', dataUrl: args.renderedPages?.planPngDataUrl ?? null },
    { title: 'Section', dataUrl: args.renderedPages?.sectionPngDataUrl ?? null },
    { title: 'Elevation', dataUrl: args.renderedPages?.elevationPngDataUrl ?? null },
  ]

  for (let i = 0; i < viewPages.length; i += 1) {
    const v = viewPages[i]
    const page = doc.addPage([PW, PH])
    drawOuterFramePt(page, PW, PH, margin, 0.5)

    drawViewCaptionTopLeftPt(page, PH, margin, v.title, fontBold)

    const contentW = PW - 2 * margin
    const contentH = PH - 2 * margin - captionBand
    const content = { x: margin, y: margin, w: contentW, h: contentH }

    const imgUrl = v.dataUrl
    if (imgUrl && imgUrl.startsWith('data:image/png')) {
      const pngBytes = Buffer.from(imgUrl.split(',')[1] ?? '', 'base64')
      await embedPngCoverFill(page, pngBytes, content)
    } else {
      const boxW = 320
      const boxH = 240
      const left = margin + (contentW - boxW) / 2
      const bottom = margin + (contentH - boxH) / 2
      drawRectOutline(page, left, bottom, boxW, boxH)
      drawTextPt(page, `Overall: ${Math.round(W)} × ${Math.round(D)} × ${Math.round(H)} mm`, left, bottom - 14, 8, font)
    }

    drawMinimalSheetFooterPt(
      page,
      margin,
      `${args.slug} · Sheet ${2 + i} of ${totalSheets} · ${dateIso}`,
      font,
    )
  }

  if (args.panels && args.panels.length > 0) {
    if (nestedPdfBytes) {
      const nestedDoc = await PDFDocument.load(nestedPdfBytes)
      const copied = await doc.copyPages(nestedDoc, nestedDoc.getPageIndices())
      copied.forEach((page) => doc.addPage(page))
    } else {
      addFallbackPartsGridPage(doc, args.panels, font, fontBold)
    }
  } else {
    addNoPanelsPartsPage(doc, font, fontBold)
  }

  return Buffer.from(await doc.save())
}
