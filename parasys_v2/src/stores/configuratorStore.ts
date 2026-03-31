import { create } from 'zustand'
import type {
  ConfiguratorLightingSettings,
  ConfiguratorPropPlacement,
  ConfiguratorPropsSettings,
  DimLimits,
  FaceGroup,
  MaterialShaderSpec,
  ParamGraphSettings,
  PublicMat,
  SurfaceUvMapping,
  TemplateParametricPreset,
  TemplateParamLimits,
} from '@shared/types'
import type { PropLibraryItem } from '@/features/configurator/props/types'
import { mergeConfiguratorLightingPatch, type LightingTabId } from '@/lib/configuratorLighting'
import { FACE_GROUPS } from '@shared/types'
import { clampDimMm, DIM_MM } from '@/lib/configuratorDimensions'
import { defaultMaterialSpec } from '@/lib/defaultMaterialSpec'
import { resolveGraphDrivenDims } from '@/lib/paramGraphEval'

type DrivenDims = ReturnType<typeof resolveGraphDrivenDims>

function uvKey(surfaceKind: string, materialId: string, faceGroup: FaceGroup): string {
  return `${surfaceKind}|${materialId}|${faceGroup}`
}

export function getUvFaceMappings(
  uvMappings: Record<string, SurfaceUvMapping> | null,
  surfaceKind: string,
  materialId: string,
): SurfaceUvMapping[] {
  return FACE_GROUPS.map((fg) => uvMappings?.[uvKey(surfaceKind, materialId, fg)] ?? {})
}

