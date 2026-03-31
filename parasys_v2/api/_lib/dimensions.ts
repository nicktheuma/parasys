import type {
  ConfiguratorLightingSettings,
  ConfiguratorPropPlacement,
  ConfiguratorSettingsRow,
  MaterialShaderSpec,
  ParamGraphNode,
  ParamGraphSettings,
  SceneLightSettings,
} from '../../db/schema'
import { clampDimMm, DIM_MM } from '../../shared/constants'

export { clampDimMm, DIM_MM }
export type { DimKey } from '../../shared/constants'

const MAX_NODES = 200
const MAX_EDGES = 500

const VALID_NODE_TYPES = new Set([
  'dimension', 'constant', 'binary', 'output',
  'ghSlider', 'ghPanel', 'ghPoint', 'ghVector', 'ghMove',
  'ghLine', 'ghCrv', 'ghExtrude', 'ghCap', 'ghChamfer', 'ghBevel', 'ghFillet',
])

function isValidNodeData(data: unknown): data is ParamGraphNode['data'] {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  for (const key of Object.keys(d)) {
    const v = d[key]
    if (v === null || v === undefined) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') continue
    return false
  }
  return true
}

export function validateParamGraph(raw: unknown): ParamGraphSettings | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') return null

  const g = raw as Record<string, unknown>
  const nodes = g.nodes
  const edges = g.edges
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null
  if (nodes.length > MAX_NODES || edges.length > MAX_EDGES) return null

  const validNodes: ParamGraphNode[] = []
  const nodeIds = new Set<string>()

  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    const node = n as Record<string, unknown>
    if (typeof node.id !== 'string' || !node.id) continue
    if (typeof node.type !== 'string' || !VALID_NODE_TYPES.has(node.type)) continue
    if (!node.position || typeof node.position !== 'object') continue
    const pos = node.position as Record<string, unknown>
    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') continue
    if (!isValidNodeData(node.data)) continue

    nodeIds.add(node.id)
    validNodes.push({
      id: node.id,
      type: node.type as ParamGraphNode['type'],
      position: { x: pos.x, y: pos.y },
      data: node.data as ParamGraphNode['data'],
    })
  }

  const validEdges = []
  for (const e of edges) {
    if (!e || typeof e !== 'object') continue
    const edge = e as Record<string, unknown>
    if (typeof edge.id !== 'string' || !edge.id) continue
    if (typeof edge.source !== 'string' || !nodeIds.has(edge.source)) continue
    if (typeof edge.target !== 'string' || !nodeIds.has(edge.target)) continue
    validEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : null,
      targetHandle: typeof edge.targetHandle === 'string' ? edge.targetHandle : null,
    })
  }

  return { nodes: validNodes, edges: validEdges }
}

export function resolveDimsMm(input?: { widthMm?: number; depthMm?: number; heightMm?: number } | null) {
  return {
    widthMm: clampDimMm('width', input?.widthMm ?? DIM_MM.width.default),
    depthMm: clampDimMm('depth', input?.depthMm ?? DIM_MM.depth.default),
    heightMm: clampDimMm('height', input?.heightMm ?? DIM_MM.height.default),
  }
}

function normalizeThumbnailSrc(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (!t || t.length > 512) return undefined
  if (t.startsWith('https://') || t.startsWith('http://')) {
    try {
      const u = new URL(t)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
      return t
    } catch {
      return undefined
    }
  }
  if (!t.startsWith('/')) return undefined
  if (t.includes('..')) return undefined
  if (/\s/.test(t)) return undefined
  return t
}

