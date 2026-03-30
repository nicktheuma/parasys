import type { ConfiguratorSettingsRow, ParamGraphNode, ParamGraphSettings } from '../../db/schema'
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

  if (input.paramGraph !== undefined) out.paramGraph = validateParamGraph(input.paramGraph)

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

  return Object.keys(out).length > 0 ? out : null
}
