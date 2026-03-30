import type { MaterialShaderSpec } from '../db/schema'

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

function normalizeHex(h: string | undefined, fallback: string): string {
  const t = (h ?? fallback).trim()
  return HEX_RE.test(t) ? t : fallback
}

function randomId(): string {
  return `L${Math.random().toString(36).slice(2, 10)}`
}

export function defaultMaterialShader(baseColorHex: string): MaterialShaderSpec {
  return {
    version: 1,
    baseColorHex: normalizeHex(baseColorHex, '#c4a882'),
    globalRoughness: 0.48,
    globalMetalness: 0.06,
    ambientOcclusion: 1,
    layers: [
      {
        id: randomId(),
        mix: 0.35,
        blendMode: 'normal',
        noiseType: 'fbm',
        noiseScale: 2.2,
        noiseStrength: 0.45,
        roughness: 0.62,
        metalness: 0.02,
        colorHex: '#ffffff',
      },
      {
        id: randomId(),
        mix: 0.2,
        blendMode: 'multiply',
        noiseType: 'voronoi',
        noiseScale: 6,
        noiseStrength: 0.25,
        roughness: 0.75,
        metalness: 0,
        colorHex: '#8b7355',
      },
    ],
  }
}