export function normalizeSettings(
  input: ConfiguratorSettingsRow | null | undefined,
): ConfiguratorSettingsRow | null {
  if (!input || typeof input !== 'object') return null
  const out: ConfiguratorSettingsRow = {}
  const d = input.defaultDims
  if (d && typeof d === 'object') {
    out.defaultDims = {
      widthMm: clampDimMm('width', d.widthMm ?? DIM_MM.width.default),
      depthMm: clampDimMm('depth', d.depthMm ?? DIM_MM.depth.default),
      heightMm: clampDimMm('height', d.heightMm ?? DIM_MM.height.default),
    }
  }

  const thumb = normalizeThumbnailSrc(input.thumbnailSrc)
  if (thumb !== undefined) out.thumbnailSrc = thumb

  const dmid = input.defaultMaterialId
  if (dmid === null) {
    out.defaultMaterialId = null
  } else if (typeof dmid === 'string') {
    const t = dmid.trim()
    if (t.length > 0) out.defaultMaterialId = t
  }

  if (input.paramGraph !== undefined) out.paramGraph = validateParamGraph(input.paramGraph)

  const dl = input.dimLimits
  if (dl && typeof dl === 'object') {
    const nf = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? v : undefined
    const cleanDl: Record<string, { min?: number; max?: number }> = {}
    for (const dk of ['widthMm', 'depthMm', 'heightMm'] as const) {
      const rv = (dl as Record<string, unknown>)[dk]
      if (!rv || typeof rv !== 'object') continue
      const r = rv as { min?: unknown; max?: unknown }
      const mn = nf(r.min)
      const mx = nf(r.max)
      if (mn !== undefined || mx !== undefined) cleanDl[dk] = { min: mn, max: mx }
    }
    if (Object.keys(cleanDl).length > 0) out.dimLimits = cleanDl
  }

  const tp = input.templateParams
  if (tp && typeof tp === 'object') {
    const clean: NonNullable<ConfiguratorSettingsRow['templateParams']> = {}
    for (const [key, raw] of Object.entries(tp)) {
      if (!raw || typeof raw !== 'object') continue
      const src = raw as {
        dividers?: unknown
        shelves?: unknown
        edgeOffset?: unknown
        slotOffsetFactor?: unknown
        interlockEnabled?: unknown
        interlockClearanceFactor?: unknown
        interlockLengthFactor?: unknown
        panelThickness?: unknown
      }
      const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
      clean[key] = {
        dividers: n(src.dividers) !== undefined ? Math.max(0, Math.min(12, Math.round(n(src.dividers)!))) : undefined,
        shelves: n(src.shelves) !== undefined ? Math.max(0, Math.min(12, Math.round(n(src.shelves)!))) : undefined,
        edgeOffset: n(src.edgeOffset),
        slotOffsetFactor: n(src.slotOffsetFactor),
        interlockEnabled: typeof src.interlockEnabled === 'boolean' ? src.interlockEnabled : undefined,
        interlockClearanceFactor: n(src.interlockClearanceFactor),
        interlockLengthFactor: n(src.interlockLengthFactor),
        panelThickness: n(src.panelThickness),
      }
    }
    if (Object.keys(clean).length > 0) out.templateParams = clean
  }

  const pl = input.paramLimits
  if (pl && typeof pl === 'object') {
    const cleanLimits: NonNullable<ConfiguratorSettingsRow['paramLimits']> = {}
    for (const [key, raw] of Object.entries(pl)) {
      if (!raw || typeof raw !== 'object') continue
      const src = raw as Record<string, unknown>
      const limObj: Record<string, { min?: number; max?: number }> = {}
      for (const [pk, rv] of Object.entries(src)) {
        if (!rv || typeof rv !== 'object') continue
        const r = rv as { min?: unknown; max?: unknown }
        const n = (v: unknown): number | undefined =>
          typeof v === 'number' && Number.isFinite(v) ? v : undefined
        const mn = n(r.min)
        const mx = n(r.max)
        if (mn !== undefined || mx !== undefined) limObj[pk] = { min: mn, max: mx }
      }
      if (Object.keys(limObj).length > 0) cleanLimits[key] = limObj
    }
    if (Object.keys(cleanLimits).length > 0) out.paramLimits = cleanLimits
  }

  const HEX6 = /^#[0-9a-fA-F]{6}$/

  function normLight(raw: unknown): Partial<SceneLightSettings> | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const o = raw as Record<string, unknown>
    const out: Partial<SceneLightSettings> = {}
    const pos = o.position
    if (Array.isArray(pos) && pos.length === 3) {
      const a = pos.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN))
      if (a.every((x) => !Number.isNaN(x))) {
        out.position = [a[0]!, a[1]!, a[2]!]
      }
    }
    if (typeof o.intensity === 'number' && Number.isFinite(o.intensity)) {
      out.intensity = Math.max(0, Math.min(50, o.intensity))
    }
    if (typeof o.color === 'string') {
      const c = o.color.trim()
      if (HEX6.test(c)) out.color = c
    }
    if (typeof o.softness === 'number' && Number.isFinite(o.softness)) {
      out.softness = Math.max(0, Math.min(1, o.softness))
    }
    return Object.keys(out).length > 0 ? out : undefined
  }

  const lig = input.lighting
  if (lig && typeof lig === 'object') {
    const src = lig as Record<string, unknown>
    const clean: ConfiguratorLightingSettings = {}
    if (typeof src.ambientIntensity === 'number' && Number.isFinite(src.ambientIntensity)) {
      clean.ambientIntensity = Math.max(0, Math.min(12, src.ambientIntensity))
    }
    if (typeof src.environmentBlur === 'number' && Number.isFinite(src.environmentBlur)) {
      clean.environmentBlur = Math.max(0, Math.min(1, src.environmentBlur))
    }
    if (typeof src.environmentIntensity === 'number' && Number.isFinite(src.environmentIntensity)) {
      clean.environmentIntensity = Math.max(0, Math.min(4, src.environmentIntensity))
    }
    const d0 = normLight(src.directional0)
    if (d0) clean.directional0 = d0
    const d1 = normLight(src.directional1)
    if (d1) clean.directional1 = d1
    const d2 = normLight(src.directional2)
    if (d2) clean.directional2 = d2
    const ks = normLight(src.keySpot)
    if (ks) clean.keySpot = ks
    const fp = normLight(src.fillPoint)
    if (fp) clean.fillPoint = fp
    if (Object.keys(clean).length > 0) out.lighting = clean
  }

  const uvm = input.uvMappings
  if (uvm && typeof uvm === 'object') {
    const cleanUv: NonNullable<ConfiguratorSettingsRow['uvMappings']> = {}
    const nf = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? v : undefined
    for (const [surfaceKey, raw] of Object.entries(uvm)) {
      if (!raw || typeof raw !== 'object') continue
      const src = raw as Record<string, unknown>
      const entry = {
        scaleX: nf(src.scaleX),
        scaleY: nf(src.scaleY),
        scaleZ: nf(src.scaleZ),
        offsetX: nf(src.offsetX),
        offsetY: nf(src.offsetY),
        rotation: nf(src.rotation),
        rotationX: nf(src.rotationX),
        rotationY: nf(src.rotationY),
        rotationZ: nf(src.rotationZ),
      }
      const hasValue = Object.values(entry).some((v) => v !== undefined)
      if (hasValue) cleanUv[surfaceKey] = entry
    }
    if (Object.keys(cleanUv).length > 0) out.uvMappings = cleanUv
  }

  const pr = input.props
  if (pr && typeof pr === 'object') {
    const placementsRaw = (pr as { placements?: unknown }).placements
    const placements: ConfiguratorPropPlacement[] = []
    if (Array.isArray(placementsRaw)) {
      const alignXOk = (v: unknown): v is 'center' | 'left' | 'right' =>
        v === 'center' || v === 'left' || v === 'right'
      const alignZOk = (v: unknown): v is 'center' | 'front' | 'back' =>
        v === 'center' || v === 'front' || v === 'back'
      for (const row of placementsRaw) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        if (typeof r.id !== 'string' || !r.id || r.id.length > 80) continue
        if (typeof r.propLibraryId !== 'string' || !r.propLibraryId) continue
        if (typeof r.anchorId !== 'string' || !r.anchorId || r.anchorId.length > 120) continue
        const scaleBias =
          typeof r.scaleBias === 'number' && Number.isFinite(r.scaleBias)
            ? Math.max(0.05, Math.min(24, r.scaleBias))
            : undefined
        let materialSpec: MaterialShaderSpec | undefined
        if (r.materialSpec && typeof r.materialSpec === 'object') {
          materialSpec = r.materialSpec as MaterialShaderSpec
        }
        const alignX = alignXOk(r.alignX) ? r.alignX : undefined
        const alignZ = alignZOk(r.alignZ) ? r.alignZ : undefined
        placements.push({
          id: r.id,
          propLibraryId: r.propLibraryId,
          anchorId: r.anchorId,
          scaleBias,
          materialSpec,
          alignX,
          alignZ,
        })
      }
    }
    let density: number | undefined
    const rawD = (pr as { density?: unknown }).density
    if (typeof rawD === 'number' && Number.isFinite(rawD)) {
      density = Math.max(0, Math.min(1, rawD))
    }
    const paletteRaw = (pr as { palettePropIds?: unknown }).palettePropIds
    const palettePropIds: string[] = []
    if (Array.isArray(paletteRaw)) {
      for (const id of paletteRaw) {
        if (typeof id === 'string' && id.trim().length > 0 && palettePropIds.length < 32) {
          palettePropIds.push(id.trim())
        }
      }
    }
    if (placements.length > 0 || density !== undefined || palettePropIds.length > 0) {
      const propsOut: NonNullable<ConfiguratorSettingsRow['props']> = { placements }
      if (density !== undefined) propsOut.density = density
      if (palettePropIds.length > 0) propsOut.palettePropIds = palettePropIds
      out.props = propsOut
    }
  }

  return Object.keys(out).length > 0 ? out : null
}
