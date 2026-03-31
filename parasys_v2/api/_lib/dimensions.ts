import type {
  ConfiguratorLightingSettings,
  ConfiguratorPropPlacement,
  ConfiguratorSettingsRow,
  MaterialShaderSpec,
  ParamGraphNode,
  ParamGraphSettings,
  SceneLightSettings,
} from '../../db/schema'
import { clampDimMm, DIM_MM } from '../../shared/constants.js'

export { clampDimMm, DIM_MM }
export type { DimKey } from '../../shared/constants.js'

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
  if (typeof input.isPublic === 'boolean') out.isPublic = input.isPublic
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

  const du = input.dimensionUi
  if (du && typeof du === 'object') {
    const n = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? v : undefined
    const lineScale = n((du as { lineScale?: unknown }).lineScale)
    const textScale = n((du as { textScale?: unknown }).textScale)
    const endpointScale = n((du as { endpointScale?: unknown }).endpointScale)
    const endpointTypeRaw = (du as { endpointType?: unknown }).endpointType
    const endpointType =
      endpointTypeRaw === 'dot' ||
      endpointTypeRaw === 'arrow' ||
      endpointTypeRaw === 'diagonal' ||
      endpointTypeRaw === 'cross'
        ? endpointTypeRaw
        : undefined
    const hex = (v: unknown): string | undefined => {
      if (typeof v !== 'string') return undefined
      const t = v.trim()
      return /^#[0-9a-fA-F]{6}$/.test(t) ? t : undefined
    }
    const lineColor = hex((du as { lineColor?: unknown }).lineColor)
    const textColor = hex((du as { textColor?: unknown }).textColor)
    const highlightOutlineColor = hex(
      (du as { highlightOutlineColor?: unknown }).highlightOutlineColor,
    )
    const highlightFaceColor = hex((du as { highlightFaceColor?: unknown }).highlightFaceColor)
    const lockTextColorToLine =
      typeof (du as { lockTextColorToLine?: unknown }).lockTextColorToLine === 'boolean'
        ? (du as { lockTextColorToLine: boolean }).lockTextColorToLine
        : undefined
    const lockFaceColorToOutline =
      typeof (du as { lockFaceColorToOutline?: unknown }).lockFaceColorToOutline === 'boolean'
        ? (du as { lockFaceColorToOutline: boolean }).lockFaceColorToOutline
        : undefined
    const showUnits =
      typeof (du as { showUnits?: unknown }).showUnits === 'boolean'
        ? (du as { showUnits: boolean }).showUnits
        : undefined
    const unitSystemRaw = (du as { unitSystem?: unknown }).unitSystem
    const unitSystem =
      unitSystemRaw === 'mm' || unitSystemRaw === 'm' || unitSystemRaw === 'ft_in'
        ? unitSystemRaw
        : undefined
    const textGapScale = n((du as { textGapScale?: unknown }).textGapScale)
    const gapScaleWidth = n((du as { gapScaleWidth?: unknown }).gapScaleWidth)
    const gapScaleHeight = n((du as { gapScaleHeight?: unknown }).gapScaleHeight)
    const gapScaleDepth = n((du as { gapScaleDepth?: unknown }).gapScaleDepth)
    const debugVertexColor = hex((du as { debugVertexColor?: unknown }).debugVertexColor)
    const debugVertexSize = n((du as { debugVertexSize?: unknown }).debugVertexSize)
    const pickPointSize = n((du as { pickPointSize?: unknown }).pickPointSize)
    const customRaw = (du as { customDimensions?: unknown }).customDimensions
    const customDimensions: NonNullable<NonNullable<ConfiguratorSettingsRow['dimensionUi']>['customDimensions']> = []
    if (Array.isArray(customRaw)) {
      for (const row of customRaw) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        if (typeof r.id !== 'string' || !r.id || r.id.length > 80) continue
        const toVec = (v: unknown): [number, number, number] | undefined => {
          if (!Array.isArray(v) || v.length !== 3) return undefined
          const a = v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN))
          if (a.some((x) => Number.isNaN(x))) return undefined
          return [a[0]!, a[1]!, a[2]!]
        }
        const start = toVec(r.start)
        const end = toVec(r.end)
        if (!start || !end) continue
        const name =
          typeof r.name === 'string' && r.name.trim().length > 0
            ? r.name.trim().slice(0, 80)
            : undefined
        const gs = typeof r.gapScale === 'number' && Number.isFinite(r.gapScale)
          ? Math.max(0.2, Math.min(6, r.gapScale))
          : undefined
        const normAnchor = (v: unknown): { panelId: string; vertexIndex: number } | undefined => {
          if (!v || typeof v !== 'object') return undefined
          const a = v as Record<string, unknown>
          if (typeof a.panelId !== 'string' || !a.panelId || a.panelId.length > 120) return undefined
          if (typeof a.vertexIndex !== 'number' || !Number.isFinite(a.vertexIndex)) return undefined
          return { panelId: a.panelId, vertexIndex: Math.max(0, Math.floor(a.vertexIndex)) }
        }
        customDimensions.push({
          id: r.id,
          name,
          start,
          end,
          gapScale: gs,
          startAnchor: normAnchor(r.startAnchor),
          endAnchor: normAnchor(r.endAnchor),
        })
      }
    }
    const clean = {
      lineScale: lineScale !== undefined ? Math.max(0.4, Math.min(3, lineScale)) : undefined,
      textScale: textScale !== undefined ? Math.max(0.4, Math.min(3, textScale)) : undefined,
      endpointScale:
        endpointScale !== undefined ? Math.max(0.4, Math.min(3, endpointScale)) : undefined,
      endpointType,
      lineColor,
      textColor,
      highlightOutlineColor,
      highlightFaceColor,
      lockTextColorToLine,
      lockFaceColorToOutline,
      showUnits,
      unitSystem,
      textGapScale: textGapScale !== undefined ? Math.max(0.5, Math.min(4, textGapScale)) : undefined,
      gapScaleWidth: gapScaleWidth !== undefined ? Math.max(0.2, Math.min(6, gapScaleWidth)) : undefined,
      gapScaleHeight: gapScaleHeight !== undefined ? Math.max(0.2, Math.min(6, gapScaleHeight)) : undefined,
      gapScaleDepth: gapScaleDepth !== undefined ? Math.max(0.2, Math.min(6, gapScaleDepth)) : undefined,
      customDimensions: customDimensions.length > 0 ? customDimensions : undefined,
      debugVertexColor,
      debugVertexSize:
        debugVertexSize !== undefined ? Math.max(0.001, Math.min(0.05, debugVertexSize)) : undefined,
      pickPointSize:
        pickPointSize !== undefined ? Math.max(0.001, Math.min(0.05, pickPointSize)) : undefined,
    }
    if (
      clean.lineScale !== undefined ||
      clean.textScale !== undefined ||
      clean.endpointScale !== undefined ||
      clean.endpointType !== undefined ||
      clean.lineColor !== undefined ||
      clean.textColor !== undefined ||
      clean.highlightOutlineColor !== undefined ||
      clean.highlightFaceColor !== undefined ||
      clean.lockTextColorToLine !== undefined ||
      clean.lockFaceColorToOutline !== undefined ||
      clean.showUnits !== undefined ||
      clean.unitSystem !== undefined ||
      clean.textGapScale !== undefined ||
      clean.gapScaleWidth !== undefined ||
      clean.gapScaleHeight !== undefined ||
      clean.gapScaleDepth !== undefined ||
      clean.customDimensions !== undefined ||
      clean.debugVertexColor !== undefined ||
      clean.debugVertexSize !== undefined ||
      clean.pickPointSize !== undefined
    ) {
      out.dimensionUi = clean
    }
  }

  const cam = input.camera
  if (cam && typeof cam === 'object') {
    const n = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? v : undefined
    const presetRaw = (cam as { preset?: unknown }).preset
    const preset =
      presetRaw === 'front' ||
      presetRaw === 'top' ||
      presetRaw === 'side' ||
      presetRaw === 'iso' ||
      presetRaw === 'custom'
        ? presetRaw
        : undefined
    const posRaw = (cam as { position?: unknown }).position
    const targetRaw = (cam as { target?: unknown }).target
    const distanceRaw = (cam as { distanceFactor?: unknown }).distanceFactor
    const toTriplet = (v: unknown): [number, number, number] | undefined => {
      if (!Array.isArray(v) || v.length !== 3) return undefined
      const a = [n(v[0]), n(v[1]), n(v[2])]
      if (a.some((x) => x === undefined)) return undefined
      return [a[0]!, a[1]!, a[2]!]
    }
    const position = toTriplet(posRaw)
    const target = toTriplet(targetRaw)
    const distanceFactor =
      typeof distanceRaw === 'number' && Number.isFinite(distanceRaw)
        ? Math.max(0.6, Math.min(10, distanceRaw))
        : undefined
    if (
      preset !== undefined ||
      position !== undefined ||
      target !== undefined ||
      distanceFactor !== undefined
    ) {
      out.camera = { preset, position, target, distanceFactor }
    }
  }

  const tp = input.templateParams
  if (tp && typeof tp === 'object') {
    const clean: NonNullable<ConfiguratorSettingsRow['templateParams']> = {}
    for (const [key, raw] of Object.entries(tp)) {
      if (!raw || typeof raw !== 'object') continue
      const src = raw as {
        dividers?: unknown
        shelves?: unknown
        showBackPanel?: unknown
        showVerticalPanels?: unknown
        showShelfPanels?: unknown
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
        showBackPanel: typeof src.showBackPanel === 'boolean' ? src.showBackPanel : undefined,
        showVerticalPanels: typeof src.showVerticalPanels === 'boolean' ? src.showVerticalPanels : undefined,
        showShelfPanels: typeof src.showShelfPanels === 'boolean' ? src.showShelfPanels : undefined,
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
      const primitiveOk = (v: unknown): v is 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'icosahedron' =>
        v === 'box' || v === 'sphere' || v === 'cylinder' || v === 'cone' || v === 'torus' || v === 'icosahedron'
      const alignXOk = (v: unknown): v is 'center' | 'left' | 'right' =>
        v === 'center' || v === 'left' || v === 'right'
      const alignZOk = (v: unknown): v is 'center' | 'front' | 'back' =>
        v === 'center' || v === 'front' || v === 'back'
      for (const row of placementsRaw) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        if (typeof r.id !== 'string' || !r.id || r.id.length > 80) continue
        if (typeof r.anchorId !== 'string' || !r.anchorId || r.anchorId.length > 120) continue
        const kind = r.kind === 'primitive' ? 'primitive' : 'library'
        const propLibraryId =
          typeof r.propLibraryId === 'string' && r.propLibraryId.trim().length > 0
            ? r.propLibraryId.trim()
            : undefined
        const primitiveType = primitiveOk(r.primitiveType) ? r.primitiveType : undefined
        if (kind === 'library' && !propLibraryId) continue
        if (kind === 'primitive' && !primitiveType) continue
        const PM = 0.0001
        const PX = 10
        const SM = -10
        const SX = 10
        const scaleBias =
          typeof r.scaleBias === 'number' && Number.isFinite(r.scaleBias)
            ? Math.max(PM, Math.min(PX, r.scaleBias))
            : undefined
        const n = (v: unknown): number | undefined =>
          typeof v === 'number' && Number.isFinite(v) ? v : undefined
        const scaleX = n(r.scaleX)
        const scaleY = n(r.scaleY)
        const scaleZ = n(r.scaleZ)
        const offsetX = n(r.offsetX)
        const offsetZ = n(r.offsetZ)
        const arrayCountX = n(r.arrayCountX)
        const arrayCountY = n(r.arrayCountY)
        const arrayCountZ = n(r.arrayCountZ)
        const arrayScaleJitter = n(r.arrayScaleJitter)
        const arrayScaleJitterIncrement = n(r.arrayScaleJitterIncrement)
        const arraySpacingX = n(r.arraySpacingX)
        const arraySpacingY = n(r.arraySpacingY)
        const arraySpacingZ = n(r.arraySpacingZ)
        const positionOffsetX = n(r.positionOffsetX)
        const positionOffsetY = n(r.positionOffsetY)
        const positionOffsetZ = n(r.positionOffsetZ)
        const rotationX = n(r.rotationX)
        const rotationY = n(r.rotationY)
        const rotationZ = n(r.rotationZ)
        const groupId =
          typeof r.groupId === 'string' && r.groupId.trim().length > 0
            ? r.groupId.trim().slice(0, 64)
            : undefined
        const groupOffsetX = n(r.groupOffsetX)
        const groupOffsetY = n(r.groupOffsetY)
        const groupOffsetZ = n(r.groupOffsetZ)
        let materialSpec: MaterialShaderSpec | undefined
        if (r.materialSpec && typeof r.materialSpec === 'object') {
          materialSpec = r.materialSpec as MaterialShaderSpec
        }
        const alignX = alignXOk(r.alignX) ? r.alignX : undefined
        const alignZ = alignZOk(r.alignZ) ? r.alignZ : undefined
        placements.push({
          id: r.id,
          kind,
          propLibraryId,
          primitiveType,
          anchorId: r.anchorId,
          scaleBias,
          scaleX: scaleX !== undefined ? Math.max(PM, Math.min(PX, scaleX)) : undefined,
          scaleY: scaleY !== undefined ? Math.max(PM, Math.min(PX, scaleY)) : undefined,
          scaleZ: scaleZ !== undefined ? Math.max(PM, Math.min(PX, scaleZ)) : undefined,
          offsetX: offsetX !== undefined ? Math.max(-1, Math.min(1, offsetX)) : undefined,
          offsetZ: offsetZ !== undefined ? Math.max(-1, Math.min(1, offsetZ)) : undefined,
          arrayCountX:
            arrayCountX !== undefined ? Math.max(1, Math.min(10, Math.round(arrayCountX))) : undefined,
          arrayCountY:
            arrayCountY !== undefined ? Math.max(1, Math.min(10, Math.round(arrayCountY))) : undefined,
          arrayCountZ:
            arrayCountZ !== undefined ? Math.max(1, Math.min(10, Math.round(arrayCountZ))) : undefined,
          arrayScaleJitter:
            arrayScaleJitter !== undefined ? Math.max(0, Math.min(PX, arrayScaleJitter)) : undefined,
          arrayScaleJitterIncrement:
            arrayScaleJitterIncrement !== undefined
              ? Math.max(0, Math.min(PX, arrayScaleJitterIncrement))
              : undefined,
          arraySpacingX: arraySpacingX !== undefined ? Math.max(0, Math.min(PX, arraySpacingX)) : undefined,
          arraySpacingY: arraySpacingY !== undefined ? Math.max(0, Math.min(PX, arraySpacingY)) : undefined,
          arraySpacingZ: arraySpacingZ !== undefined ? Math.max(0, Math.min(PX, arraySpacingZ)) : undefined,
          positionOffsetX:
            positionOffsetX !== undefined ? Math.max(SM, Math.min(SX, positionOffsetX)) : undefined,
          positionOffsetY:
            positionOffsetY !== undefined ? Math.max(SM, Math.min(SX, positionOffsetY)) : undefined,
          positionOffsetZ:
            positionOffsetZ !== undefined ? Math.max(SM, Math.min(SX, positionOffsetZ)) : undefined,
          rotationX:
            rotationX !== undefined
              ? Math.max((-10 * Math.PI) / 180, Math.min((10 * Math.PI) / 180, rotationX))
              : undefined,
          rotationY:
            rotationY !== undefined
              ? Math.max((-10 * Math.PI) / 180, Math.min((10 * Math.PI) / 180, rotationY))
              : undefined,
          rotationZ:
            rotationZ !== undefined
              ? Math.max((-10 * Math.PI) / 180, Math.min((10 * Math.PI) / 180, rotationZ))
              : undefined,
          groupId,
          groupOffsetX:
            groupOffsetX !== undefined ? Math.max(SM, Math.min(SX, groupOffsetX)) : undefined,
          groupOffsetY:
            groupOffsetY !== undefined ? Math.max(SM, Math.min(SX, groupOffsetY)) : undefined,
          groupOffsetZ:
            groupOffsetZ !== undefined ? Math.max(SM, Math.min(SX, groupOffsetZ)) : undefined,
          materialSpec,
          alignX,
          alignZ,
        })
      }
    }
    let density: number | undefined
    const rawD = (pr as { density?: unknown }).density
    if (typeof rawD === 'number' && Number.isFinite(rawD)) {
      density = Math.max(0, Math.min(10, rawD))
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
    let autoSeed: number | undefined
    const rawSeed = (pr as { autoSeed?: unknown }).autoSeed
    if (typeof rawSeed === 'number' && Number.isFinite(rawSeed)) {
      autoSeed = Math.max(0.0001, Math.min(10, rawSeed))
    }
    let autoScaleJitter: number | undefined
    const rawJitter = (pr as { autoScaleJitter?: unknown }).autoScaleJitter
    if (typeof rawJitter === 'number' && Number.isFinite(rawJitter)) {
      autoScaleJitter = Math.max(0.0001, Math.min(10, rawJitter))
    }
    let autoSpawnJitterMin: number | undefined
    const rawJitterMin = (pr as { autoSpawnJitterMin?: unknown }).autoSpawnJitterMin
    if (typeof rawJitterMin === 'number' && Number.isFinite(rawJitterMin)) {
      autoSpawnJitterMin = Math.max(0, Math.min(10, rawJitterMin))
    }
    let autoSpawnJitterMax: number | undefined
    const rawJitterMax = (pr as { autoSpawnJitterMax?: unknown }).autoSpawnJitterMax
    if (typeof rawJitterMax === 'number' && Number.isFinite(rawJitterMax)) {
      autoSpawnJitterMax = Math.max(0, Math.min(10, rawJitterMax))
    }
    if (autoSpawnJitterMin !== undefined && autoSpawnJitterMax !== undefined && autoSpawnJitterMin > autoSpawnJitterMax) {
      const t = autoSpawnJitterMin
      autoSpawnJitterMin = autoSpawnJitterMax
      autoSpawnJitterMax = t
    }
    if (
      placements.length > 0 ||
      density !== undefined ||
      palettePropIds.length > 0 ||
      autoSeed !== undefined ||
      autoScaleJitter !== undefined ||
      autoSpawnJitterMin !== undefined ||
      autoSpawnJitterMax !== undefined
    ) {
      const propsOut: NonNullable<ConfiguratorSettingsRow['props']> = { placements }
      if (density !== undefined) propsOut.density = density
      if (palettePropIds.length > 0) propsOut.palettePropIds = palettePropIds
      if (autoSeed !== undefined) propsOut.autoSeed = autoSeed
      if (autoScaleJitter !== undefined) propsOut.autoScaleJitter = autoScaleJitter
      if (autoSpawnJitterMin !== undefined) propsOut.autoSpawnJitterMin = autoSpawnJitterMin
      if (autoSpawnJitterMax !== undefined) propsOut.autoSpawnJitterMax = autoSpawnJitterMax
      out.props = propsOut
    }
  }

  return Object.keys(out).length > 0 ? out : null
}
