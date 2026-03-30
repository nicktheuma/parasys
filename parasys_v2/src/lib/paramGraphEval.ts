import type { ParamGraphEdge, ParamGraphNode, ParamGraphSettings } from '@shared/types'
import type { DimKey } from './configuratorDimensions'
import { clampDimMm } from './configuratorDimensions'
import {
  type GeoValue,
  geoCurve,
  geoNum,
  geoPoint,
  geoToNumber,
  geoToPoint,
} from './geoValue'

export type ParamGraphEvalResult = {
  ok: boolean
  error?: string
  nodeValues: Record<string, number>
  geoValues: Record<string, GeoValue>
  outputValue: number | null
  outputNodeId: string | null
}

function applyOp(op: ParamGraphNode['data']['op'] | undefined, a: number, b: number): number {
  switch (op) {
    case 'mul':
      return a * b
    case 'min':
      return Math.min(a, b)
    case 'max':
      return Math.max(a, b)
    case 'add':
    default:
      return a + b
  }
}

function incomingEdges(edges: ParamGraphEdge[], targetId: string): ParamGraphEdge[] {
  return edges.filter((e) => e.target === targetId)
}

function getSourceValue(edge: ParamGraphEdge, values: Record<string, number>): number | undefined {
  const h = edge.sourceHandle ?? 'out'
  const key = `${edge.source}:${h}`
  const v = values[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const fallback = values[edge.source]
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback
  return undefined
}

function getInput(
  edges: ParamGraphEdge[],
  targetId: string,
  targetHandle: string,
  values: Record<string, number>,
): number | undefined {
  const match = incomingEdges(edges, targetId).find((e) => e.targetHandle === targetHandle)
  if (!match) return undefined
  return getSourceValue(match, values)
}

function getInputOrLegacy(
  edges: ParamGraphEdge[],
  targetId: string,
  targetHandle: string,
  values: Record<string, number>,
  legacy: 'a' | 'b' | 'single',
): number | undefined {
  const v = getInput(edges, targetId, targetHandle, values)
  if (v !== undefined) return v
  const list = incomingEdges(edges, targetId)
  if (legacy === 'single') {
    const e = list[0]
    return e ? getSourceValue(e, values) : undefined
  }
  if (list.length >= 2) {
    const order = [...list].sort((x, y) => x.id.localeCompare(y.id))
    const e = legacy === 'a' ? order[0] : order[1]
    return e ? getSourceValue(e, values) : undefined
  }
  return undefined
}

function setPort(values: Record<string, number>, nodeId: string, port: string, v: number) {
  values[`${nodeId}:${port}`] = v
  if (port === 'out') values[nodeId] = v
}

function numOrDefault(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d
}

function applyInputMode(mode: ParamGraphNode['data']['inputMode'], raw: number): number {
  switch (mode) {
    case 'integer':
      return Math.round(raw)
    case 'angle':
      return (raw * Math.PI) / 180
    case 'boolean':
      return raw !== 0 ? 1 : 0
    case 'number':
    default:
      return raw
  }
}

function evalComputeNode(
  n: ParamGraphNode,
  edges: ParamGraphEdge[],
  values: Record<string, number>,
): number | undefined {
  const d = n.data

  switch (n.type) {
    case 'ghPanel': {
      const x = getInput(edges, n.id, 'tx', values) ?? numOrDefault(d.x, 0)
      const y = getInput(edges, n.id, 'ty', values) ?? numOrDefault(d.y, 0)
      const z = getInput(edges, n.id, 'tz', values) ?? numOrDefault(d.z, 0)
      setPort(values, n.id, 'x', x)
      setPort(values, n.id, 'y', y)
      setPort(values, n.id, 'z', z)
      return Math.hypot(x, y, z)
    }
    case 'ghPoint':
    case 'ghVector': {
      const x = getInput(edges, n.id, 'tx', values) ?? numOrDefault(d.x, 0)
      const y = getInput(edges, n.id, 'ty', values) ?? numOrDefault(d.y, 0)
      const z = getInput(edges, n.id, 'tz', values) ?? numOrDefault(d.z, 0)
      setPort(values, n.id, 'x', x)
      setPort(values, n.id, 'y', y)
      setPort(values, n.id, 'z', z)
      return Math.hypot(x, y, z)
    }
    case 'ghMove': {
      const px = getInput(edges, n.id, 'Px', values) ?? numOrDefault(d.x, 0)
      const py = getInput(edges, n.id, 'Py', values) ?? numOrDefault(d.y, 0)
      const pz = getInput(edges, n.id, 'Pz', values) ?? numOrDefault(d.z, 0)
      const vx = getInput(edges, n.id, 'Vx', values) ?? 0
      const vy = getInput(edges, n.id, 'Vy', values) ?? 0
      const vz = getInput(edges, n.id, 'Vz', values) ?? 0
      const ox = px + vx
      const oy = py + vy
      const oz = pz + vz
      setPort(values, n.id, 'x', ox)
      setPort(values, n.id, 'y', oy)
      setPort(values, n.id, 'z', oz)
      return Math.hypot(ox, oy, oz)
    }
    case 'ghLine':
    case 'ghCrv': {
      const ax = getInput(edges, n.id, 'Ax', values) ?? numOrDefault(d.x, 0)
      const ay = getInput(edges, n.id, 'Ay', values) ?? numOrDefault(d.y, 0)
      const az = getInput(edges, n.id, 'Az', values) ?? numOrDefault(d.z, 0)
      const bx = getInput(edges, n.id, 'Bx', values) ?? 0
      const by = getInput(edges, n.id, 'By', values) ?? 0
      const bz = getInput(edges, n.id, 'Bz', values) ?? 0
      const L = Math.hypot(bx - ax, by - ay, bz - az)
      setPort(values, n.id, 'L', L)
      return L
    }
    case 'ghExtrude': {
      const C = getInput(edges, n.id, 'C', values) ?? 0
      const H = getInput(edges, n.id, 'tH', values) ?? numOrDefault(d.height, 100)
      const c = C > 0 ? C : 1
      const V = c * H
      setPort(values, n.id, 'V', V)
      return V
    }
    case 'ghCap': {
      const h = getInput(edges, n.id, 'H', values) ?? numOrDefault(d.height, 0)
      const o = d.cap === true ? h : 0
      setPort(values, n.id, 'O', o)
      return o
    }
    case 'ghChamfer':
    case 'ghBevel':
    case 'ghFillet': {
      const R = getInput(edges, n.id, 'tR', values) ?? numOrDefault(d.radius, 0)
      const E = getInput(edges, n.id, 'tE', values)
      const out = E !== undefined && E > 0 ? Math.min(R, E / 2) : R
      setPort(values, n.id, 'R', out)
      return out
    }
    case 'binary': {
      let va = getInputOrLegacy(edges, n.id, 'a', values, 'a')
      let vb = getInputOrLegacy(edges, n.id, 'b', values, 'b')
      if (va === undefined || vb === undefined) {
        const inc = incomingEdges(edges, n.id)
        if (inc.length >= 2) {
          const order = [...inc].sort((x, y) => x.id.localeCompare(y.id))
          va = va ?? getSourceValue(order[0]!, values)
          vb = vb ?? getSourceValue(order[1]!, values)
        }
      }
      if (va === undefined || vb === undefined) return undefined
      return applyOp(d.op, va, vb)
    }
    case 'output': {
      return getInputOrLegacy(edges, n.id, 'in', values, 'single')
    }
    default:
      return undefined
  }
}

function getGeoPort(
  geoValues: Record<string, GeoValue>,
  edges: ParamGraphEdge[],
  targetId: string,
  targetHandle: string,
): GeoValue | undefined {
  const match = incomingEdges(edges, targetId).find((e) => e.targetHandle === targetHandle)
  if (!match) return undefined
  const h = match.sourceHandle ?? 'out'
  return geoValues[`${match.source}:${h}`] ?? geoValues[match.source]
}

function setGeoPort(geoValues: Record<string, GeoValue>, nodeId: string, port: string, v: GeoValue) {
  geoValues[`${nodeId}:${port}`] = v
  if (port === 'out') geoValues[nodeId] = v
}

function evalGeoNode(
  n: ParamGraphNode,
  edges: ParamGraphEdge[],
  values: Record<string, number>,
  geoValues: Record<string, GeoValue>,
): void {
  const d = n.data

  switch (n.type) {
    case 'ghPoint':
    case 'ghVector': {
      const x = getInput(edges, n.id, 'tx', values) ?? numOrDefault(d.x, 0)
      const y = getInput(edges, n.id, 'ty', values) ?? numOrDefault(d.y, 0)
      const z = getInput(edges, n.id, 'tz', values) ?? numOrDefault(d.z, 0)
      const pt = geoPoint(x, y, z)
      setGeoPort(geoValues, n.id, 'out', pt)
      setGeoPort(geoValues, n.id, 'x', geoNum(x))
      setGeoPort(geoValues, n.id, 'y', geoNum(y))
      setGeoPort(geoValues, n.id, 'z', geoNum(z))
      break
    }
    case 'ghMove': {
      const srcPt = geoToPoint(getGeoPort(geoValues, edges, n.id, 'Px'))
      const px = srcPt?.x ?? numOrDefault(d.x, 0)
      const py = srcPt?.y ?? numOrDefault(d.y, 0)
      const pz = srcPt?.z ?? numOrDefault(d.z, 0)
      const vx = getInput(edges, n.id, 'Vx', values) ?? 0
      const vy = getInput(edges, n.id, 'Vy', values) ?? 0
      const vz = getInput(edges, n.id, 'Vz', values) ?? 0
      const result = geoPoint(px + vx, py + vy, pz + vz)
      setGeoPort(geoValues, n.id, 'out', result)
      setGeoPort(geoValues, n.id, 'x', geoNum(result.x))
      setGeoPort(geoValues, n.id, 'y', geoNum(result.y))
      setGeoPort(geoValues, n.id, 'z', geoNum(result.z))
      break
    }
    case 'ghLine':
    case 'ghCrv': {
      const ptA = geoToPoint(getGeoPort(geoValues, edges, n.id, 'Ax'))
      const ptB = geoToPoint(getGeoPort(geoValues, edges, n.id, 'Bx'))
      const a = ptA ?? geoPoint(numOrDefault(d.x, 0), numOrDefault(d.y, 0), numOrDefault(d.z, 0))
      const b = ptB ?? geoPoint(0, 0, 0)
      const curve = geoCurve([{ x: a.x, y: a.y, z: a.z }, { x: b.x, y: b.y, z: b.z }])
      const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
      setGeoPort(geoValues, n.id, 'out', curve)
      setGeoPort(geoValues, n.id, 'L', geoNum(L))
      break
    }
    case 'ghExtrude': {
      const curve = getGeoPort(geoValues, edges, n.id, 'C')
      const H = getInput(edges, n.id, 'tH', values) ?? numOrDefault(d.height, 100)
      const profileLength = curve ? (geoToNumber(curve) ?? 1) : 1
      const volume = geoNum(profileLength * H)
      setGeoPort(geoValues, n.id, 'out', volume)
      setGeoPort(geoValues, n.id, 'V', volume)
      break
    }
    default:
      break
  }
}

const SOURCE_TYPES = new Set<ParamGraphNode['type']>(['dimension', 'constant', 'ghSlider'])

/**
 * Topological sort via Kahn's algorithm.
 * Returns nodes in evaluation order, or null if a cycle is detected.
 */
function topoSort(
  nodes: ParamGraphNode[],
  edges: ParamGraphEdge[],
): ParamGraphNode[] | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    adj.get(e.source)!.push(e.target)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: ParamGraphNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node) sorted.push(node)
    for (const neighbor of adj.get(id) ?? []) {
      const d = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, d)
      if (d === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== nodes.length) return null
  return sorted
}

