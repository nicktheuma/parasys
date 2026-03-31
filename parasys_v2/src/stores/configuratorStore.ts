import { create } from 'zustand'
import type {
  CameraSettings,
  ConfiguratorLightingSettings,
  ConfiguratorPropPlacement,
  ConfiguratorPropsSettings,
  DimensionUiSettings,
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
  dimensionUi: DimensionUiSettings | null
  camera: CameraSettings | null
  paramLimits: Record<string, TemplateParamLimits> | null
  uvMappings: Record<string, SurfaceUvMapping> | null
  lighting: ConfiguratorLightingSettings | null
  /** Decorative props: placements from configurator settings */
  propsConfig: ConfiguratorPropsSettings | null
  /** Admin: selected prop placement row id (3D pick) */
  selectedPropPlacementId: string | null
  /** Global prop catalog (public rows) */
  propLibrary: PropLibraryItem[]
  /** When admin edits lighting, which row is selected — drives 3D gizmo highlight */
  lightingEditorPick: LightingTabId | null
  cameraEditorEnabled: boolean
  dimensionEditorEnabled: boolean
  panelSelectionEnabled: boolean
  dimensionPickMode: boolean
  dimensionPickPendingPoint: [number, number, number] | null
  dimensionPickPendingAnchor: { panelId: string; vertexIndex: number } | null
  dimensionPickHoverPoint: [number, number, number] | null
  showVertexDebug: boolean
  cameraPreviewNonce: number
  showDimensions: boolean
  loadErr: string | null

  driven: DrivenDims
  materialSpec: MaterialShaderSpec
  materialHydrated: boolean

  setDim: (axis: 'width' | 'depth' | 'height', value: number) => void
  setMaterialId: (id: string | null) => void
  setDefaultMaterialId: (id: string | null) => void
  setMaterialSpec: (spec: MaterialShaderSpec) => void
  setTemplateParam: (key: string, preset: TemplateParametricPreset) => void
  setUvMapping: (surfaceKind: string, materialId: string, faceGroup: FaceGroup, mapping: SurfaceUvMapping) => void
  mergeUvMappings: (entries: Record<string, SurfaceUvMapping>) => void
  patchLighting: (patch: Partial<ConfiguratorLightingSettings>) => void
  setLightingEditorPick: (id: LightingTabId | null) => void
  setCameraEditorEnabled: (enabled: boolean) => void
  setDimensionEditorEnabled: (enabled: boolean) => void
  setPanelSelectionEnabled: (enabled: boolean) => void
  setDimensionPickMode: (enabled: boolean) => void
  pushDimensionPickPoint: (
    point: [number, number, number],
    anchor?: { panelId: string; vertexIndex: number },
  ) => void
  setDimensionPickHoverPoint: (point: [number, number, number] | null) => void
  setShowVertexDebug: (enabled: boolean) => void
  removeCustomDimension: (id: string) => void
  previewCameraStartView: () => void
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
      dimensionUi?: DimensionUiSettings | null
      camera?: CameraSettings | null
      paramGraph?: ParamGraphSettings | null
      templateParams?: Record<string, TemplateParametricPreset> | null
      paramLimits?: Record<string, TemplateParamLimits> | null
      uvMappings?: Record<string, SurfaceUvMapping> | null
      lighting?: ConfiguratorLightingSettings | null
      props?: ConfiguratorPropsSettings | null
    } | null
  }, opts?: { deferMaterialHydration?: boolean }) => void
  hydrateSelectedMaterialSpec: () => void
  setLoadErr: (err: string | null) => void
  /** Replace materials list (e.g. after admin assign); keeps current materialId and refreshes spec */
  setMaterials: (materials: PublicMat[]) => void
  setPropLibrary: (items: PropLibraryItem[]) => void
  setPropsPlacements: (placements: ConfiguratorPropPlacement[]) => void
  /** Merge into props settings (density, palette, placements, …) */
  setPropsConfig: (patch: Partial<ConfiguratorPropsSettings>) => void
  setSelectedPropPlacementId: (id: string | null) => void
  setDimensionUi: (patch: Partial<DimensionUiSettings>) => void
  setCamera: (patch: Partial<CameraSettings>) => void

  /** Registered by the 3D canvas to support high-quality PDF renders (cover + orthographic views). */
  capturePdfViews: null | (() => Promise<{
    planPngDataUrl: string
    sectionPngDataUrl: string
    elevationPngDataUrl: string
  }>)
  setCapturePdfViews: (fn: ConfiguratorStore['capturePdfViews']) => void
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
  dimensionUi: null,
  camera: null,
  paramLimits: null,
  uvMappings: null,
  lighting: null,
  propsConfig: null,
  selectedPropPlacementId: null,
  propLibrary: [],
  lightingEditorPick: null,
  cameraEditorEnabled: false,
  dimensionEditorEnabled: false,
  panelSelectionEnabled: true,
  dimensionPickMode: false,
  dimensionPickPendingPoint: null,
  dimensionPickPendingAnchor: null,
  dimensionPickHoverPoint: null,
  showVertexDebug: false,
  cameraPreviewNonce: 0,
  showDimensions: true,
  loadErr: null,
  driven: deriveDriven(null, DIM_MM.width.default, DIM_MM.depth.default, DIM_MM.height.default),
  materialSpec: defaultMaterialSpec('#888888'),
  materialHydrated: true,
  capturePdfViews: null,

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
      materialHydrated: true,
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
  setCameraEditorEnabled(enabled) {
    set({ cameraEditorEnabled: enabled })
  },
  setDimensionEditorEnabled(enabled) {
    set({ dimensionEditorEnabled: enabled })
  },
  setPanelSelectionEnabled(enabled) {
    set({ panelSelectionEnabled: enabled })
  },
  setDimensionPickMode(enabled) {
    set({
      dimensionPickMode: enabled,
      dimensionPickPendingPoint: enabled ? get().dimensionPickPendingPoint : null,
      dimensionPickPendingAnchor: enabled ? get().dimensionPickPendingAnchor : null,
      dimensionPickHoverPoint: enabled ? get().dimensionPickHoverPoint : null,
    })
  },
  pushDimensionPickPoint(point, anchor) {
    set((s) => {
      const du = s.dimensionUi ?? {}
      const pending = s.dimensionPickPendingPoint
      const pendingAnchor = s.dimensionPickPendingAnchor
      if (!pending) {
        return {
          dimensionPickPendingPoint: point,
          dimensionPickPendingAnchor: anchor ?? null,
          dimensionPickHoverPoint: null,
        }
      }
      const dims = [...(du.customDimensions ?? [])]
      dims.push({
        id: crypto.randomUUID(),
        name: `Dim ${dims.length + 1}`,
        start: pending,
        end: point,
        gapScale: 1,
        startAnchor: pendingAnchor ?? undefined,
        endAnchor: anchor ?? undefined,
      })
      return {
        dimensionPickPendingPoint: null,
        dimensionPickPendingAnchor: null,
        dimensionPickHoverPoint: null,
        dimensionUi: { ...du, customDimensions: dims },
      }
    })
  },
  setDimensionPickHoverPoint(point) {
    set({ dimensionPickHoverPoint: point })
  },
  setShowVertexDebug(enabled) {
    set({ showVertexDebug: enabled })
  },
  removeCustomDimension(id) {
    set((s) => {
      const du = s.dimensionUi ?? {}
      const dims = (du.customDimensions ?? []).filter((d) => d.id !== id)
      return { dimensionUi: { ...du, customDimensions: dims } }
    })
  },
  previewCameraStartView() {
    set((s) => ({ cameraPreviewNonce: s.cameraPreviewNonce + 1 }))
  },

  toggleDimensions() {
    set((s) => ({ showDimensions: !s.showDimensions }))
  },

  loadConfigurator(data, opts) {
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
    const defer = Boolean(opts?.deferMaterialHydration)
    const initialSpec = defer ? defaultMaterialSpec('#ffffff') : deriveMaterialSpec(mats, mid)
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
      dimensionUi: data.settings?.dimensionUi ?? null,
      camera: data.settings?.camera ?? null,
      paramLimits: data.settings?.paramLimits ?? null,
      uvMappings: data.settings?.uvMappings ?? null,
      lighting: data.settings?.lighting ?? null,
      propsConfig: data.settings?.props ?? { placements: [] },
      selectedPropPlacementId: null,
      lightingEditorPick: null,
      cameraEditorEnabled: false,
      dimensionEditorEnabled: false,
      panelSelectionEnabled: true,
      dimensionPickMode: false,
      dimensionPickPendingPoint: null,
      dimensionPickPendingAnchor: null,
      dimensionPickHoverPoint: null,
      showVertexDebug: false,
      loadErr: null,
      driven: deriveDriven(pg, w, dp, h),
      materialSpec: initialSpec,
      materialHydrated: !defer,
    })
  },

  hydrateSelectedMaterialSpec() {
    set((s) => ({
      materialSpec: deriveMaterialSpec(s.materials, s.materialId),
      materialHydrated: true,
    }))
  },

  setLoadErr(err) {
    set({
      loadErr: err,
      configuratorId: null,
      productName: null,
      lightingEditorPick: null,
      cameraEditorEnabled: false,
      dimensionEditorEnabled: false,
      panelSelectionEnabled: true,
      dimensionPickMode: false,
      dimensionPickPendingPoint: null,
      dimensionPickPendingAnchor: null,
      dimensionPickHoverPoint: null,
      showVertexDebug: false,
      propsConfig: null,
      selectedPropPlacementId: null,
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

  setSelectedPropPlacementId(id) {
    set({ selectedPropPlacementId: id })
  },

  setDimensionUi(patch) {
    set((s) => ({
      dimensionUi: {
        ...(s.dimensionUi ?? {}),
        ...patch,
      },
    }))
  },

  setCamera(patch) {
    set((s) => ({
      camera: {
        ...(s.camera ?? {}),
        ...patch,
      },
    }))
  },

  setCapturePdfViews(fn) {
    set({ capturePdfViews: fn })
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
