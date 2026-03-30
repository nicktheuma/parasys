import { describe, expect, it } from 'vitest'
import { evaluateParamGraph, resolveGraphDrivenDims } from './paramGraphEval'
import type { ParamGraphNode, ParamGraphEdge, ParamGraphSettings } from '@shared/types'

const dims = { widthMm: 500, depthMm: 280, heightMm: 120 }

function mkNode(id: string, type: ParamGraphNode['type'], data: ParamGraphNode['data'] = {}): ParamGraphNode {
  return { id, type, position: { x: 0, y: 0 }, data }
}

function mkEdge(id: string, source: string, target: string, sh?: string, th?: string): ParamGraphEdge {
  return { id, source, target, sourceHandle: sh ?? null, targetHandle: th ?? null }
}

describe('evaluateParamGraph', () => {
  it('returns empty result for null/empty graph', () => {
    expect(evaluateParamGraph(null, dims)).toEqual({
      ok: true,
      nodeValues: {},
      geoValues: {},
      outputValue: null,
      outputNodeId: null,
    })
  })

  it('evaluates dimension -> output', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('d1', 'dimension', { dimension: 'width' }),
        mkNode('o1', 'output'),
      ],
      edges: [mkEdge('e1', 'd1', 'o1', 'out', 'in')],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(true)
    expect(result.outputValue).toBe(500)
  })

  it('evaluates constant -> binary -> output', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('c1', 'constant', { value: 10 }),
        mkNode('c2', 'constant', { value: 3 }),
        mkNode('b1', 'binary', { op: 'mul' }),
        mkNode('o1', 'output'),
      ],
      edges: [
        mkEdge('e1', 'c1', 'b1', 'out', 'a'),
        mkEdge('e2', 'c2', 'b1', 'out', 'b'),
        mkEdge('e3', 'b1', 'o1', 'out', 'in'),
      ],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(true)
    expect(result.outputValue).toBe(30)
  })

  it('evaluates ghSlider with integer input mode', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('s1', 'ghSlider', { value: 3.7, inputMode: 'integer' }),
        mkNode('o1', 'output'),
      ],
      edges: [mkEdge('e1', 's1', 'o1', 'out', 'in')],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(true)
    expect(result.outputValue).toBe(4)
  })

  it('evaluates ghPoint with multi-port outputs', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('p1', 'ghPoint', { x: 10, y: 20, z: 30 }),
        mkNode('o1', 'output'),
      ],
      edges: [mkEdge('e1', 'p1', 'o1', 'x', 'in')],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(true)
    expect(result.outputValue).toBe(10)
  })

  it('detects cycles', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('b1', 'binary', { op: 'add' }),
        mkNode('b2', 'binary', { op: 'add' }),
        mkNode('o1', 'output'),
      ],
      edges: [
        mkEdge('e1', 'b1', 'b2', 'out', 'a'),
        mkEdge('e2', 'b2', 'b1', 'out', 'a'),
        mkEdge('e3', 'b2', 'o1', 'out', 'in'),
      ],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('cycle')
  })

  it('evaluates a chain: dimension -> binary(add) -> output', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('d1', 'dimension', { dimension: 'height' }),
        mkNode('c1', 'constant', { value: 50 }),
        mkNode('b1', 'binary', { op: 'add' }),
        mkNode('o1', 'output'),
      ],
      edges: [
        mkEdge('e1', 'd1', 'b1', 'out', 'a'),
        mkEdge('e2', 'c1', 'b1', 'out', 'b'),
        mkEdge('e3', 'b1', 'o1', 'out', 'in'),
      ],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(true)
    expect(result.outputValue).toBe(170)
  })

  it('reports error when output has no connection', () => {
    const graph: ParamGraphSettings = {
      nodes: [mkNode('o1', 'output')],
      edges: [],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('could not be computed')
  })

  it('populates geoValues with GeoPoint for ghPoint nodes', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('p1', 'ghPoint', { x: 3, y: 4, z: 0 }),
        mkNode('o1', 'output'),
      ],
      edges: [mkEdge('e1', 'p1', 'o1', 'out', 'in')],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(true)
    const geo = result.geoValues['p1:out']
    expect(geo).toBeDefined()
    expect(geo?.type).toBe('point')
    if (geo?.type === 'point') {
      expect(geo.x).toBe(3)
      expect(geo.y).toBe(4)
      expect(geo.z).toBe(0)
    }
  })

  it('populates geoValues with GeoCurve for ghLine nodes', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('p1', 'ghPoint', { x: 0, y: 0, z: 0 }),
        mkNode('p2', 'ghPoint', { x: 10, y: 0, z: 0 }),
        mkNode('l1', 'ghLine'),
        mkNode('o1', 'output'),
      ],
      edges: [
        mkEdge('e1', 'p1', 'l1', 'out', 'Ax'),
        mkEdge('e2', 'p2', 'l1', 'out', 'Bx'),
        mkEdge('e3', 'l1', 'o1', 'L', 'in'),
      ],
    }
    const result = evaluateParamGraph(graph, dims)
    expect(result.ok).toBe(true)
    const geo = result.geoValues['l1:out']
    expect(geo).toBeDefined()
    expect(geo?.type).toBe('curve')
    expect(result.outputValue).toBeCloseTo(10)
  })
})

describe('resolveGraphDrivenDims', () => {
  it('overrides width when output has applyTo=width', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('c1', 'constant', { value: 800 }),
        mkNode('o1', 'output', { applyTo: 'width' }),
      ],
      edges: [mkEdge('e1', 'c1', 'o1', 'out', 'in')],
    }
    const result = resolveGraphDrivenDims(graph, dims)
    expect(result.overrideAxis).toBe('width')
    expect(result.widthMm).toBe(800)
    expect(result.depthMm).toBe(280)
    expect(result.heightMm).toBe(120)
  })

  it('clamps overridden value to DIM_MM bounds', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('c1', 'constant', { value: 99999 }),
        mkNode('o1', 'output', { applyTo: 'width' }),
      ],
      edges: [mkEdge('e1', 'c1', 'o1', 'out', 'in')],
    }
    const result = resolveGraphDrivenDims(graph, dims)
    expect(result.widthMm).toBe(2400)
  })

  it('passes through sliders when no applyTo', () => {
    const graph: ParamGraphSettings = {
      nodes: [
        mkNode('c1', 'constant', { value: 100 }),
        mkNode('o1', 'output'),
      ],
      edges: [mkEdge('e1', 'c1', 'o1', 'out', 'in')],
    }
    const result = resolveGraphDrivenDims(graph, dims)
    expect(result.overrideAxis).toBeNull()
    expect(result.widthMm).toBe(500)
  })
})