export function evaluateParamGraph(
  graph: ParamGraphSettings | null | undefined,
  dims: { widthMm: number; depthMm: number; heightMm: number },
): ParamGraphEvalResult {
  const empty: ParamGraphEvalResult = {
    ok: true,
    nodeValues: {},
    geoValues: {},
    outputValue: null,
    outputNodeId: null,
  }
  if (!graph?.nodes?.length) return empty

  const { nodes, edges } = graph
  const values: Record<string, number> = {}
  const geoValues: Record<string, GeoValue> = {}

  const ordered = topoSort(nodes, edges)
  if (!ordered) {
    return {
      ok: false,
      error: 'Graph contains a cycle \u2014 remove circular connections.',
      nodeValues: {},
      geoValues: {},
      outputValue: null,
      outputNodeId: null,
    }
  }

  for (const n of ordered) {
    if (n.type === 'dimension') {
      const k = n.data.dimension
      let v: number
      if (k === 'width') v = dims.widthMm
      else if (k === 'depth') v = dims.depthMm
      else if (k === 'height') v = dims.heightMm
      else v = dims.widthMm
      values[n.id] = v
      setPort(values, n.id, 'out', v)
      setGeoPort(geoValues, n.id, 'out', geoNum(v))
    } else if (n.type === 'constant') {
      const v = typeof n.data.value === 'number' && Number.isFinite(n.data.value) ? n.data.value : 0
      values[n.id] = v
      setPort(values, n.id, 'out', v)
      setGeoPort(geoValues, n.id, 'out', geoNum(v))
    } else if (n.type === 'ghSlider') {
      const raw = typeof n.data.value === 'number' && Number.isFinite(n.data.value) ? n.data.value : 0
      const v = applyInputMode(n.data.inputMode, raw)
      values[n.id] = v
      setPort(values, n.id, 'out', v)
      setGeoPort(geoValues, n.id, 'out', geoNum(v))
    } else if (!SOURCE_TYPES.has(n.type)) {
      const next = evalComputeNode(n, edges, values)
      if (next !== undefined) {
        values[n.id] = next
        setPort(values, n.id, 'out', next)
      }
      evalGeoNode(n, edges, values, geoValues)
    }
  }

  const outNodes = nodes.filter((n) => n.type === 'output')
  const primaryOut = outNodes[0]
  let outputValue: number | null = null
  if (primaryOut) {
    const v = values[primaryOut.id]
    outputValue = typeof v === 'number' && Number.isFinite(v) ? v : null
    if (outputValue === null) {
      return {
        ok: false,
        error: 'Graph output could not be computed (check connections).',
        nodeValues: values,
        geoValues,
        outputValue: null,
        outputNodeId: primaryOut.id,
      }
    }
  }

  return {
    ok: true,
    nodeValues: values,
    geoValues,
    outputValue,
    outputNodeId: primaryOut?.id ?? null,
  }
}

