import type { TemplateParametricPreset } from '../../../../shared/types'

const TEMPLATE_PARAMETRIC_PRESETS: Record<string, TemplateParametricPreset> = {
  open_shelf: { dividers: 2, shelves: 3, interlockEnabled: true },
  wardrobe: { dividers: 1, shelves: 4, interlockEnabled: true },
  media_unit: { dividers: 2, shelves: 2, interlockEnabled: true },
  tv_console: { dividers: 2, shelves: 1, interlockEnabled: true },
  sideboard: { dividers: 3, shelves: 2, interlockEnabled: true },
  kitchen_island: { dividers: 3, shelves: 2, interlockEnabled: true },
  bedside_table: { dividers: 1, shelves: 1, interlockEnabled: true },
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
