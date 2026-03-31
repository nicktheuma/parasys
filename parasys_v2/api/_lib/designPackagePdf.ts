import type { TemplateParametricPreset } from '@shared/types'
import { PDFDocument, StandardFonts, type PDFPage, rgb } from 'pdf-lib'
import { buildPanelProfile } from '../../src/features/parametric/mvp1/profileBuilder.ts'
import type { PanelSpec } from '../../src/features/parametric/mvp1/panelSpecs.ts'
import type { NestingPanelInput } from './nesting'
import { buildNestedPdfBytes } from './pdfNestedExport'

const MM_TO_PT = 72 / 25.4

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT
}

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

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
) {
  page.drawText(text, { x, y, size, font, color: rgb(0.08, 0.1, 0.14) })
}

/** Horizontal dimension: extension lines + line + label centered */
function drawHorizontalDim(
  page: PDFPage,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  x0: number,
  y0: number,
  widthPt: number,
  labelMm: number,
  tick = 6,
) {
  const y1 = y0 + tick
  const y2 = y0 - tick
  drawLine(page, x0, y0, x0 + widthPt, y0, 0.35)
  drawLine(page, x0, y1, x0, y2)
  drawLine(page, x0 + widthPt, y1, x0 + widthPt, y2)
  const text = `${Math.round(labelMm)} mm`
  const tw = font.widthOfTextAtSize(text, 8)
  drawText(page, text, x0 + widthPt / 2 - tw / 2, y0 + 10, 8, font)
}

function drawVerticalDim(
  page: PDFPage,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  x0: number,
  y0: number,
  heightPt: number,
  labelMm: number,
  tick = 6,
) {
  const x1 = x0 - tick
  const x2 = x0 + tick
  drawLine(page, x0, y0, x0, y0 + heightPt, 0.35)
  drawLine(page, x1, y0, x2, y0)
  drawLine(page, x1, y0 + heightPt, x2, y0 + heightPt)
  const text = `${Math.round(labelMm)} mm`
  const tw = font.widthOfTextAtSize(text, 8)
  drawText(page, text, x0 - tw - 12, y0 + heightPt / 2 - 3, 8, font)
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

type PdfFont = Awaited<ReturnType<PDFDocument['embedFont']>>

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
  const p2 = doc.addPage([612, 792])
  let y = 740
  drawText(p2, 'Parts — flat outlines (fallback grid)', 50, y, 14, fontBold)
  y -= 18
  drawText(
    p2,
    'Nested sheet export was skipped (e.g. panel larger than stock). Rectangles show cut sizes in mm.',
    50,
    y,
    9,
    font,
  )
  y -= 28

  const cols = 2
  const cellW = 240
  const cellH = 130
  const gapX = 24
  const gapY = 20
  const originY = y

  panels.forEach((panel, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cellLeft = 50 + col * (cellW + gapX)
    const cellTop = originY - row * (cellH + gapY)

    const faceWmm = panel.width * 1000
    const faceHmm = panel.height * 1000
    const tmm = panel.thickness * 1000
    const s = Math.min((cellW - 24) / mmToPt(faceWmm), (cellH - 50) / mmToPt(faceHmm), 4)
    const rw = mmToPt(faceWmm) * s
    const rh = mmToPt(faceHmm) * s
    const rectLeft = cellLeft + (cellW - rw) / 2
    const rectBottom = cellTop - cellH + 40

    drawText(p2, `${panel.kind} · ${panel.id}`, cellLeft, cellTop - 4, 9, fontBold)
    drawRectOutline(p2, rectLeft, rectBottom, rw, rh)
    drawText(
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
  const p2 = doc.addPage([612, 792])
  let y = 740
  drawText(p2, 'Parts', 50, y, 14, fontBold)
  y -= 24
  drawText(
    p2,
    'No panel breakdown for this template — export the STL solid for manufacturing reference.',
    50,
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
}): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { widthMm: W, depthMm: D, heightMm: H } = args

  // ── Page 1: title + orthographic views ──
  const p1 = doc.addPage([612, 792])
  let y = 740
  drawText(p1, 'Parasys — manufacturing drawings', 50, y, 16, fontBold)
  y -= 22
  drawText(p1, args.name, 50, y, 12, font)
  y -= 16
  drawText(p1, `Configurator: ${args.slug} · Template: ${args.templateKey}`, 50, y, 9, font)
  y -= 28
  drawText(p1, `Overall (mm): W ${Math.round(W)} × D ${Math.round(D)} × H ${Math.round(H)}`, 50, y, 11, font)
  y -= 36

  /** Two columns (plan | front), then end elevation centered below — fits letter width */
  const colLeft = 50
  const colMid = 320
  const maxBox = 230

  const planScale = Math.min(maxBox / mmToPt(W), maxBox / mmToPt(D), 2.5)
  const planW = mmToPt(W) * planScale
  const planD = mmToPt(D) * planScale
  const planBottom = y - planD - 44

  drawText(p1, 'Plan (top view)', colLeft, planBottom + planD + 16, 10, fontBold)
  drawRectOutline(p1, colLeft, planBottom, planW, planD)
  drawHorizontalDim(p1, font, colLeft, planBottom - 16, planW, W)
  drawVerticalDim(p1, font, colLeft - 20, planBottom, planD, D)

  const feScale = Math.min(maxBox / mmToPt(W), maxBox / mmToPt(H), 2.5)
  const feW = mmToPt(W) * feScale
  const feH = mmToPt(H) * feScale
  const feBottom = planBottom + (planD - feH) / 2
  drawText(p1, 'Front elevation', colMid, feBottom + feH + 16, 10, fontBold)
  drawRectOutline(p1, colMid, feBottom, feW, feH)
  drawHorizontalDim(p1, font, colMid, feBottom - 16, feW, W)
  drawVerticalDim(p1, font, colMid - 20, feBottom, feH, H)

  const eeScale = Math.min(200 / mmToPt(D), 220 / mmToPt(H), 2.5)
  const eeW = mmToPt(D) * eeScale
  const eeH = mmToPt(H) * eeScale
  const eeLeft = (612 - eeW) / 2
  const eeBottom = planBottom - 56 - eeH
  drawText(p1, 'End elevation (right)', eeLeft, eeBottom + eeH + 16, 10, fontBold)
  drawRectOutline(p1, eeLeft, eeBottom, eeW, eeH)
  drawHorizontalDim(p1, font, eeLeft, eeBottom - 16, eeW, D)
  drawVerticalDim(p1, font, eeLeft - 20, eeBottom, eeH, H)

  y = eeBottom - 48
  drawText(
    p1,
    'Views are schematic orthographic projections. Verify critical dimensions on site.',
    50,
    y,
    8,
    font,
  )

  const widthM = W / 1000
  const depthM = D / 1000
  const heightM = H / 1000

  if (args.panels && args.panels.length > 0) {
    const nestingInput = panelsToNestingInput(
      args.panels,
      args.templateMerged ?? null,
      widthM,
      depthM,
      heightM,
    )
    try {
      const { pdfBytes } = await buildNestedPdfBytes(nestingInput, { pdfPageFormat: 'SHEET' })
      const nestedDoc = await PDFDocument.load(pdfBytes)
      const copied = await doc.copyPages(nestedDoc, nestedDoc.getPageIndices())
      copied.forEach((page) => doc.addPage(page))
    } catch {
      addFallbackPartsGridPage(doc, args.panels, font, fontBold)
    }
  } else {
    addNoPanelsPartsPage(doc, font, fontBold)
  }

  return Buffer.from(await doc.save())
}
