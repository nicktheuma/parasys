import type { MaterialShaderLayer, MaterialShaderSpec } from '../../db/schema'
import { defaultMaterialShader } from '../../shared/materialDefaults.js'

export { defaultMaterialShader } from '../../shared/materialDefaults.js'

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function normalizeHex(h: string | undefined, fallback: string): string {
  const t = (h ?? fallback).trim()
  return HEX_RE.test(t) ? t : fallback
}

function randomId(): string {
  return `L${Math.random().toString(36).slice(2, 10)}`
}

const VALID_NOISE: Set<string> = new Set(['fbm', 'voronoi', 'simplex', 'ridged', 'turbulence', 'marble'])

function normalizeLayer(raw: unknown, fallbackColor: string): MaterialShaderLayer | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const blendMode =
    o.blendMode === 'multiply' || o.blendMode === 'overlay' || o.blendMode === 'normal'
      ? o.blendMode
      : 'normal'
  const noiseType =
    typeof o.noiseType === 'string' && VALID_NOISE.has(o.noiseType)
      ? (o.noiseType as MaterialShaderLayer['noiseType'])
      : 'fbm'
  const scaleX = clamp(typeof o.noiseScale === 'number' ? o.noiseScale : 2, 0.01, 50)
  const layer: MaterialShaderLayer = {
    id: typeof o.id === 'string' && o.id ? o.id : randomId(),
    mix: clamp(typeof o.mix === 'number' ? o.mix : 0.5, 0, 1),
    blendMode,
    noiseType,
    noiseScale: scaleX,
    noiseStrength: clamp(typeof o.noiseStrength === 'number' ? o.noiseStrength : 0.3, 0, 2),
    roughness: clamp(typeof o.roughness === 'number' ? o.roughness : 0.5, 0, 1),
    metalness: clamp(typeof o.metalness === 'number' ? o.metalness : 0, 0, 1),
    colorHex: normalizeHex(typeof o.colorHex === 'string' ? o.colorHex : undefined, fallbackColor),
  }
  if (typeof o.noiseScaleY === 'number') layer.noiseScaleY = clamp(o.noiseScaleY, 0.01, 50)
  if (typeof o.noiseScaleZ === 'number') layer.noiseScaleZ = clamp(o.noiseScaleZ, 0.01, 50)
  if (typeof o.displacementStrength === 'number') layer.displacementStrength = clamp(o.displacementStrength, 0, 1)
  if (typeof o.normalStrength === 'number') layer.normalStrength = clamp(o.normalStrength, 0, 2)
  if (typeof o.noiseOffsetX === 'number') layer.noiseOffsetX = clamp(o.noiseOffsetX, -20, 20)
  if (typeof o.noiseOffsetY === 'number') layer.noiseOffsetY = clamp(o.noiseOffsetY, -20, 20)
  if (typeof o.noiseOffsetZ === 'number') layer.noiseOffsetZ = clamp(o.noiseOffsetZ, -20, 20)
  if (typeof o.noiseRotationX === 'number') layer.noiseRotationX = clamp(o.noiseRotationX, -Math.PI * 2, Math.PI * 2)
  if (typeof o.noiseRotationY === 'number') layer.noiseRotationY = clamp(o.noiseRotationY, -Math.PI * 2, Math.PI * 2)
  if (typeof o.noiseRotationZ === 'number') layer.noiseRotationZ = clamp(o.noiseRotationZ, -Math.PI * 2, Math.PI * 2)
  return layer
}

export function normalizeMaterialShader(
  input: unknown,
  fallbackBaseHex: string,
): MaterialShaderSpec | null {
  if (input == null) return null
  if (typeof input !== 'object') return defaultMaterialShader(fallbackBaseHex)
  const o = input as Record<string, unknown>
  const base = normalizeHex(typeof o.baseColorHex === 'string' ? o.baseColorHex : undefined, fallbackBaseHex)
  const rawLayers = Array.isArray(o.layers) ? o.layers : []
  const layers: MaterialShaderLayer[] = []
  for (const raw of rawLayers.slice(0, 3)) {
    const L = normalizeLayer(raw, base)
    if (L) layers.push(L)
  }
  return {
    version: 1,
    baseColorHex: base,
    globalRoughness: clamp(typeof o.globalRoughness === 'number' ? o.globalRoughness : 0.5, 0, 1),
    globalMetalness: clamp(typeof o.globalMetalness === 'number' ? o.globalMetalness : 0.05, 0, 1),
    ambientOcclusion: clamp(typeof o.ambientOcclusion === 'number' ? o.ambientOcclusion : 1, 0, 1),
    layers,
  }
}
