import { describe, expect, it } from 'vitest'
import { generatePanelSpecs } from './panelSpecs'

const BASE_INPUT = {
  width: 0.9,
  height: 1.9,
  depth: 0.35,
  dividers: 2,
  shelves: 3,
  edgeOffset: 0,
  slotOffset: 0,
  materialThickness: 0.018,
}

describe('generatePanelSpecs', () => {
  it('produces the correct number of panels', () => {
    const panels = generatePanelSpecs(BASE_INPUT)
    const back = panels.filter((p) => p.kind === 'back')
    const verticals = panels.filter((p) => p.kind === 'vertical')
    const shelves = panels.filter((p) => p.kind === 'shelf')
    expect(back).toHaveLength(1)
    expect(verticals).toHaveLength(4)
    expect(shelves).toHaveLength(5)
    expect(panels).toHaveLength(10)
  })

  it('returns 1 back + 2 verticals + 2 shelves for 0 dividers 0 shelves', () => {
    const panels = generatePanelSpecs({ ...BASE_INPUT, dividers: 0, shelves: 0 })
    expect(panels.filter((p) => p.kind === 'back')).toHaveLength(1)
    expect(panels.filter((p) => p.kind === 'vertical')).toHaveLength(2)
    expect(panels.filter((p) => p.kind === 'shelf')).toHaveLength(2)
  })

  it('assigns unique ids to all panels', () => {
    const panels = generatePanelSpecs(BASE_INPUT)
    const ids = panels.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('produces panels with positive dimensions', () => {
    const panels = generatePanelSpecs(BASE_INPUT)
    for (const p of panels) {
      expect(p.width).toBeGreaterThan(0)
      expect(p.height).toBeGreaterThan(0)
      expect(p.thickness).toBeGreaterThan(0)
    }
  })

  it('back panel matches full width and height', () => {
    const panels = generatePanelSpecs(BASE_INPUT)
    const back = panels.find((p) => p.kind === 'back')!
    expect(back.width).toBeCloseTo(BASE_INPUT.width, 4)
    expect(back.height).toBeCloseTo(BASE_INPUT.height, 4)
    expect(back.thickness).toBeCloseTo(BASE_INPUT.materialThickness, 4)
  })

  it('shelf panels have the full product width', () => {
    const panels = generatePanelSpecs(BASE_INPUT)
    const shelves = panels.filter((p) => p.kind === 'shelf')
    for (const s of shelves) {
      expect(s.width).toBeCloseTo(BASE_INPUT.width, 4)
    }
  })
})