export type ConfiguratorStore = {
  configuratorId: string | null
  productName: string | null
  templateKey: string
  materials: PublicMat[]
  materialId: string | null
  defaultMaterialId: string | null
  widthMm: number
  depthMm: number
  heightMm: number
  paramGraph: ParamGraphSettings | null
  templateParamOverrides: Record<string, TemplateParametricPreset> | null
  dimLimits: DimLimits | null
  paramLimits: Record<string, TemplateParamLimits> | null
  uvMappings: Record<string, SurfaceUvMapping> | null
  lighting: ConfiguratorLightingSettings | null
  /** Decorative props: placements from configurator settings */
  propsConfig: ConfiguratorPropsSettings | null
  /** Global prop catalog (public rows) */
  propLibrary: PropLibraryItem[]
  /** When admin edits lighting, which row is selected — drives 3D gizmo highlight */
  lightingEditorPick: LightingTabId | null
  showDimensions: boolean
  loadErr: string | null

  driven: DrivenDims
  materialSpec: MaterialShaderSpec

  setDim: (axis: 'width' | 'depth' | 'height', value: number) => void
  setMaterialId: (id: string | null) => void
  setDefaultMaterialId: (id: string | null) => void
  setMaterialSpec: (spec: MaterialShaderSpec) => void
  setTemplateParam: (key: string, preset: TemplateParametricPreset) => void
  setUvMapping: (surfaceKind: string, materialId: string, faceGroup: FaceGroup, mapping: SurfaceUvMapping) => void
  mergeUvMappings: (entries: Record<string, SurfaceUvMapping>) => void
  patchLighting: (patch: Partial<ConfiguratorLightingSettings>) => void
  setLightingEditorPick: (id: LightingTabId | null) => void
  toggleDimensions: () => void
  loadConfigurator: (data: {
    id: string
    name: string
    templateKey: string
    materials: PublicMat[]
    settings: {
      defaultDims?: { widthMm?: number; depthMm?: number; heightMm?: number }
      defaultMaterialId?: string | null
      dimLimits?: DimLimits | null
      paramGraph?: ParamGraphSettings | null
      templateParams?: Record<string, TemplateParametricPreset> | null
      paramLimits?: Record<string, TemplateParamLimits> | null
      uvMappings?: Record<string, SurfaceUvMapping> | null
      lighting?: ConfiguratorLightingSettings | null
      props?: ConfiguratorPropsSettings | null
    } | null
  }) => void
  setLoadErr: (err: string | null) => void
  /** Replace materials list (e.g. after admin assign); keeps current materialId and refreshes spec */
  setMaterials: (materials: PublicMat[]) => void
  setPropLibrary: (items: PropLibraryItem[]) => void
  setPropsPlacements: (placements: ConfiguratorPropPlacement[]) => void
  /** Merge into props settings (density, palette, placements, …) */
  setPropsConfig: (patch: Partial<ConfiguratorPropsSettings>) => void
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
  defaultMaterialId: null,
  widthMm: DIM_MM.width.default,
  depthMm: DIM_MM.depth.default,
  heightMm: DIM_MM.height.default,
  paramGraph: null,
  templateParamOverrides: null,
  dimLimits: null,
  paramLimits: null,
  uvMappings: null,
  lighting: null,
  propsConfig: null,
  propLibrary: [],
  lightingEditorPick: null,
  showDimensions: true,
  loadErr: null,
  driven: deriveDriven(null, DIM_MM.width.default, DIM_MM.depth.default, DIM_MM.height.default),
  materialSpec: defaultMaterialSpec('#888888'),

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

  setDefaultMaterialId(id) {
    set({ defaultMaterialId: id })
  },

  setMaterialSpec(spec) {
    set({ materialSpec: spec })
  },

  setTemplateParam(key, preset) {
    set((s) => ({
      templateParamOverrides: {
        ...(s.templateParamOverrides ?? {}),
        [key]: { ...(s.templateParamOverrides?.[key] ?? {}), ...preset },
      },
    }))
  },

  setUvMapping(surfaceKind, materialId, faceGroup, mapping) {
    const k = uvKey(surfaceKind, materialId, faceGroup)
    set((s) => ({
      uvMappings: {
        ...(s.uvMappings ?? {}),
        [k]: { ...(s.uvMappings?.[k] ?? {}), ...mapping },
      },
    }))
  },

  mergeUvMappings(entries) {
    set((s) => ({
      uvMappings: { ...(s.uvMappings ?? {}), ...entries },
    }))
  },

  patchLighting(patch) {
    set((s) => ({
      lighting: mergeConfiguratorLightingPatch(s.lighting, patch),
    }))
  },

  setLightingEditorPick(id) {
    set({ lightingEditorPick: id })
  },

  toggleDimensions() {
    set((s) => ({ showDimensions: !s.showDimensions }))
  },

  loadConfigurator(data) {
    const mats = data.materials ?? []
    const rawPreferred = data.settings?.defaultMaterialId ?? null
    const preferred =
      rawPreferred && mats.some((m) => m.id === rawPreferred) ? rawPreferred : null
    /* Only the admin-selected default material is selected on load — never the first material implicitly */
    const mid = preferred
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
      defaultMaterialId: preferred,
      materialId: mid,
      widthMm: w,
      depthMm: dp,
      heightMm: h,
      paramGraph: pg,
      templateParamOverrides: data.settings?.templateParams ?? null,
      dimLimits: data.settings?.dimLimits ?? null,
      paramLimits: data.settings?.paramLimits ?? null,
      uvMappings: data.settings?.uvMappings ?? null,
      lighting: data.settings?.lighting ?? null,
      propsConfig: data.settings?.props ?? { placements: [] },
      lightingEditorPick: null,
      loadErr: null,
      driven: deriveDriven(pg, w, dp, h),
      materialSpec: deriveMaterialSpec(mats, mid),
    })
  },

  setLoadErr(err) {
    set({
      loadErr: err,
      configuratorId: null,
      productName: null,
      lightingEditorPick: null,
      propsConfig: null,
      propLibrary: [],
    })
  },

  setPropLibrary(items) {
    set({ propLibrary: items })
  },

  setPropsPlacements(placements) {
    set((s) => ({
      propsConfig: {
        ...(s.propsConfig ?? { placements: [] }),
        placements,
      },
    }))
  },

  setPropsConfig(patch) {
    set((s) => {
      const prev = s.propsConfig ?? { placements: [] }
      return {
        propsConfig: {
          ...prev,
          ...patch,
          placements: patch.placements !== undefined ? patch.placements : prev.placements,
        },
      }
    })
  },

  setMaterials(materials) {
    set((s) => {
      const validDefault =
        s.defaultMaterialId && materials.some((m) => m.id === s.defaultMaterialId)
          ? s.defaultMaterialId
          : null
      let nextId =
        s.materialId && materials.some((m) => m.id === s.materialId) ? s.materialId : null
      if (nextId == null && validDefault != null) nextId = validDefault
      return {
        materials,
        materialId: nextId,
        materialSpec: deriveMaterialSpec(materials, nextId),
      }
    })
  },
}))
