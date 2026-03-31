import type { TemplateParametricPreset } from '@shared/types'
import { PANEL_TEMPLATE_KEYS } from '../features/configurator/templates/registry'
import { generatePanelSpecs } from '../features/parametric/mvp1/panelSpecs'
import type { PanelSpec } from '../features/parametric/mvp1/panelSpecs'
import { mergeTemplateParametricPreset } from '../features/parametric/mvp1/templateParametricPresets'

/**
 * Mirrors `computePanelSpecs` in `api/_lib/handlers/designPackageDownload.ts`
 * (same inputs as manufacturing PDF / STL parts).
 */
export function computePanelSpecsForDesignPackage(
  templateKey: string,
  widthM: number,
  depthM: number,
  heightM: number,
  templateParamsForTemplate: Partial<TemplateParametricPreset> | null | undefined,
): PanelSpec[] | null {
  if (!PANEL_TEMPLATE_KEYS.has(templateKey)) return null
  const merged = mergeTemplateParametricPreset(templateKey, templateParamsForTemplate ?? null)
  if (!merged) return null
  const materialThickness = Math.max(0.002, Math.min(widthM, depthM, heightM) * 0.03)
  const slotOffsetFactor = merged.slotOffsetFactor ?? 0.5
  const slotOffset = materialThickness * slotOffsetFactor
  return generatePanelSpecs({
    width: widthM,
    height: heightM,
    depth: depthM,
    dividers: merged.dividers ?? 2,
    shelves: merged.shelves ?? 2,
    edgeOffset: merged.edgeOffset ?? 0,
    slotOffset,
    materialThickness,
  })
}
