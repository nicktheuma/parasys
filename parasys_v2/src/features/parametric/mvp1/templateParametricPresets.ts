import type { TemplateParametricPreset } from '../../../../shared/types'

const TEMPLATE_PARAMETRIC_PRESETS: Record<string, TemplateParametricPreset> = {
  open_shelf: { dividers: 4, shelves: 5, showBackPanel: true, showVerticalPanels: true, showShelfPanels: true, interlockEnabled: true },
  wardrobe: { dividers: 3, shelves: 6, showBackPanel: true, showVerticalPanels: true, showShelfPanels: true, interlockEnabled: true },
  media_unit: { dividers: 4, shelves: 4, showBackPanel: true, showVerticalPanels: true, showShelfPanels: true, interlockEnabled: true },
  tv_console: { dividers: 4, shelves: 3, showBackPanel: true, showVerticalPanels: true, showShelfPanels: true, interlockEnabled: true },
  sideboard: { dividers: 5, shelves: 4, showBackPanel: true, showVerticalPanels: true, showShelfPanels: true, interlockEnabled: true },
  kitchen_island: { dividers: 4, shelves: 3, showBackPanel: true, showVerticalPanels: true, showShelfPanels: true, interlockEnabled: true },
  bedside_table: { dividers: 2, shelves: 2, showBackPanel: true, showVerticalPanels: true, showShelfPanels: true, interlockEnabled: true },
}

export function getTemplateParametricPreset(templateKey: string): TemplateParametricPreset | null {
  return TEMPLATE_PARAMETRIC_PRESETS[templateKey] ?? null
}

export function mergeTemplateParametricPreset(
  templateKey: string,
  overrides?: Partial<TemplateParametricPreset> | null,
): TemplateParametricPreset | null {
  const base = getTemplateParametricPreset(templateKey)
  if (!base) return null
  if (!overrides) return base
  return { ...base, ...overrides }
}
