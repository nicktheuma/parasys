import type { ConfiguratorSettingsRow } from '../../../db/schema'
import { mergeTemplateParametricPreset } from '../../../src/features/parametric/mvp1/templateParametricPresets.ts'
import { buildManufacturingPdf } from '../designPackagePdf.js'
import { buildPlaceholderStlBox, buildStlFromPanels } from '../designPackageStl.js'
import { resolveDimsMm } from '../dimensions.js'
import { getConfiguratorBySlug } from './configurators.js'
import { generatePanelSpecs } from '../../../src/features/parametric/mvp1/panelSpecs.ts'
import type { PanelSpec } from '../../../src/features/parametric/mvp1/panelSpecs.ts'

export type DesignAssetFormat = 'pdf' | 'stl'

export function isFreeDesignPackageAllowed(): boolean {
  const v = process.env.ALLOW_FREE_DESIGN_PACKAGE
  return v === 'true' || v === '1'
}

function safeFilePart(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
  return t || 'configurator'
}

/** Templates that use ParametricPanelProduct / generatePanelSpecs */
const PANEL_TEMPLATE_KEYS = new Set([
  'open_shelf',
  'wardrobe',
  'media_unit',
  'tv_console',
  'sideboard',
  'kitchen_island',
  'bedside_table',
])

function computePanelSpecs(
  templateKey: string,
  widthM: number,
  depthM: number,
  heightM: number,
  settings: ConfiguratorSettingsRow | null | undefined,
): PanelSpec[] | null {
  if (!PANEL_TEMPLATE_KEYS.has(templateKey)) return null
  const merged = mergeTemplateParametricPreset(templateKey, settings?.templateParams?.[templateKey] ?? null)
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

/**
 * Single-file export: PDF (drawings + parts sheet) or STL (assembled panels or placeholder box).
 */
export async function buildDesignAsset(
  format: DesignAssetFormat,
  slug: string,
  dimsInput?: { widthMm?: number; depthMm?: number; heightMm?: number } | null,
): Promise<
  | { ok: true; buffer: Buffer; filename: string; contentType: string }
  | { ok: false; status: number; error: string }
> {
  const trimmed = slug.trim()
  if (!trimmed) {
    return { ok: false, status: 400, error: 'slug required' }
  }
  const c = await getConfiguratorBySlug(trimmed)
  if (!c.ok) {
    return { ok: false, status: c.status, error: c.error }
  }

  const mergedDims = {
    ...c.item.settings?.defaultDims,
    ...dimsInput,
  }
  const { widthMm, depthMm, heightMm } = resolveDimsMm(mergedDims)
  const widthM = widthMm / 1000
  const heightM = heightMm / 1000
  const depthM = depthMm / 1000

  const panels = computePanelSpecs(c.item.templateKey, widthM, depthM, heightM, c.item.settings)
  const templateMerged = mergeTemplateParametricPreset(
    c.item.templateKey,
    c.item.settings?.templateParams?.[c.item.templateKey] ?? null,
  )
  const safeSlug = safeFilePart(c.item.slug)

  if (format === 'pdf') {
    const pdf = await buildManufacturingPdf({
      slug: c.item.slug,
      name: c.item.name,
      templateKey: c.item.templateKey,
      widthMm,
      depthMm,
      heightMm,
      panels,
      templateMerged,
    })
    return {
      ok: true,
      buffer: pdf,
      filename: `parasys-${safeSlug}.pdf`,
      contentType: 'application/pdf',
    }
  }

  if (format === 'stl') {
    const stl =
      panels && panels.length > 0
        ? buildStlFromPanels(panels, heightM)
        : buildPlaceholderStlBox(widthM, heightM, depthM)
    return {
      ok: true,
      buffer: stl,
      filename: `parasys-${safeSlug}.stl`,
      contentType: 'model/stl',
    }
  }

  return { ok: false, status: 400, error: 'format must be pdf or stl' }
}
