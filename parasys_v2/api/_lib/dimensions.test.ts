import { describe, expect, it } from 'vitest'
import { normalizeSettings, validateParamGraph } from './dimensions'

describe('normalizeSettings', () => {
  it('returns null for null/undefined', () => {
    expect(normalizeSettings(null)).toBeNull()
    expect(normalizeSettings(undefined)).toBeNull()
  })

  it('clamps defaultDims within bounds', () => {
    const result = normalizeSettings({
      defaultDims: { widthMm: 99999, depthMm: -10, heightMm: 400 },
    })
    expect(result?.defaultDims?.widthMm).toBe(2400)
    expect(result?.defaultDims?.depthMm).toBe(200)
    expect(result?.defaultDims?.heightMm).toBe(400)
  })

  it('sanitizes templateParams', () => {
    const result = normalizeSettings({
      templateParams: {
        open_shelf: {
          dividers: 5.7,
          shelves: 20,
          interlockEnabled: true,
          edgeOffset: 0.5,
        },
      },
    })
    const tp = result?.templateParams?.open_shelf
    expect(tp?.dividers).toBe(6)
    expect(tp?.shelves).toBe(12)
    expect(tp?.interlockEnabled).toBe(true)
    expect(tp?.edgeOffset).toBe(0.5)
  })

  it('strips invalid templateParams entries', () => {
    const result = normalizeSettings({
      templateParams: {
        good: { dividers: 2 },
        bad: 'not an object' as unknown as Record<string, unknown>,
      } as unknown as Record<string, { dividers?: number }>,
    })
    expect(result?.templateParams?.good).toBeDefined()
    expect(result?.templateParams?.bad).toBeUndefined()
  })

  it('returns null when input has no valid data', () => {
    expect(normalizeSettings({})).toBeNull()
  })
})

describe('validateParamGraph', () => {
  it('returns null for non-object input', () => {
    expect(validateParamGraph(null)).toBeNull()
    expect(validateParamGraph(undefined)).toBeNull()
    expect(validateParamGraph('string')).toBeNull()
  })

  it('validates a simple graph', () => {
    const graph = {
      nodes: [
        { id: 'c1', type: 'constant', position: { x: 0, y: 0 }, data: { value: 10 } },
        { id: 'o1', type: 'output', position: { x: 100, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'c1', target: 'o1' },
      ],
    }
    const result = validateParamGraph(graph)
    expect(result).not.toBeNull()
    expect(result!.nodes).toHaveLength(2)
    expect(result!.edges).toHaveLength(1)
  })

  it('rejects nodes with invalid types', () => {
    const graph = {
      nodes: [
        { id: 'n1', type: 'INVALID_TYPE', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [],
    }
    const result = validateParamGraph(graph)
    expect(result).not.toBeNull()
    expect(result!.nodes).toHaveLength(0)
  })

  it('strips edges referencing non-existent nodes', () => {
    const graph = {
      nodes: [
        { id: 'c1', type: 'constant', position: { x: 0, y: 0 }, data: { value: 5 } },
      ],
      edges: [
        { id: 'e1', source: 'c1', target: 'MISSING' },
      ],
    }
    const result = validateParamGraph(graph)
    expect(result!.edges).toHaveLength(0)
  })

  it('rejects graphs exceeding node limit', () => {
    const nodes = Array.from({ length: 201 }, (_, i) => ({
      id: `n${i}`,
      type: 'constant',
      position: { x: 0, y: 0 },
      data: { value: 0 },
    }))
    const result = validateParamGraph({ nodes, edges: [] })
    expect(result).toBeNull()
  })
})
