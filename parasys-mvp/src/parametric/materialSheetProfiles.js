export const DEFAULT_SHEET_PROFILE = {
  name: 'Default sheet',
  sheetWidthMm: 2400,
  sheetHeightMm: 1200,
  marginMm: 10,
  spacingMm: 10,
}

export const MATERIAL_SHEET_PRESETS = {
  Stainless_Steel: {
    name: 'Stainless steel',
    sheetWidthMm: 800,
    sheetHeightMm: 1200,
    marginMm: 5,
    spacingMm: 5,
  },
  Wood: {
    name: 'Wood',
    sheetWidthMm: 2400,
    sheetHeightMm: 1200,
    marginMm: 10,
    spacingMm: 10,
  },
}

const MATERIAL_KEY_TO_PRESET = {
  Chrome: 'Stainless_Steel',
  Stainless_Steel: 'Stainless_Steel',
  Painted: 'Wood',
  PaintedWood: 'Wood',
  PBR: 'Stainless_Steel',
  MATCAP: 'Wood',
  Wireframe: 'Wood',
  UVDebug: 'Wood',
}

export function getSheetPresetForMaterial(materialKey) {
  const presetKey = MATERIAL_KEY_TO_PRESET[materialKey]
  const preset = presetKey ? MATERIAL_SHEET_PRESETS[presetKey] : null
  return {
    ...DEFAULT_SHEET_PROFILE,
    ...(preset || {}),
  }
}
