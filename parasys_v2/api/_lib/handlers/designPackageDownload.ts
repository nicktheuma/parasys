import { computePanelSpecsForDesignPackage } from '../../../src/lib/panelSpecsForDesignPackage.ts'
import { mergeTemplateParametricPreset } from '../../../src/features/parametric/mvp1/templateParametricPresets.ts'
import { buildManufacturingPdf } from '../designPackagePdf.js'
import { buildPlaceholderStlBox, buildStlFromPanels } from '../designPackageStl.js'
import { resolveDimsMm } from '../dimensions.js'
import { getConfiguratorBySlug } from './configurators.js'

export type DesignAssetFormat = 'pdf' | 'stl'

export function isFreeDesignPackageAllowed(): boolean {
  const v = process.env.ALLOW_FREE_DESIGN_PACKAGE
  return v === 'true' || v === '1'
}

function safeFilePart(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
  return t || 'configurator'
}

/**
 * Single-file export: PDF (drawings + parts sheet) or STL (assembled panels or placeholder box).
 */
export async function buildDesignAsset(
  format: DesignAssetFormat,
  slug: string,
  dimsInput?: { widthMm?: number; depthMm?: number; heightMm?: number } | null,
  opts?: {
    renderedPages?: {
      planPngDataUrl?: string | null
      sectionPngDataUrl?: string | null
      elevationPngDataUrl?: string | null
    } | null
  } | null,
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

  const panels = computePanelSpecsForDesignPackage(
    c.item.templateKey,
    widthM,
    depthM,
    heightM,
    c.item.settings?.templateParams?.[c.item.templateKey] ?? null,
  )
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
      renderedPages: opts?.renderedPages ?? null,
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