const dimKeyToClamp: Record<'width' | 'depth' | 'height', DimKey> = {
  width: 'width',
  depth: 'depth',
  height: 'height',
}

export function resolveGraphDrivenDims(
  graph: ParamGraphSettings | null | undefined,
  sliders: { widthMm: number; depthMm: number; heightMm: number },
): {
  widthMm: number
  depthMm: number
  heightMm: number
  eval: ParamGraphEvalResult
  overrideAxis: 'width' | 'depth' | 'height' | null
} {
  const ev = evaluateParamGraph(graph, sliders)
  let widthMm = sliders.widthMm
  let depthMm = sliders.depthMm
  let heightMm = sliders.heightMm
  let overrideAxis: 'width' | 'depth' | 'height' | null = null

  if (ev.ok && ev.outputValue !== null && graph?.nodes?.length) {
    const out = graph.nodes.find((n) => n.type === 'output')
    const apply = out?.data.applyTo
    if (apply === 'width' || apply === 'depth' || apply === 'height') {
      overrideAxis = apply
      const clamped = clampDimMm(dimKeyToClamp[apply], ev.outputValue)
      if (apply === 'width') widthMm = clamped
      else if (apply === 'depth') depthMm = clamped
      else heightMm = clamped
    }
  }

  return { widthMm, depthMm, heightMm, eval: ev, overrideAxis }
}
