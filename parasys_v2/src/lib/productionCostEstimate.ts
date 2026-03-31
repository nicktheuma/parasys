import type { TemplateParametricPreset } from '@shared/types'
import { defaultNestingOptions, nestPanelsRectangular, type NestingPanelInput } from '@shared/nesting'
import { buildPanelProfile } from '@/features/parametric/mvp1/profileBuilder'
import type { PanelSpec } from '@/features/parametric/mvp1/panelSpecs'
import { mergeTemplateParametricPreset } from '@/features/parametric/mvp1/templateParametricPresets'
import { computePanelSpecsForDesignPackage } from '@/lib/panelSpecsForDesignPackage'

/** Walnut sheet 2.4 m × 1.2 m × 15 mm — indicative material rate, not a quote. */
const EUR_PER_SHEET_WALNUT_2400x1200_15MM = 180
/** Cutting and edging, per metre of cut path (outer + holes). */
const EUR_PER_METER_CUT_AND_EDGE = 2.5
const ASSEMBLY_MINUTES_PER_PANEL = 15
const EUR_PER_LABOUR_HOUR = 60
/** Flat delivery per finished product. */
const DELIVERY_FLAT_EUR = 75
const EXTRA_SHEET_PER_REJECTED_PANEL = 1

const eurFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export function formatProductionCostEur(value: number): string {
  return eurFormatter.format(value)
}

function closedLoopLengthM(loop: number[][]): number {
  if (loop.length < 2) return 0
  let n = loop.length
  const first = loop[0]
  const last = loop[n - 1]
  if (first && last && first[0] === last[0] && first[1] === last[1]) n -= 1
  let len = 0
  for (let i = 0; i < n; i++) {
    const a = loop[i]!
    const b = loop[(i + 1) % n]!
    len += Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!)
  }
  return len
}

function totalCutLengthMmFromLoops(vectorLoops: NestingPanelInput['vectorLoops']): number {
  const outerMm = closedLoopLengthM(vectorLoops.outerLoop) * 1000
  const holesMm = vectorLoops.holeLoops.reduce((sum, hole) => sum + closedLoopLengthM(hole) * 1000, 0)
  return outerMm + holesMm
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

export type ProductionCostBreakdown = {
  sheetCount: number
  rejectedPanelCount: number
  cutLengthMm: number
  panelCount: number
  sheetMaterialEur: number
  cutEdgingEur: number
  assemblyLabourEur: number
  deliveryEur: number
  totalEur: number
}

export function estimateProductionCostEur(input: {
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
  templateParamsForTemplate: Partial<TemplateParametricPreset> | null | undefined

  /** Full merged preset (same as PDF `buildManufacturingPdf`); null = use merge from templateParams only */
  templateMergedOverride?: TemplateParametricPreset | null
}): ProductionCostBreakdown | null {
  const {
    templateKey,
    widthMm,
    depthMm,
    heightMm,
    templateParamsForTemplate,
    templateMergedOverride,
  } = input

  const widthM = widthMm / 1000
  const depthM = depthMm / 1000
  const heightM = heightMm / 1000

  const panels = computePanelSpecsForDesignPackage(
    templateKey,
    widthM,
    depthM,
    heightM,
    templateParamsForTemplate,
  )
  if (!panels?.length) return null

  const merged =
    templateMergedOverride ?? mergeTemplateParametricPreset(templateKey, templateParamsForTemplate ?? null)
  if (!merged) return null

  const nestingInputs = panelsToNestingInput(panels, merged, widthM, depthM, heightM)
  const nesting = nestPanelsRectangular(nestingInputs, defaultNestingOptions)

  let cutLengthMm = 0
  for (const p of nestingInputs) {
    cutLengthMm += totalCutLengthMmFromLoops(p.vectorLoops)
  }

  const sheetCount = nesting.sheetCount + nesting.rejectedPanels.length * EXTRA_SHEET_PER_REJECTED_PANEL
  const panelCount = panels.length

  const sheetMaterialEur = sheetCount * EUR_PER_SHEET_WALNUT_2400x1200_15MM
  const cutEdgingEur = (cutLengthMm / 1000) * EUR_PER_METER_CUT_AND_EDGE
  const assemblyLabourEur =
    panelCount * (ASSEMBLY_MINUTES_PER_PANEL / 60) * EUR_PER_LABOUR_HOUR
  const deliveryEur = DELIVERY_FLAT_EUR

  const totalEur = sheetMaterialEur + cutEdgingEur + assemblyLabourEur + deliveryEur

  return {
    sheetCount,
    rejectedPanelCount: nesting.rejectedPanels.length,
    cutLengthMm,
    panelCount,
    sheetMaterialEur,
    cutEdgingEur,
    assemblyLabourEur,
    deliveryEur,
    totalEur,
  }
}
