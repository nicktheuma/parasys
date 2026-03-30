export const DIM_MM = {
  width: { min: 200, max: 2400, default: 500 },
  depth: { min: 200, max: 1200, default: 280 },
  height: { min: 50, max: 800, default: 120 },
} as const

export type DimKey = keyof typeof DIM_MM

export function clampDimMm(key: DimKey, value: number): number {
  const r = DIM_MM[key]
  return Math.min(r.max, Math.max(r.min, Math.round(value)))
}

export function mmToM(mm: number): number {
  return mm / 1000
}

export const TEMPLATE_OPTIONS = [
  { key: 'tv_console', label: 'TV console', category: 'Living' },
  { key: 'media_unit', label: 'Media unit', category: 'Living' },
  { key: 'open_shelf', label: 'Open shelf', category: 'Storage' },
  { key: 'wardrobe', label: 'Wardrobe', category: 'Storage' },
  { key: 'sideboard', label: 'Sideboard', category: 'Dining' },
  { key: 'dining_table', label: 'Dining table', category: 'Dining' },
  { key: 'kitchen_island', label: 'Kitchen island', category: 'Kitchen' },
  { key: 'workbench', label: 'Workbench', category: 'Workshop' },
  { key: 'desk', label: 'Desk', category: 'Office' },
  { key: 'bedside_table', label: 'Bedside table', category: 'Bedroom' },
  { key: 'sofa', label: 'Sofa (block)', category: 'Living' },
  { key: 'jewelry', label: 'Jewelry / small', category: 'Retail' },
  { key: 'boat', label: 'Hull (elongated)', category: 'Specialty' },
  { key: 'packaging', label: 'Packaging / carton', category: 'Specialty' },
] as const

export type TemplateKey = (typeof TEMPLATE_OPTIONS)[number]['key']

export const TEMPLATE_KEYS = new Set<string>(TEMPLATE_OPTIONS.map((t) => t.key))
