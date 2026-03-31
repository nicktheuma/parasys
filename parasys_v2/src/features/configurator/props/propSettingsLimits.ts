/** Shared UI + runtime clamps for configurator prop settings (admin sliders + engine). */
export const PROP_SETTING_MIN = 0.0001
export const PROP_SETTING_MAX = 10
export const PROP_SIGNED_MIN = -10
export const PROP_SIGNED_MAX = 10
/** Rotation sliders use degrees in UI; ±10° matches PROP_SETTING_MAX magnitude. */
export const PROP_ROTATION_DEG_MIN = -10
export const PROP_ROTATION_DEG_MAX = 10

export function clampPropUnsigned(v: number): number {
  if (!Number.isFinite(v)) return PROP_SETTING_MIN
  return Math.min(PROP_SETTING_MAX, Math.max(PROP_SETTING_MIN, v))
}

export function clampPropSigned(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(PROP_SIGNED_MAX, Math.max(PROP_SIGNED_MIN, v))
}

export function clampRotationDeg(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(PROP_ROTATION_DEG_MAX, Math.max(PROP_ROTATION_DEG_MIN, v))
}

/** Density is stored 0..10; auto-fill uses fraction 0..1 (10 = full). */
export function densityToFillFraction(density: number | undefined): number {
  const d = density ?? 0
  if (!Number.isFinite(d)) return 0
  return Math.min(1, Math.max(0, d / PROP_SETTING_MAX))
}

export function clampIntCount(v: number, min = 1, max = 10): number {
  const n = Math.round(v)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}
