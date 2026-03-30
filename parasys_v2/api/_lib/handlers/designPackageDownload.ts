import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import JSZip from 'jszip'
import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { resolveDimsMm } from '../dimensions'
import { getConfiguratorBySlug } from './configurators'

export function isFreeDesignPackageAllowed(): boolean {
  const v = process.env.ALLOW_FREE_DESIGN_PACKAGE
  return v === 'true' || v === '1'
}

function safeFilePart(s: string): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
  return t || 'configurator'
}

async function buildPdfSummary(meta: {
  slug: string
  name: string
  templateKey: string
  widthMm: number
  depthMm: number
  heightMm: number
}): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  let y = 750
  const line = (text: string, size = 11) => {
    page.drawText(text, { x: 50, y, size, font, color: rgb(0.12, 0.14, 0.18) })
    y -= size + 6
  }
  line('Parasys — design package (development)', 14)
  y -= 6
  line(`Product: ${meta.name}`)
  line(`Slug: ${meta.slug}`)
  line(`Template: ${meta.templateKey}`)
  line('')
  line(`Dimensions (mm): W ${meta.widthMm} × D ${meta.depthMm} × H ${meta.heightMm}`)
  line('')
  line('This PDF is a placeholder. Labelled views, plans, elevations, and', 10)
  line('cut sheets will replace this content in a later milestone.', 10)
  return Buffer.from(await doc.save())
}

function buildPlaceholderStl(widthM: number, heightM: number, depthM: number): Buffer {
  const geom = new THREE.BoxGeometry(widthM, heightM, depthM)
  const mesh = new THREE.Mesh(geom)
  mesh.updateMatrixWorld(true)
  const exporter = new STLExporter()
  const ascii = exporter.parse(mesh, { binary: false }) as string
  return Buffer.from(ascii, 'utf8')
}

export async function buildDesignPackageZip(
  slug: string,
  dimsInput?: { widthMm?: number; depthMm?: number; heightMm?: number } | null,
): Promise<{ ok: true; buffer: Buffer; filename: string } | { ok: false; status: number; error: string }> {
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

  const pdf = await buildPdfSummary({
    slug: c.item.slug,
    name: c.item.name,
    templateKey: c.item.templateKey,
    widthMm,
    depthMm,
    heightMm,
  })
  const stl = buildPlaceholderStl(widthM, heightM, depthM)

  const zip = new JSZip()
  zip.file('summary.pdf', pdf)
  zip.file('model.stl', stl)
  zip.file(
    'readme.txt',
    [
      'Parasys design package (development build)',
      '',
      `Configurator: ${c.item.name} (${c.item.slug})`,
      `Dimensions (mm): W ${widthMm} × D ${depthMm} × H ${heightMm}`,
      '',
      'STL: placeholder box matching the dimensions above (demo export).',
      'PDF: placeholder summary until production drawings are generated.',
      '',
      'Disable free downloads in production: unset ALLOW_FREE_DESIGN_PACKAGE.',
    ].join('\n'),
  )

  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const filename = `parasys-design-${safeFilePart(c.item.slug)}.zip`
  return { ok: true, buffer: out as Buffer, filename }
}
