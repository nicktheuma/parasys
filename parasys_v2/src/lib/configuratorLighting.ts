import type { ConfiguratorLightingSettings, SceneLightSettings } from '@shared/types'

/** Deep-merge lighting patches (nested lights). */
export function mergeConfiguratorLightingPatch(
  prev: ConfiguratorLightingSettings | null | undefined,
  patch: Partial<ConfiguratorLightingSettings>,
): ConfiguratorLightingSettings {
  const p = prev ?? {}
  return {
    ...p,
    ...patch,
    directional0: { ...(p.directional0 ?? {}), ...(patch.directional0 ?? {}) },
    directional1: { ...(p.directional1 ?? {}), ...(patch.directional1 ?? {}) },
    directional2: { ...(p.directional2 ?? {}), ...(patch.directional2 ?? {}) },
    keySpot: { ...(p.keySpot ?? {}), ...(patch.keySpot ?? {}) },
    fillPoint: { ...(p.fillPoint ?? {}), ...(patch.fillPoint ?? {}) },
  }
}

const D0: SceneLightSettings = {
  position: [3, 4, 2],
  intensity: 1.8,
  color: '#fff5e6',
  softness: 0,
}
const D1: SceneLightSettings = {
  position: [-2, 2, 3],
  intensity: 0.6,
  color: '#e6f0ff',
  softness: 0,
}
const D2: SceneLightSettings = {
  position: [0, 3, -3],
  intensity: 0.8,
  color: '#ffffff',
  softness: 0,
}
const KS: SceneLightSettings = {
  position: [1, 2, 1],
  intensity: 2.4,
  color: '#ffffff',
  softness: 1,
}
const FP: SceneLightSettings = {
  position: [-2, -0.5, -2],
  intensity: 1.2,
  color: '#ffffff',
  softness: 0,
}

export type ResolvedConfiguratorLighting = {
  ambientIntensity: number
  directional0: SceneLightSettings
  directional1: SceneLightSettings
  directional2: SceneLightSettings
  keySpot: SceneLightSettings
  fillPoint: SceneLightSettings
  environmentBlur: number
}

export const DEFAULT_RESOLVED_LIGHTING: ResolvedConfiguratorLighting = {
  ambientIntensity: 1.2 / 3,
  directional0: { ...D0 },
  directional1: { ...D1 },
  directional2: { ...D2 },
  keySpot: { ...KS },
  fillPoint: { ...FP },
  environmentBlur: 0.6,
}

function mergeLight(base: SceneLightSettings, patch?: Partial<SceneLightSettings> | null): SceneLightSettings {
  if (!patch) return { ...base }
  return {
    position: patch.position ?? base.position,
    intensity: patch.intensity ?? base.intensity,
    color: patch.color ?? base.color,
    softness: patch.softness ?? base.softness ?? 0,
  }
}

export function resolveConfiguratorLighting(
  patch: ConfiguratorLightingSettings | null | undefined,
): ResolvedConfiguratorLighting {
  const p = patch ?? {}
  return {
    ambientIntensity: p.ambientIntensity ?? DEFAULT_RESOLVED_LIGHTING.ambientIntensity,
    directional0: mergeLight(DEFAULT_RESOLVED_LIGHTING.directional0, p.directional0),
    directional1: mergeLight(DEFAULT_RESOLVED_LIGHTING.directional1, p.directional1),
    directional2: mergeLight(DEFAULT_RESOLVED_LIGHTING.directional2, p.directional2),
    keySpot: mergeLight(DEFAULT_RESOLVED_LIGHTING.keySpot, p.keySpot),
    fillPoint: mergeLight(DEFAULT_RESOLVED_LIGHTING.fillPoint, p.fillPoint),
    environmentBlur: p.environmentBlur ?? DEFAULT_RESOLVED_LIGHTING.environmentBlur,
  }
}

export const LIGHTING_TAB_IDS = [
  { id: 'ambient', label: 'Ambient (stage)' },
  { id: 'directional0', label: 'Directional — warm' },
  { id: 'directional1', label: 'Directional — cool' },
  { id: 'directional2', label: 'Directional — rim' },
  { id: 'keySpot', label: 'Spot — key (shadows)' },
  { id: 'fillPoint', label: 'Point — fill' },
  { id: 'environment', label: 'Environment (HDR blur)' },
] as const

export type LightingTabId = (typeof LIGHTING_TAB_IDS)[number]['id']
