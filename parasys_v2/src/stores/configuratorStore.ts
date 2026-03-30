import { create } from 'zustand'
import type { MaterialShaderSpec, ParamGraphSettings, PublicMat, SurfaceUvMapping, TemplateParametricPreset, TemplateParamLimits } from '@shared/types'
import { clampDimMm, DIM_MM } from '@/lib/configuratorDimensions'
import { defaultMaterialSpec } from '@/lib/defaultMaterialSpec'
import { resolveGraphDrivenDims } from '@/lib/paramGraphEval'

type DrivenDims = ReturnType<typeof resolveGraphDrivenDims>

export type ConfiguratorStore = {
  configuratorId: string | null
  productName: string | null
  templateKey: string
  materials: PublicMat[]
  materialId: string | null
  widthMm: number
  depthMm: number
  heightMm: number
  paramGraph: ParamGraphSettings | null
  templateParamOverrides: Record<string, TemplateParametricPreset> | null
  paramLimits: Record<string, TemplateParamLimits> | null
  uvMappings: Record<string, SurfaceUvMapping> | null
  showDimensions: boolean
  loadErr: string | null

  driven: DrivenDims
  materialSpec: MaterialShaderSpec

  setDim: (axis: 'width' | 'depth' | 'height', value: number) => void
  setMaterialId: (id: string | null) => void
  setTemplateParam: (key: string, preset: TemplateParametricPreset) => void
  setUvMapping: (surfaceKey: string, mapping: SurfaceUvMapping) => void
  toggleDimensions: () => void
  loadConfigurator: (data: {
    id: string
    name: string
    templateKey: string
    materials: PublicMat[]
    settings: {
      defaultDims?: { widthMm?: number; depthMm?: number; heightMm?: number }
      paramGraph?: ParamGraphSettings | null
      templateParams?: Record<string, TemplateParametricPreset> | null
      paramLimits?: Record<string, TemplateParamLimits> | null
      uvMappings?: Record<string, SurfaceUvMapping> | null
    } | null
  }) => void
  setLoadErr: (err: string | null) => void
}

function deriveMaterialSpec(materials: PublicMat[], materialId: string | null): MaterialShaderSpec {
  const m = materials.find((x) => x.id === materialId)
  const hex = m?.colorHex ?? '#c4a882'
  if (m?.shader) return m.shader
  return defaultMaterialSpec(hex)
}

function deriveDriven(
  paramGraph: ParamGraphSettings | null,
  widthMm: number,
  depthMm: number,
  heightMm: number,
): DrivenDims {
  return resolveGraphDrivenDims(paramGraph, { widthMm, depthMm, heightMm })
}

export const useConfiguratorStore = create<ConfiguratorStore>((set, get) => ({
  configuratorId: null,
  productName: null,
  templateKey: 'tv_console',
  materials: [],
  materialId: null,
  widthMm: DIM_MM.width.default,
  depthMm: DIM_MM.depth.default,
  heightMm: DIM_MM.height.default,
  paramGraph: null,
  templateParamOverrides: null,
  paramLimits: null,
  uvMappings: null,
  showDimensions: true,
  loadErr: null,
  driven: deriveDriven(null, DIM_MM.width.default, DIM_MM.depth.default, DIM_MM.height.default),
  materialSpec: defaultMaterialSpec('#c4a882'),

  setDim(axis, value) {
    const clamped = clampDimMm(axis, value)
    const key = axis === 'width' ? 'widthMm' : axis === 'depth' ? 'depthMm' : 'heightMm'
    const s = get()
    const next = { ...s, [key]: clamped }
    set({
      [key]: clamped,
      driven: deriveDriven(s.paramGraph, next.widthMm, next.depthMm, next.heightMm),
    })
  },

  setMaterialId(id) {
    set((s) => ({
      materialId: id,
      materialSpec: deriveMaterialSpec(s.materials, id),
    }))
  },

  setTemplateParam(key, preset) {
    set((s) => ({
      templateParamOverrides: {
        ...(s.templateParamOverrides ?? {}),
        [key]: { ...(s.templateParamOverrides?.[key] ?? {}), ...preset },
      },
    }))
  },

  setUvMapping(surfaceKey, mapping) {
    set((s) => ({
      uvMappings: {
        ...(s.uvMappings ?? {}),
        [surfaceKey]: { ...(s.uvMappings?.[surfaceKey] ?? {}), ...mapping },
      },
    }))
  },

  toggleDimensions() {
    set((s) => ({ showDimensions: !s.showDimensions }))
  },

  loadConfigurator(data) {
    const mats = data.materials ?? []
    const mid = mats[0]?.id ?? null
    const d = data.settings?.defaultDims
    const w = clampDimMm('width', d?.widthMm ?? DIM_MM.width.default)
    const dp = clampDimMm('depth', d?.depthMm ?? DIM_MM.depth.default)
    const h = clampDimMm('height', d?.heightMm ?? DIM_MM.height.default)
    const pg = data.settings?.paramGraph ?? null
    set({
      configuratorId: data.id,
      productName: data.name,
      templateKey: data.templateKey || 'tv_console',
      materials: mats,
      materialId: mid,
      widthMm: w,
      depthMm: dp,
      heightMm: h,
      paramGraph: pg,
      templateParamOverrides: data.settings?.templateParams ?? null,
      paramLimits: data.settings?.paramLimits ?? null,
      uvMappings: data.settings?.uvMappings ?? null,
      loadErr: null,
      driven: deriveDriven(pg, w, dp, h),
      materialSpec: deriveMaterialSpec(mats, mid),
    })
  },

  setLoadErr(err) {
    set({ loadErr: err, configuratorId: null, productName: null })
  },
}))
