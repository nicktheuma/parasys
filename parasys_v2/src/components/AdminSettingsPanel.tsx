import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchJson } from '@/lib/api'
import { DIM_MM } from '@/lib/configuratorDimensions'
import { useConfiguratorStore } from '@/stores/configuratorStore'
import { getTemplateParametricPreset } from '@/features/parametric/mvp1/templateParametricPresets'
import { defaultMaterialSpec } from '@/lib/defaultMaterialSpec'
import {
  LIGHTING_TAB_IDS,
  resolveConfiguratorLighting,
  type LightingTabId,
} from '@/lib/configuratorLighting'
import { copyUvMappingsBetweenMaterials } from '@/lib/uvMappingsCopy'
import type {
  CameraSettings,
  ConfiguratorPropPlacement,
  DimensionUiSettings,
  TemplateParametricPreset,
  TemplateParamLimits,
  ParamRange,
  SurfaceUvMapping,
  FaceGroup,
  DimLimits,
  PublicMat,
} from '@shared/types'
import type { BlendMode, MaterialShaderLayer, MaterialShaderSpec, NoiseType } from '@/lib/materialShader'
import { ColorSwatchInput } from './ColorSwatchInput'
import { MatSliderRow, MatSliderRowScaleOptional } from './MatSliderControls'
import {
  AdminTabCameraIcon,
  AdminTabDimOverlayIcon,
  AdminTabDimsIcon,
  AdminTabLightingIcon,
  AdminTabMaterialsIcon,
  AdminTabParamsIcon,
  AdminTabPropsIcon,
  AdminTabUvIcon,
} from './icons'
import { FACE_GROUPS } from '@shared/types'
import { PANEL_TEMPLATE_KEYS } from '@/features/configurator/templates/registry'
import { anchorLabelList, panelAnchorsFromDimsMm } from '@/features/configurator/props/panelPropAnchors'
import {
  clampIntCount,
  clampPropSigned,
  clampPropUnsigned,
  clampRotationDeg,
  PROP_ROTATION_DEG_MAX,
  PROP_ROTATION_DEG_MIN,
  PROP_SETTING_MAX,
  PROP_SETTING_MIN,
  PROP_SIGNED_MAX,
  PROP_SIGNED_MIN,
} from '@/features/configurator/props/propSettingsLimits'
import type { PropLibraryItem } from '@/features/configurator/props/types'
import styles from './adminSettingsPanel.module.css'

type Tab = 'dimensions' | 'dimensionOverlay' | 'camera' | 'parameters' | 'materials' | 'uv' | 'lighting' | 'props'

type NumericParamKey = Exclude<
  keyof TemplateParametricPreset,
  'interlockEnabled' | 'showBackPanel' | 'showVerticalPanels' | 'showShelfPanels'
>

const PARAM_DEFS: { key: NumericParamKey; label: string; step: number; fallbackMin: number; fallbackMax: number }[] = [
  { key: 'dividers', label: 'Dividers', step: 1, fallbackMin: 0, fallbackMax: 12 },
  { key: 'shelves', label: 'Shelves', step: 1, fallbackMin: 0, fallbackMax: 12 },
  { key: 'edgeOffset', label: 'Edge offset', step: 0.001, fallbackMin: 0, fallbackMax: 0.1 },
  { key: 'slotOffsetFactor', label: 'Slot offset', step: 0.05, fallbackMin: 0, fallbackMax: 2 },
  { key: 'interlockClearanceFactor', label: 'Interlock clearance', step: 0.01, fallbackMin: 0, fallbackMax: 1 },
  { key: 'interlockLengthFactor', label: 'Interlock length', step: 0.05, fallbackMin: 1, fallbackMax: 5 },
  { key: 'panelThickness', label: 'Panel thickness (m)', step: 0.001, fallbackMin: 0.001, fallbackMax: 0.1 },
]

function limitKey(k: NumericParamKey): keyof TemplateParamLimits {
  return k as keyof TemplateParamLimits
}

const SURFACE_KINDS: { value: string; label: string }[] = [
  { value: 'back', label: 'Back panel' },
  { value: 'vertical', label: 'Vertical dividers' },
  { value: 'shelf', label: 'Shelves' },
]

const FACE_LABELS: Record<FaceGroup, string> = {
  front: 'Front (+Z)',
  back: 'Back (-Z)',
  right: 'Right (+X)',
  left: 'Left (-X)',
  top: 'Top (+Y)',
  bottom: 'Bottom (-Y)',
}

const UV_FIELDS: { key: keyof SurfaceUvMapping; label: string; min: number; max: number; step: number; fallback: number }[] = [
  { key: 'scaleX', label: 'Scale X', min: 0.01, max: 20, step: 0.01, fallback: 1 },
  { key: 'scaleY', label: 'Scale Y', min: 0.01, max: 20, step: 0.01, fallback: 1 },
  { key: 'scaleZ', label: 'Scale Z', min: 0.01, max: 20, step: 0.01, fallback: 1 },
  { key: 'offsetX', label: 'Offset X', min: -10, max: 10, step: 0.01, fallback: 0 },
  { key: 'offsetY', label: 'Offset Y', min: -10, max: 10, step: 0.01, fallback: 0 },
  { key: 'rotationX', label: 'Rotation X', min: -Math.PI, max: Math.PI, step: 0.01, fallback: 0 },
  { key: 'rotationY', label: 'Rotation Y', min: -Math.PI, max: Math.PI, step: 0.01, fallback: 0 },
  { key: 'rotationZ', label: 'Rotation Z', min: -Math.PI, max: Math.PI, step: 0.01, fallback: 0 },
]

function uvCompoundKey(surfaceKind: string, materialId: string, faceGroup: FaceGroup): string {
  return `${surfaceKind}|${materialId}|${faceGroup}`
}

type AdminMaterial = {
  id: string
  configuratorId: string
  folder: string
  name: string
  colorHex: string
  shader: MaterialShaderSpec | null
  enabled: boolean
  createdAt: string
  linkedViaAssignment?: boolean
}

function adminMaterialToPublic(m: AdminMaterial): PublicMat {
  return {
    id: m.id,
    name: m.name,
    folder: m.folder,
    colorHex: m.colorHex,
    shader: m.shader,
  }
}

function formatMatOptionLabel(m: { folder: string; name: string }): string {
  const f = m.folder.trim()
  return f ? `${f} / ${m.name}` : m.name
}

function cloneShaderAndSwatch(source: AdminMaterial): { shader: MaterialShaderSpec; colorHex: string } {
  const shader = source.shader
    ? structuredClone(source.shader)
    : defaultMaterialSpec(source.colorHex)
  return { shader, colorHex: source.colorHex }
}

function newLayer(): MaterialShaderLayer {
  return {
    id: `L${Date.now().toString(36)}`,
    mix: 0.3,
    blendMode: 'normal',
    noiseType: 'fbm',
    noiseScale: 3,
    noiseStrength: 0.35,
    roughness: 0.55,
    metalness: 0.05,
    colorHex: '#ffffff',
    displacementStrength: 0,
    normalStrength: 0,
  }
}

const DIM_AXES = ['width', 'depth', 'height'] as const

export function AdminSettingsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const {
    configuratorId,
    templateKey,
    widthMm,
    depthMm,
    heightMm,
    templateParamOverrides,
    dimLimits,
    dimensionUi,
    camera,
    paramLimits,
    uvMappings,
    lighting,
    materialId,
    defaultMaterialId,
    materials,
    materialSpec: storeMatSpec,
    setDim,
    setTemplateParam,
    setUvMapping,
    mergeUvMappings,
    patchLighting,
    setMaterialId,
    setDefaultMaterialId,
    setMaterialSpec,
    setMaterials,
    setLightingEditorPick,
    setCameraEditorEnabled,
    setDimensionEditorEnabled,
    setPanelSelectionEnabled,
    setDimensionPickMode,
    setShowVertexDebug,
    showVertexDebug,
    dimensionPickMode,
    dimensionPickPendingPoint,
    propsConfig,
    selectedPropPlacementId,
    setSelectedPropPlacementId,
    setPropsPlacements,
    setPropsConfig,
    setDimensionUi,
    setCamera,
    previewCameraStartView,
    removeCustomDimension,
  } = useConfiguratorStore()

  const [tab, setTab] = useState<Tab>('dimensions')

  const defaults = getTemplateParametricPreset(templateKey)
  const overrides = templateParamOverrides?.[templateKey] ?? {}
  const merged: TemplateParametricPreset = { ...defaults, ...overrides }
  const limits: TemplateParamLimits = paramLimits?.[templateKey] ?? {}

  const currentMat = materials.find((m) => m.id === materialId)
  const currentMatLabel = currentMat ? currentMat.name : 'No material'
  const resolvedLight = resolveConfiguratorLighting(lighting)

  const [localLimits, setLocalLimits] = useState<TemplateParamLimits>(limits)
  const [localDimLimits, setLocalDimLimits] = useState<DimLimits>(dimLimits ?? {})
  const [localDimensionUi, setLocalDimensionUi] = useState<DimensionUiSettings>(
    dimensionUi ?? {
      lineScale: 1,
      textScale: 1,
      endpointScale: 1,
      endpointType: 'dot',
      lineColor: '#747474',
      textColor: '#747474',
      highlightOutlineColor: '#ffd84d',
      highlightFaceColor: '#fff07a',
      lockTextColorToLine: false,
      lockFaceColorToOutline: false,
      showUnits: true,
      unitSystem: 'mm',
      textGapScale: 1,
      gapScaleWidth: 1,
      gapScaleHeight: 1,
      gapScaleDepth: 1,
      debugVertexColor: '#111111',
      debugVertexSize: 0.0036,
      pickPointSize: 0.012,
    },
  )
  const [localCamera, setLocalCamera] = useState<CameraSettings>(
    camera ?? { preset: 'front', distanceFactor: 2.6 },
  )
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [hasAdminSession, setHasAdminSession] = useState<boolean | null>(null)
  const [uvSurfaceKind, setUvSurfaceKind] = useState('back')
  const [expandedFace, setExpandedFace] = useState<FaceGroup | null>(null)
  const [lightingPick, setLightingPick] = useState<LightingTabId>('ambient')
  const [adminPropCatalog, setAdminPropCatalog] = useState<PropLibraryItem[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const session = await fetchJson<{ ok: boolean; role?: string }>('/api/auth/session', {
        method: 'GET',
      })
      if (cancelled) return
      setHasAdminSession(Boolean(session.ok && session.data?.ok && session.data?.role === 'admin'))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const panelPropsOk = PANEL_TEMPLATE_KEYS.has(templateKey)
  const mergedForAnchors: TemplateParametricPreset = { ...defaults, ...overrides }
  const shelves = mergedForAnchors.shelves ?? 2
  const edgeOffset = mergedForAnchors.edgeOffset ?? 0
  const widthM = widthMm * 0.001
  const depthM = depthMm * 0.001
  const heightM = heightMm * 0.001
  const autoThickness = Math.max(0.002, Math.min(widthM, depthM, heightM) * 0.03)
  const materialThicknessM =
    mergedForAnchors.panelThickness != null ? Math.max(0.001, mergedForAnchors.panelThickness) : autoThickness
  const slotOffsetFactor = mergedForAnchors.slotOffsetFactor ?? 0.5
  const slotOffset = materialThicknessM * slotOffsetFactor

  const shelfAnchorOptions = useMemo(() => {
    if (!panelPropsOk) return [] as { id: string; label: string }[]
    const anchors = panelAnchorsFromDimsMm(
      widthMm,
      depthMm,
      heightMm,
      shelves,
      materialThicknessM,
      edgeOffset,
      slotOffset,
    )
    return anchorLabelList(anchors)
  }, [panelPropsOk, widthMm, depthMm, heightMm, shelves, materialThicknessM, edgeOffset, slotOffset])

  const placements = propsConfig?.placements ?? []
  const catalogForPlace = useMemo(
    () => adminPropCatalog.filter((x) => x.kind === 'placeholder_cube' || x.kind === 'glb'),
    [adminPropCatalog],
  )

  function patchPlacement(id: string, patch: Partial<ConfiguratorPropPlacement>) {
    const cur = useConfiguratorStore.getState().propsConfig?.placements ?? []
    setPropsPlacements(cur.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function removePlacementRow(id: string) {
    const cur = useConfiguratorStore.getState().propsConfig?.placements ?? []
    if (useConfiguratorStore.getState().selectedPropPlacementId === id) {
      setSelectedPropPlacementId(null)
    }
    setPropsPlacements(cur.filter((p) => p.id !== id))
  }

  function addPlacementRow() {
    const cur = useConfiguratorStore.getState().propsConfig?.placements ?? []
    const firstProp = catalogForPlace[0]?.id ?? ''
    const firstAnchor = shelfAnchorOptions[0]?.id ?? 'shelf:0'
    setPropsPlacements([
      ...cur,
      {
        id: crypto.randomUUID(),
        kind: 'primitive',
        primitiveType: 'box',
        propLibraryId: firstProp || undefined,
        anchorId: firstAnchor,
        scaleBias: 1,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        arrayCountX: 1,
        arrayCountY: 1,
        arrayCountZ: 1,
        arrayScaleJitter: 0,
        arrayScaleJitterIncrement: 0,
        arraySpacingX: 0,
        arraySpacingY: 0,
        arraySpacingZ: 0,
        positionOffsetX: 0,
        positionOffsetY: 0,
        positionOffsetZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        groupOffsetX: 0,
        groupOffsetY: 0,
        groupOffsetZ: 0,
      },
    ])
  }

  const paletteIds = propsConfig?.palettePropIds ?? []
  function togglePaletteProp(id: string) {
    const next = paletteIds.includes(id) ? paletteIds.filter((x) => x !== id) : [...paletteIds, id]
    setPropsConfig({ palettePropIds: next })
  }

  useEffect(() => {
    if (tab !== 'props' || !configuratorId) return
    let cancelled = false
    void (async () => {
      const r = await fetchJson<{ items: PropLibraryItem[] }>('/api/admin/props', { method: 'GET' })
      if (cancelled) return
      if (r.ok && r.data?.items) setAdminPropCatalog(r.data.items.filter((x) => x.enabled !== false))
      else setAdminPropCatalog([])
    })()
    return () => {
      cancelled = true
    }
  }, [tab, configuratorId])

  useEffect(() => {
    if (tab === 'lighting') setLightingEditorPick(lightingPick)
    else setLightingEditorPick(null)
  }, [tab, lightingPick, setLightingEditorPick])
  useEffect(() => {
    setCameraEditorEnabled(tab === 'camera')
  }, [tab, setCameraEditorEnabled])
  useEffect(() => {
    setDimensionEditorEnabled(tab === 'dimensionOverlay')
  }, [tab, setDimensionEditorEnabled])
  useEffect(() => {
    setPanelSelectionEnabled(tab !== 'dimensionOverlay')
  }, [tab, setPanelSelectionEnabled])
  useEffect(() => {
    if (tab !== 'dimensionOverlay') setDimensionPickMode(false)
  }, [tab, setDimensionPickMode])

  useEffect(() => {
    setLocalDimensionUi(
      dimensionUi ?? {
        lineScale: 1,
        textScale: 1,
        endpointScale: 1,
        endpointType: 'dot',
        lineColor: '#747474',
        textColor: '#747474',
        highlightOutlineColor: '#ffd84d',
        highlightFaceColor: '#fff07a',
        lockTextColorToLine: false,
        lockFaceColorToOutline: false,
        showUnits: true,
        unitSystem: 'mm',
        textGapScale: 1,
        gapScaleWidth: 1,
        gapScaleHeight: 1,
        gapScaleDepth: 1,
        debugVertexColor: '#111111',
        debugVertexSize: 0.0036,
        pickPointSize: 0.012,
      },
    )
  }, [dimensionUi])
  useEffect(() => {
    setLocalCamera(camera ?? { preset: 'front', distanceFactor: 2.6 })
  }, [camera])

  useEffect(
    () => () => {
      setLightingEditorPick(null)
      setCameraEditorEnabled(false)
      setDimensionEditorEnabled(false)
      setPanelSelectionEnabled(true)
      setDimensionPickMode(false)
      setSelectedPropPlacementId(null)
    },
    [
      setLightingEditorPick,
      setCameraEditorEnabled,
      setDimensionEditorEnabled,
      setPanelSelectionEnabled,
      setDimensionPickMode,
      setSelectedPropPlacementId,
    ],
  )

  // Materials tab state
  const [adminMaterials, setAdminMaterials] = useState<AdminMaterial[]>([])
  const [allMaterials, setAllMaterials] = useState<AdminMaterial[]>([])
  const [matLoading, setMatLoading] = useState(false)
  const [editingMat, setEditingMat] = useState<AdminMaterial | null>(null)
  const [matSpec, setMatSpec] = useState<MaterialShaderSpec | null>(null)
  const [matSaving, setMatSaving] = useState(false)
  const [matMsg, setMatMsg] = useState<string | null>(null)
  const [matListMsg, setMatListMsg] = useState<string | null>(null)
  const [matCopyingId, setMatCopyingId] = useState<string | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [bulkUnassigning, setBulkUnassigning] = useState(false)
  const preEditSpecRef = useRef<MaterialShaderSpec | null>(null)

  useEffect(() => {
    if (matSpec) setMaterialSpec(matSpec)
  }, [matSpec, setMaterialSpec])

  const loadMaterials = useCallback(async () => {
    if (!configuratorId) return
    setMatLoading(true)
    const [own, all] = await Promise.all([
      fetchJson<{ items: AdminMaterial[] }>(`/api/admin/materials?configuratorId=${encodeURIComponent(configuratorId)}`),
      fetchJson<{ items: AdminMaterial[] }>('/api/admin/materials?configuratorId=__all__'),
    ])
    if (own.ok && own.data?.items) {
      const items = own.data.items
      setAdminMaterials(items)
      setMaterials(items.map(adminMaterialToPublic))
    }
    if (all.ok && all.data?.items) setAllMaterials(all.data.items)
    setMatLoading(false)
  }, [configuratorId, setMaterials])

  useEffect(() => {
    if (tab === 'materials') void loadMaterials()
  }, [tab, loadMaterials])

  const setParam = useCallback(
    (key: NumericParamKey, value: number | undefined) => {
      setTemplateParam(templateKey, { [key]: value })
    },
    [templateKey, setTemplateParam],
  )

  const setInterlock = useCallback(
    (enabled: boolean) => {
      setTemplateParam(templateKey, { interlockEnabled: enabled })
    },
    [templateKey, setTemplateParam],
  )

  function setLimit(paramKey: NumericParamKey, side: 'min' | 'max', raw: string) {
    const lk = limitKey(paramKey)
    const prev = localLimits[lk] ?? {}
    const num = raw.trim() === '' ? undefined : Number(raw)
    const next: ParamRange = { ...prev, [side]: Number.isFinite(num) ? num : undefined }
    setLocalLimits({ ...localLimits, [lk]: next })
  }

  function setDimLimit(dimKey: keyof DimLimits, side: 'min' | 'max', raw: string) {
    const prev = localDimLimits[dimKey] ?? {}
    const num = raw.trim() === '' ? undefined : Number(raw)
    const next: ParamRange = { ...prev, [side]: Number.isFinite(num) ? num : undefined }
    setLocalDimLimits({ ...localDimLimits, [dimKey]: next })
  }

  function onUvFaceChange(faceGroup: FaceGroup, field: keyof SurfaceUvMapping, value: number) {
    if (!materialId) return
    setUvMapping(uvSurfaceKind, materialId, faceGroup, { [field]: value })
  }

  function applyUvCopyFrom(sourceId: string) {
    if (!materialId) return
    const src = adminMaterials.find((m) => m.id === sourceId)
    if (!src) return
    if (
      !window.confirm(
        `Replace UV mapping for "${currentMatLabel}" with UV from "${formatMatOptionLabel(src)}"?`,
      )
    )
      return
    const merged = copyUvMappingsBetweenMaterials(uvMappings, sourceId, materialId)
    mergeUvMappings(merged)
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!configuratorId) return
    if (hasAdminSession === false) {
      setSaveMsg('Unauthorized on this domain. Log in at /admin on this same host.')
      return
    }
    setSaving(true)
    setSaveMsg(null)

    const r = await fetchJson(
      `/api/admin/configurators/${encodeURIComponent(configuratorId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          settings: {
            defaultDims: { widthMm, depthMm, heightMm },
            defaultMaterialId,
            dimLimits: localDimLimits,
            dimensionUi: localDimensionUi,
            camera: localCamera,
            templateParams: { [templateKey]: merged },
            paramLimits: { [templateKey]: localLimits },
            uvMappings: uvMappings ?? {},
            ...(lighting && Object.keys(lighting).length > 0 ? { lighting } : {}),
            props: propsConfig ?? { placements: [] },
          },
        }),
      },
    )
    setSaving(false)
    setSaveMsg(r.ok ? 'Saved' : (r.error ?? 'Save failed'))
    if (r.ok) setTimeout(() => setSaveMsg(null), 2500)
  }

  // Material editing helpers
  const updateLayer = useCallback((index: number, patch: Partial<MaterialShaderLayer>) => {
    setMatSpec((prev) => {
      if (!prev) return prev
      const layers = [...prev.layers]
      const cur = layers[index]
      if (!cur) return prev
      layers[index] = { ...cur, ...patch }
      return { ...prev, layers }
    })
  }, [])

  function startEditMat(mat: AdminMaterial) {
    preEditSpecRef.current = storeMatSpec
    setEditingMat(mat)
    setMatSpec(mat.shader ?? defaultMaterialSpec(mat.colorHex))
    setMatMsg(null)
  }

  function cancelEditMat() {
    if (preEditSpecRef.current) {
      setMaterialSpec(preEditSpecRef.current)
      preEditSpecRef.current = null
    }
    setEditingMat(null)
    setMatSpec(null)
    setMatMsg(null)
  }

  async function saveMat() {
    if (!editingMat || !matSpec || !configuratorId) return
    setMatSaving(true)
    setMatMsg(null)
    const r = await fetchJson<{ item: AdminMaterial }>(
      `/api/admin/materials/${encodeURIComponent(editingMat.id)}?configuratorId=${encodeURIComponent(editingMat.configuratorId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          folder: editingMat.folder,
          name: editingMat.name,
          colorHex: editingMat.colorHex,
          shader: matSpec,
        }),
      },
    )
    setMatSaving(false)
    if (!r.ok) {
      setMatMsg(r.error ?? 'Save failed')
      return
    }
    setMatMsg('Saved')
    preEditSpecRef.current = null
    setEditingMat(null)
    setMatSpec(null)
    void loadMaterials()
    setTimeout(() => setMatMsg(null), 2500)
  }

  async function toggleMatEnabled(mat: AdminMaterial) {
    const r = await fetchJson(
      `/api/admin/materials/${encodeURIComponent(mat.id)}?configuratorId=${encodeURIComponent(mat.configuratorId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !mat.enabled }),
      },
    )
    if (r.ok) void loadMaterials()
  }

  async function assignMatToThis(matId: string, matConfigId: string) {
    if (!configuratorId) return
    await fetchJson(
      `/api/admin/materials/${encodeURIComponent(matId)}?configuratorId=${encodeURIComponent(matConfigId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ assignTo: [configuratorId] }),
      },
    )
    void loadMaterials()
  }

  async function unassignMatFromThis(matId: string, matConfigId: string) {
    if (!configuratorId) return
    await fetchJson(
      `/api/admin/materials/${encodeURIComponent(matId)}?configuratorId=${encodeURIComponent(matConfigId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ unassignFrom: [configuratorId] }),
      },
    )
    void loadMaterials()
  }

  function applyCopyIntoEditor(sourceId: string) {
    const source = allMaterials.find((m) => m.id === sourceId)
    if (!source || !editingMat) return
    const { shader, colorHex } = cloneShaderAndSwatch(source)
    setMatSpec(shader)
    setEditingMat({ ...editingMat, colorHex })
    setMatMsg(null)
  }

  async function applyCopyMatSettings(target: AdminMaterial, sourceId: string) {
    const source = allMaterials.find((m) => m.id === sourceId)
    if (!source) return
    if (
      !window.confirm(
        `Replace shader and swatch colour for "${target.name}" with settings from "${formatMatOptionLabel(source)}"?`,
      )
    )
      return
    const { shader, colorHex } = cloneShaderAndSwatch(source)
    setMatCopyingId(target.id)
    setMatListMsg(null)
    const r = await fetchJson(
      `/api/admin/materials/${encodeURIComponent(target.id)}?configuratorId=${encodeURIComponent(target.configuratorId)}`,
      { method: 'PATCH', body: JSON.stringify({ shader, colorHex }) },
    )
    setMatCopyingId(null)
    if (!r.ok) {
      setMatListMsg(r.error ?? 'Copy failed')
      return
    }
    setMatListMsg('Settings copied.')
    void loadMaterials()
    setTimeout(() => setMatListMsg(null), 2500)
  }

  async function unassignAllLinkedExceptDefault() {
    if (!configuratorId) return
    const toUnassign = adminMaterials.filter(
      (m) => m.linkedViaAssignment && m.id !== defaultMaterialId,
    )
    if (toUnassign.length === 0) return
    const msg =
      defaultMaterialId != null
        ? `Remove ${toUnassign.length} linked material(s)? The default stays linked to this configurator.`
        : `Remove all ${toUnassign.length} linked material(s)? No default is set.`
    if (!window.confirm(msg)) return
    setBulkUnassigning(true)
    try {
      const results = await Promise.all(
        toUnassign.map((m) =>
          fetchJson(
            `/api/admin/materials/${encodeURIComponent(m.id)}?configuratorId=${encodeURIComponent(m.configuratorId)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ unassignFrom: [configuratorId] }),
            },
          ),
        ),
      )
      if (results.some((r) => !r.ok)) {
        window.alert('Some unassign requests failed. Refresh and try again.')
      }
      void loadMaterials()
    } finally {
      setBulkUnassigning(false)
    }
  }

  // Determine which "foreign" materials could be assigned
  const ownMatIds = new Set(adminMaterials.map((m) => m.id))
  const foreignMaterials = allMaterials.filter((m) => !ownMatIds.has(m.id))
  const linkedExceptDefaultCount = adminMaterials.filter(
    (m) => m.linkedViaAssignment && m.id !== defaultMaterialId,
  ).length

  const dimMmForAxis = (axis: typeof DIM_AXES[number]) =>
    axis === 'width' ? widthMm : axis === 'depth' ? depthMm : heightMm
  const dimLimitKey = (axis: typeof DIM_AXES[number]): keyof DimLimits =>
    axis === 'width' ? 'widthMm' : axis === 'depth' ? 'depthMm' : 'heightMm'

  const [showDimLimits, setShowDimLimits] = useState(false)
  const [showParamLimits, setShowParamLimits] = useState(false)
  const [debugMarkerLimits, setDebugMarkerLimits] = useState({
    vertexMin: 0.001,
    vertexMax: 0.03,
    pickMin: 0.001,
    pickMax: 0.03,
  })
  const [cameraDistanceLimits, setCameraDistanceLimits] = useState({ min: 0.6, max: 10 })

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Admin Settings</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>

      <div className={styles.panelBody}>
        <form className={styles.form} onSubmit={onSave}>
        {/* ── DIMENSIONS TAB ── */}
        {tab === 'dimensions' ? (
          <div className={styles.tabContent}>
            <p className={styles.sectionTitle}>Bounding box (mm)</p>
            {DIM_AXES.map((axis) => {
              const mm = dimMmForAxis(axis)
              const dlk = dimLimitKey(axis)
              const range = localDimLimits[dlk]
              const lo = range?.min ?? DIM_MM[axis].min
              const hi = range?.max ?? DIM_MM[axis].max
              return (
                <label key={axis} className={styles.dimRow}>
                  <span className={styles.dimLabel}>{axis.charAt(0).toUpperCase() + axis.slice(1)}</span>
                  <input
                    type="range"
                    className={styles.range}
                    min={lo}
                    max={hi}
                    step={1}
                    value={mm}
                    onChange={(e) => setDim(axis, Number(e.target.value))}
                  />
                  <input
                    type="number"
                    className={styles.numInput}
                    min={lo}
                    max={hi}
                    step={1}
                    value={mm}
                    onChange={(e) => setDim(axis, Number(e.target.value))}
                  />
                </label>
              )
            })}
            <div className={styles.sectionRow}>
              <p className={styles.sectionTitle}>Dimension Limits</p>
              <button
                type="button"
                className={styles.toggleLimits}
                onClick={() => setShowDimLimits((v) => !v)}
              >
                {showDimLimits ? 'Hide limits' : 'Edit limits'}
              </button>
            </div>
            {showDimLimits ? (
              <div className={styles.limitsBlock}>
                {DIM_AXES.map((axis) => {
                  const dlk = dimLimitKey(axis)
                  const range = localDimLimits[dlk]
                  return (
                    <div key={axis} className={styles.dimLimitRow}>
                      <span className={styles.dimLabel}>{axis.charAt(0).toUpperCase() + axis.slice(1)}</span>
                      <div className={styles.limitsRow}>
                        <label className={styles.limitLabel}>
                          Min
                          <input
                            type="number"
                            className={styles.limitInput}
                            step={1}
                            value={range?.min ?? ''}
                            placeholder={String(DIM_MM[axis].min)}
                            onChange={(e) => setDimLimit(dlk, 'min', e.target.value)}
                          />
                        </label>
                        <label className={styles.limitLabel}>
                          Max
                          <input
                            type="number"
                            className={styles.limitInput}
                            step={1}
                            value={range?.max ?? ''}
                            placeholder={String(DIM_MM[axis].max)}
                            onChange={(e) => setDimLimit(dlk, 'max', e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
            <p className={styles.sectionTitle}>Selection Highlight</p>
            <label className={styles.matFieldWide}>
              <span>Selection outline colour</span>
              <span className={styles.matColourSpan}>
                <ColorSwatchInput
                  value={localDimensionUi.highlightOutlineColor ?? '#ffd84d'}
                  onChange={(v) => {
                    const next = { ...localDimensionUi, highlightOutlineColor: v }
                    setLocalDimensionUi(next)
                    setDimensionUi({ highlightOutlineColor: v })
                  }}
                  aria-label="Selection outline colour"
                />
              </span>
            </label>
            <label className={styles.matFieldWide}>
              <span>Selection face colour</span>
              <span className={styles.matColourSpan}>
                <ColorSwatchInput
                  value={localDimensionUi.highlightFaceColor ?? '#fff07a'}
                  onChange={(v) => {
                    const next = { ...localDimensionUi, highlightFaceColor: v }
                    setLocalDimensionUi(next)
                    setDimensionUi({ highlightFaceColor: v })
                  }}
                  aria-label="Selection face colour"
                />
              </span>
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={localDimensionUi.lockFaceColorToOutline ?? false}
                onChange={(e) => {
                  const v = e.target.checked
                  const next = { ...localDimensionUi, lockFaceColorToOutline: v }
                  setLocalDimensionUi(next)
                  setDimensionUi({ lockFaceColorToOutline: v })
                }}
              />
              <span>Use outline colour for selection face</span>
            </label>
          </div>
        ) : null}

        {/* ── DIMENSION OVERLAY TAB ── */}
        {tab === 'dimensionOverlay' ? (
          <div className={styles.tabContent}>
            <p className={styles.sectionTitle}>Dimension Overlay</p>
            <p className={styles.hint}>
              Overlay editing is active in scene. Panel selection and product transform gizmos are disabled.
            </p>
            <MatSliderRow
              className={styles.matFieldRow}
              label="Line scale"
              min={0.4}
              max={3}
              step={0.05}
              value={localDimensionUi.lineScale ?? 1}
              onChange={(v) => {
                const next = { ...localDimensionUi, lineScale: v }
                setLocalDimensionUi(next)
                setDimensionUi({ lineScale: v })
              }}
            />
            <MatSliderRow
              className={styles.matFieldRow}
              label="Text size scale"
              min={0.4}
              max={3}
              step={0.05}
              value={localDimensionUi.textScale ?? 1}
              onChange={(v) => {
                const next = { ...localDimensionUi, textScale: v }
                setLocalDimensionUi(next)
                setDimensionUi({ textScale: v })
              }}
            />
            <MatSliderRow
              className={styles.matFieldRow}
              label="Text gap whitespace scale"
              min={0.5}
              max={4}
              step={0.05}
              value={localDimensionUi.textGapScale ?? 1}
              onChange={(v) => {
                const next = { ...localDimensionUi, textGapScale: v }
                setLocalDimensionUi(next)
                setDimensionUi({ textGapScale: v })
              }}
            />
            <MatSliderRow
              className={styles.matFieldRow}
              label="Endpoint scale"
              min={0.4}
              max={3}
              step={0.05}
              value={localDimensionUi.endpointScale ?? 1}
              onChange={(v) => {
                const next = { ...localDimensionUi, endpointScale: v }
                setLocalDimensionUi(next)
                setDimensionUi({ endpointScale: v })
              }}
            />
            <label className={styles.dimRow}>
              <span className={styles.dimLabel}>Endpoint style</span>
              <select
                className={styles.matSelect}
                value={localDimensionUi.endpointType ?? 'dot'}
                onChange={(e) => {
                  const v = e.target.value as 'dot' | 'arrow' | 'diagonal' | 'cross'
                  const next = { ...localDimensionUi, endpointType: v }
                  setLocalDimensionUi(next)
                  setDimensionUi({ endpointType: v })
                }}
              >
                <option value="dot">Dots</option>
                <option value="arrow">Arrows</option>
                <option value="diagonal">Diagonal ticks</option>
                <option value="cross">Crosses</option>
              </select>
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={localDimensionUi.showUnits ?? true}
                onChange={(e) => {
                  const v = e.target.checked
                  const next = { ...localDimensionUi, showUnits: v }
                  setLocalDimensionUi(next)
                  setDimensionUi({ showUnits: v })
                }}
              />
              <span>Show units in dimension text</span>
            </label>
            <label className={styles.dimRow}>
              <span className={styles.dimLabel}>Units</span>
              <select
                className={styles.matSelect}
                value={localDimensionUi.unitSystem ?? 'mm'}
                onChange={(e) => {
                  const v = e.target.value as 'mm' | 'm' | 'ft_in'
                  const next = { ...localDimensionUi, unitSystem: v }
                  setLocalDimensionUi(next)
                  setDimensionUi({ unitSystem: v })
                }}
              >
                <option value="mm">Millimetres (mm)</option>
                <option value="m">Meters (m)</option>
                <option value="ft_in">Feet and inches</option>
              </select>
            </label>
            <label className={styles.matFieldWide}>
              <span>Dimension line colour</span>
              <span className={styles.matColourSpan}>
                <ColorSwatchInput
                  value={localDimensionUi.lineColor ?? '#747474'}
                  onChange={(v) => {
                    const next = { ...localDimensionUi, lineColor: v }
                    setLocalDimensionUi(next)
                    setDimensionUi({ lineColor: v })
                  }}
                  aria-label="Dimension line colour"
                />
              </span>
            </label>
            <label className={styles.matFieldWide}>
              <span>Dimension text colour</span>
              <span className={styles.matColourSpan}>
                <ColorSwatchInput
                  value={localDimensionUi.textColor ?? '#747474'}
                  onChange={(v) => {
                    const next = { ...localDimensionUi, textColor: v }
                    setLocalDimensionUi(next)
                    setDimensionUi({ textColor: v })
                  }}
                  aria-label="Dimension text colour"
                />
              </span>
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={localDimensionUi.lockTextColorToLine ?? false}
                onChange={(e) => {
                  const v = e.target.checked
                  const next = { ...localDimensionUi, lockTextColorToLine: v }
                  setLocalDimensionUi(next)
                  setDimensionUi({ lockTextColorToLine: v })
                }}
              />
              <span>Use line colour for text</span>
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => setDimensionPickMode(!dimensionPickMode)}
              >
                {dimensionPickMode ? 'Stop point picking' : 'Add dimension by picking 2 points'}
              </button>
              {dimensionPickPendingPoint ? (
                <span className={styles.hint}>First point saved. Pick second point.</span>
              ) : null}
            </div>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={showVertexDebug}
                onChange={(e) => setShowVertexDebug(e.target.checked)}
              />
              <span>Developer: show all panel vertices</span>
            </label>
            <label className={styles.matFieldWide}>
              <span>Developer vertex colour</span>
              <span className={styles.matColourSpan}>
                <ColorSwatchInput
                  value={localDimensionUi.debugVertexColor ?? '#111111'}
                  onChange={(v) => {
                    const next = { ...localDimensionUi, debugVertexColor: v }
                    setLocalDimensionUi(next)
                    setDimensionUi({ debugVertexColor: v })
                  }}
                  aria-label="Developer vertex colour"
                />
              </span>
            </label>
            <MatSliderRow
              className={styles.matFieldRow}
              label="Developer vertex size"
              min={debugMarkerLimits.vertexMin}
              max={debugMarkerLimits.vertexMax}
              step={0.0005}
              value={localDimensionUi.debugVertexSize ?? 0.0036}
              onChange={(v) => {
                const next = { ...localDimensionUi, debugVertexSize: v }
                setLocalDimensionUi(next)
                setDimensionUi({ debugVertexSize: v })
              }}
            />
            <MatSliderRow
              className={styles.matFieldRow}
              label="Pick marker size"
              min={debugMarkerLimits.pickMin}
              max={debugMarkerLimits.pickMax}
              step={0.0005}
              value={localDimensionUi.pickPointSize ?? 0.012}
              onChange={(v) => {
                const next = { ...localDimensionUi, pickPointSize: v }
                setLocalDimensionUi(next)
                setDimensionUi({ pickPointSize: v })
              }}
            />
            <div className={styles.limitsRow}>
              <label className={styles.limitLabel}>
                Vertex size min
                <input
                  type="number"
                  className={styles.limitInput}
                  step={0.0005}
                  value={debugMarkerLimits.vertexMin}
                  onChange={(e) =>
                    setDebugMarkerLimits((s) => ({ ...s, vertexMin: Number(e.target.value) || 0.001 }))
                  }
                />
              </label>
              <label className={styles.limitLabel}>
                Vertex size max
                <input
                  type="number"
                  className={styles.limitInput}
                  step={0.0005}
                  value={debugMarkerLimits.vertexMax}
                  onChange={(e) =>
                    setDebugMarkerLimits((s) => ({ ...s, vertexMax: Number(e.target.value) || 0.03 }))
                  }
                />
              </label>
            </div>
            <div className={styles.limitsRow}>
              <label className={styles.limitLabel}>
                Pick size min
                <input
                  type="number"
                  className={styles.limitInput}
                  step={0.0005}
                  value={debugMarkerLimits.pickMin}
                  onChange={(e) =>
                    setDebugMarkerLimits((s) => ({ ...s, pickMin: Number(e.target.value) || 0.001 }))
                  }
                />
              </label>
              <label className={styles.limitLabel}>
                Pick size max
                <input
                  type="number"
                  className={styles.limitInput}
                  step={0.0005}
                  value={debugMarkerLimits.pickMax}
                  onChange={(e) =>
                    setDebugMarkerLimits((s) => ({ ...s, pickMax: Number(e.target.value) || 0.03 }))
                  }
                />
              </label>
            </div>
            <div className={styles.propPaletteGrid}>
              {(localDimensionUi.customDimensions ?? []).map((cd) => (
                <div key={cd.id} className={styles.propCard}>
                  <label className={styles.limitLabel}>
                    Name
                    <input
                      type="text"
                      className={styles.limitInput}
                      value={cd.name ?? ''}
                      placeholder={cd.id.slice(0, 8)}
                      onChange={(e) => {
                        const nm = e.target.value
                        const next = (localDimensionUi.customDimensions ?? []).map((row) =>
                          row.id === cd.id ? { ...row, name: nm } : row,
                        )
                        const upd = { ...localDimensionUi, customDimensions: next }
                        setLocalDimensionUi(upd)
                        setDimensionUi({ customDimensions: next })
                      }}
                    />
                  </label>
                  <label className={styles.limitLabel}>
                    Line position
                    <input
                      type="range"
                      className={styles.range}
                      min={0.2}
                      max={6}
                      step={0.05}
                      value={cd.gapScale ?? 1}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        const next = (localDimensionUi.customDimensions ?? []).map((row) =>
                          row.id === cd.id ? { ...row, gapScale: v } : row,
                        )
                        const upd = { ...localDimensionUi, customDimensions: next }
                        setLocalDimensionUi(upd)
                        setDimensionUi({ customDimensions: next })
                      }}
                    />
                    <input
                      type="number"
                      className={styles.limitInput}
                      min={0.2}
                      max={6}
                      step={0.05}
                      value={cd.gapScale ?? 1}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 1
                        const next = (localDimensionUi.customDimensions ?? []).map((row) =>
                          row.id === cd.id ? { ...row, gapScale: v } : row,
                        )
                        const upd = { ...localDimensionUi, customDimensions: next }
                        setLocalDimensionUi(upd)
                        setDimensionUi({ customDimensions: next })
                      }}
                    />
                  </label>
                  <button type="button" className={styles.backBtn} onClick={() => removeCustomDimension(cd.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── CAMERA TAB ── */}
        {tab === 'camera' ? (
          <div className={styles.tabContent}>
            <p className={styles.sectionTitle}>Initial Camera</p>
            <label className={styles.dimRow}>
              <span className={styles.dimLabel}>View preset</span>
              <select
                className={styles.matSelect}
                value={localCamera.preset ?? 'front'}
                onChange={(e) => {
                  const preset = e.target.value as 'front' | 'top' | 'side' | 'iso' | 'custom'
                  const next = { ...localCamera, preset }
                  setLocalCamera(next)
                  setCamera({ preset })
                }}
              >
                <option value="front">Front</option>
                <option value="top">Top</option>
                <option value="side">Side</option>
                <option value="iso">Isometric</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <MatSliderRow
              className={styles.matFieldRow}
              label="Distance to product"
              min={cameraDistanceLimits.min}
              max={cameraDistanceLimits.max}
              step={0.05}
              value={localCamera.distanceFactor ?? 2.6}
              onChange={(v) => {
                const next = { ...localCamera, distanceFactor: v }
                setLocalCamera(next)
                setCamera({ distanceFactor: v })
                previewCameraStartView()
              }}
            />
            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => previewCameraStartView()}
            >
              Preview saved starting view
            </button>
            <div className={styles.limitsRow}>
              <label className={styles.limitLabel}>
                Distance min
                <input
                  type="number"
                  className={styles.limitInput}
                  step={0.05}
                  value={cameraDistanceLimits.min}
                  onChange={(e) => setCameraDistanceLimits((s) => ({ ...s, min: Number(e.target.value) || 0 }))}
                />
              </label>
              <label className={styles.limitLabel}>
                Distance max
                <input
                  type="number"
                  className={styles.limitInput}
                  step={0.05}
                  value={cameraDistanceLimits.max}
                  onChange={(e) => setCameraDistanceLimits((s) => ({ ...s, max: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>
            <p className={styles.hint}>
              In this tab, scene gizmos appear for camera position and target. Drag them to adjust interactively.
            </p>
            <div className={styles.propRow}>
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <label key={`cam-pos-${axis}`} className={styles.limitLabel}>
                  Cam {axis}
                  <input
                    type="number"
                    className={styles.limitInput}
                    step={0.01}
                    value={localCamera.position?.[i] ?? ''}
                    onChange={(e) => {
                      const cur: [number, number, number] = [
                        localCamera.position?.[0] ?? 0,
                        localCamera.position?.[1] ?? 0,
                        localCamera.position?.[2] ?? 0,
                      ]
                      cur[i] = Number(e.target.value) || 0
                      const next = { ...localCamera, position: cur }
                      setLocalCamera(next)
                      setCamera({ position: cur, preset: 'custom' })
                    }}
                  />
                </label>
              ))}
            </div>
            <div className={styles.propRow}>
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <label key={`cam-target-${axis}`} className={styles.limitLabel}>
                  Target {axis}
                  <input
                    type="number"
                    className={styles.limitInput}
                    step={0.01}
                    value={localCamera.target?.[i] ?? ''}
                    onChange={(e) => {
                      const cur: [number, number, number] = [
                        localCamera.target?.[0] ?? 0,
                        localCamera.target?.[1] ?? 0,
                        localCamera.target?.[2] ?? 0,
                      ]
                      cur[i] = Number(e.target.value) || 0
                      const next = { ...localCamera, target: cur }
                      setLocalCamera(next)
                      setCamera({ target: cur, preset: 'custom' })
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── PARAMETERS TAB ── */}
        {tab === 'parameters' ? (
          <div className={styles.tabContent}>
            <div className={styles.sectionRow}>
              <p className={styles.sectionTitle}>Template Parameters</p>
              <button
                type="button"
                className={styles.toggleLimits}
                onClick={() => setShowParamLimits((v) => !v)}
              >
                {showParamLimits ? 'Hide limits' : 'Edit limits'}
              </button>
            </div>

            {PARAM_DEFS.map((def) => {
              const range = localLimits[limitKey(def.key)]
              const lo = range?.min ?? def.fallbackMin
              const hi = range?.max ?? def.fallbackMax
              const val = merged[def.key] ?? lo
              return (
                <div key={def.key} className={styles.paramBlock}>
                  <label className={styles.dimRow}>
                    <span className={styles.dimLabel}>{def.label}</span>
                    <input
                      type="range"
                      className={styles.range}
                      min={lo}
                      max={hi}
                      step={def.step}
                      value={val}
                      onChange={(e) => setParam(def.key, Number(e.target.value))}
                    />
                    <input
                      type="number"
                      className={styles.numInput}
                      min={lo}
                      max={hi}
                      step={def.step}
                      value={val}
                      onChange={(e) => {
                        const v = e.target.value.trim()
                        setParam(def.key, v === '' ? undefined : Number(v))
                      }}
                    />
                  </label>
                  {showParamLimits ? (
                    <div className={styles.limitsRow}>
                      <label className={styles.limitLabel}>
                        Min
                        <input
                          type="number"
                          className={styles.limitInput}
                          step={def.step}
                          value={range?.min ?? ''}
                          placeholder={String(def.fallbackMin)}
                          onChange={(e) => setLimit(def.key, 'min', e.target.value)}
                        />
                      </label>
                      <label className={styles.limitLabel}>
                        Max
                        <input
                          type="number"
                          className={styles.limitInput}
                          step={def.step}
                          value={range?.max ?? ''}
                          placeholder={String(def.fallbackMax)}
                          onChange={(e) => setLimit(def.key, 'max', e.target.value)}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              )
            })}

            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={merged.interlockEnabled ?? true}
                onChange={(e) => setInterlock(e.target.checked)}
              />
              <span>Interlock enabled</span>
            </label>
          </div>
        ) : null}

        {/* ── MATERIALS TAB ── */}
        {tab === 'materials' ? (
          <div className={styles.tabContent}>
            <p className={styles.sectionTitle}>Materials for this configurator</p>
            <p className={styles.hint}>
              The material marked default is selected when visitors open this configurator.
              {defaultMaterialId ? (
                <button type="button" className={styles.clearDefaultBtn} onClick={() => setDefaultMaterialId(null)}>
                  Clear default
                </button>
              ) : null}
            </p>
            {adminMaterials.some((m) => m.linkedViaAssignment) ? (
              <div className={styles.sectionRow}>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  disabled={matLoading || bulkUnassigning || linkedExceptDefaultCount === 0}
                  title={
                    linkedExceptDefaultCount === 0
                      ? 'Only the default linked material remains, or no linked materials.'
                      : undefined
                  }
                  onClick={() => void unassignAllLinkedExceptDefault()}
                >
                  {bulkUnassigning
                    ? 'Unassigning\u2026'
                    : `Unassign all linked except default${linkedExceptDefaultCount > 0 ? ` (${linkedExceptDefaultCount})` : ''}`}
                </button>
              </div>
            ) : null}
            {matLoading ? <p className={styles.hint}>Loading...</p> : null}

            {/* Inline material editor */}
            {editingMat && matSpec ? (
              <div className={styles.matEditor}>
                <div className={styles.matEditorHead}>
                  <strong>Editing: {editingMat.name}</strong>
                  <button type="button" className={styles.toggleLimits} onClick={cancelEditMat}>
                    Cancel
                  </button>
                </div>
                {allMaterials.filter((m) => m.id !== editingMat.id).length > 0 ? (
                  <div className={styles.matCopyRow}>
                    <span className={styles.matCopyLabel}>Copy settings from</span>
                    <select
                      className={styles.matSelect}
                      value=""
                      onChange={(e) => {
                        const id = e.target.value
                        e.target.value = ''
                        if (id) applyCopyIntoEditor(id)
                      }}
                      aria-label="Copy material settings from another material"
                    >
                      <option value="">— Choose material —</option>
                      {allMaterials
                        .filter((m) => m.id !== editingMat.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {formatMatOptionLabel(m)}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
                <div className={styles.matFields}>
                  <label className={styles.matFieldWide}>
                    <span>Base colour</span>
                    <span className={styles.matColourSpan}>
                      <ColorSwatchInput
                        value={matSpec.baseColorHex}
                        onChange={(v) => setMatSpec((p) => p ? { ...p, baseColorHex: v } : p)}
                      />
                    </span>
                  </label>
                  <MatSliderRow
                    className={styles.matFieldRow}
                    label="Roughness"
                    min={0}
                    max={1}
                    step={0.01}
                    value={matSpec.globalRoughness}
                    onChange={(v) => setMatSpec((p) => (p ? { ...p, globalRoughness: v } : p))}
                  />
                  <MatSliderRow
                    className={styles.matFieldRow}
                    label="Metalness"
                    min={0}
                    max={1}
                    step={0.01}
                    value={matSpec.globalMetalness}
                    onChange={(v) => setMatSpec((p) => (p ? { ...p, globalMetalness: v } : p))}
                  />
                  <MatSliderRow
                    className={styles.matFieldRow}
                    label="AO"
                    min={0}
                    max={1}
                    step={0.01}
                    value={matSpec.ambientOcclusion}
                    onChange={(v) => setMatSpec((p) => (p ? { ...p, ambientOcclusion: v } : p))}
                  />

                  {matSpec.layers.map((layer, i) => (
                    <div key={layer.id} className={styles.matLayer}>
                      <div className={styles.matLayerHead}>
                        <span>Layer {i + 1}</span>
                        <button type="button" className={styles.dangerBtn} onClick={() => {
                          setMatSpec((p) => p ? { ...p, layers: p.layers.filter((_, li) => li !== i) } : p)
                        }}>Remove</button>
                      </div>
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Mix"
                        min={0}
                        max={1}
                        step={0.01}
                        value={layer.mix}
                        onChange={(v) => updateLayer(i, { mix: v })}
                      />
                      <label className={styles.matFieldWide}>
                        <span>Blend</span>
                        <span className={styles.matColourSpan}>
                          <select className={styles.matSelect} value={layer.blendMode}
                            onChange={(e) => updateLayer(i, { blendMode: e.target.value as BlendMode })}>
                            <option value="normal">Normal</option>
                            <option value="multiply">Multiply</option>
                            <option value="overlay">Overlay</option>
                          </select>
                        </span>
                      </label>
                      <label className={styles.matFieldWide}>
                        <span>Noise</span>
                        <span className={styles.matColourSpan}>
                          <select className={styles.matSelect} value={layer.noiseType}
                            onChange={(e) => updateLayer(i, { noiseType: e.target.value as NoiseType })}>
                            <option value="fbm">FBM</option>
                            <option value="voronoi">Voronoi</option>
                            <option value="simplex">Simplex</option>
                            <option value="ridged">Ridged</option>
                            <option value="turbulence">Turbulence</option>
                            <option value="marble">Marble</option>
                          </select>
                        </span>
                      </label>
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Pos X (m)"
                        min={-10}
                        max={10}
                        step={0.02}
                        value={layer.noiseOffsetX ?? 0}
                        onChange={(v) => updateLayer(i, { noiseOffsetX: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Pos Y (m)"
                        min={-10}
                        max={10}
                        step={0.02}
                        value={layer.noiseOffsetY ?? 0}
                        onChange={(v) => updateLayer(i, { noiseOffsetY: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Pos Z (m)"
                        min={-10}
                        max={10}
                        step={0.02}
                        value={layer.noiseOffsetZ ?? 0}
                        onChange={(v) => updateLayer(i, { noiseOffsetZ: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Rot X (rad)"
                        min={-Math.PI}
                        max={Math.PI}
                        step={0.01}
                        value={layer.noiseRotationX ?? 0}
                        onChange={(v) => updateLayer(i, { noiseRotationX: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Rot Y (rad)"
                        min={-Math.PI}
                        max={Math.PI}
                        step={0.01}
                        value={layer.noiseRotationY ?? 0}
                        onChange={(v) => updateLayer(i, { noiseRotationY: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Rot Z (rad)"
                        min={-Math.PI}
                        max={Math.PI}
                        step={0.01}
                        value={layer.noiseRotationZ ?? 0}
                        onChange={(v) => updateLayer(i, { noiseRotationZ: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Scale X"
                        min={0.1}
                        max={200}
                        step={0.1}
                        value={layer.noiseScale}
                        onChange={(v) => updateLayer(i, { noiseScale: v })}
                      />
                      <MatSliderRowScaleOptional
                        className={styles.matFieldRow}
                        label="Scale Y"
                        min={0}
                        max={200}
                        step={0.1}
                        value={layer.noiseScaleY}
                        onChange={(v) => updateLayer(i, { noiseScaleY: v })}
                        emptyLabel="= X"
                      />
                      <MatSliderRowScaleOptional
                        className={styles.matFieldRow}
                        label="Scale Z"
                        min={0}
                        max={200}
                        step={0.1}
                        value={layer.noiseScaleZ}
                        onChange={(v) => updateLayer(i, { noiseScaleZ: v })}
                        emptyLabel="= X"
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Strength"
                        min={0}
                        max={2}
                        step={0.01}
                        value={layer.noiseStrength}
                        onChange={(v) => updateLayer(i, { noiseStrength: v })}
                      />
                      <label className={styles.matFieldWide}>
                        <span>Colour</span>
                        <span className={styles.matColourSpan}>
                          <ColorSwatchInput value={layer.colorHex}
                            onChange={(v) => updateLayer(i, { colorHex: v })} />
                        </span>
                      </label>
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Roughness"
                        min={0}
                        max={1}
                        step={0.01}
                        value={layer.roughness}
                        onChange={(v) => updateLayer(i, { roughness: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Metalness"
                        min={0}
                        max={1}
                        step={0.01}
                        value={layer.metalness}
                        onChange={(v) => updateLayer(i, { metalness: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Displacement"
                        min={0}
                        max={1}
                        step={0.01}
                        value={layer.displacementStrength ?? 0}
                        onChange={(v) => updateLayer(i, { displacementStrength: v })}
                      />
                      <MatSliderRow
                        className={styles.matFieldRow}
                        label="Normal"
                        min={0}
                        max={2}
                        step={0.01}
                        value={layer.normalStrength ?? 0}
                        onChange={(v) => updateLayer(i, { normalStrength: v })}
                      />
                    </div>
                  ))}
                  {matSpec.layers.length < 3 ? (
                    <button type="button" className={styles.addLayerBtn} onClick={() => {
                      setMatSpec((p) => p ? { ...p, layers: [...p.layers, newLayer()].slice(0, 3) } : p)
                    }}>Add layer</button>
                  ) : null}
                </div>
                <div className={styles.matActions}>
                  <button type="button" className={styles.saveBtn} onClick={() => void saveMat()} disabled={matSaving}>
                    {matSaving ? 'Saving\u2026' : 'Save material'}
                  </button>
                </div>
                {matMsg ? <p className={`${styles.msg} ${matMsg === 'Saved' ? styles.msgOk : styles.msgErr}`}>{matMsg}</p> : null}
              </div>
            ) : (
              <>
                {matListMsg ? (
                  <p
                    className={`${styles.msg} ${matListMsg === 'Settings copied.' ? styles.msgOk : styles.msgErr}`}
                  >
                    {matListMsg}
                  </p>
                ) : null}
                {/* Materials for this configurator (native + assigned) */}
                {adminMaterials.map((mat) => (
                  <div key={mat.id} className={`${styles.matCard} ${!mat.enabled ? styles.matDisabled : ''}`}>
                    <div className={styles.matCardHead}>
                      <div
                        className={styles.matSwatch}
                        style={{ backgroundColor: mat.colorHex }}
                      />
                      <span className={styles.matName}>{mat.name}</span>
                      {mat.linkedViaAssignment ? (
                        <span className={styles.matBadgeLinked} title="Linked from another configurator">
                          Linked
                        </span>
                      ) : null}
                      {!mat.enabled ? <span className={styles.matBadge}>Hidden</span> : null}
                    </div>
                    <div className={styles.matCardActions}>
                      <label className={styles.defaultMatRow} title="Default for new visitors">
                        <input
                          type="radio"
                          name="defaultMaterial"
                          checked={defaultMaterialId === mat.id}
                          onChange={() => setDefaultMaterialId(mat.id)}
                        />
                        <span>Default</span>
                      </label>
                      <button type="button" className={styles.toggleLimits} onClick={() => void toggleMatEnabled(mat)}>
                        {mat.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className={styles.toggleLimits} onClick={() => startEditMat(mat)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleLimits} ${materialId === mat.id ? styles.tabActive : ''}`}
                        onClick={() => setMaterialId(mat.id)}
                      >
                        Select
                      </button>
                      {mat.linkedViaAssignment && configuratorId ? (
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          title="Remove this link from this configurator"
                          onClick={() => void unassignMatFromThis(mat.id, mat.configuratorId)}
                        >
                          Unassign
                        </button>
                      ) : null}
                    </div>
                    {allMaterials.filter((m) => m.id !== mat.id).length > 0 ? (
                      <div className={styles.matCopyRow}>
                        <select
                          className={styles.matSelect}
                          value=""
                          disabled={matCopyingId === mat.id}
                          onChange={(e) => {
                            const id = e.target.value
                            e.target.value = ''
                            if (id) void applyCopyMatSettings(mat, id)
                          }}
                          aria-label={`Copy settings onto ${mat.name}`}
                        >
                          <option value="">Copy settings from…</option>
                          {allMaterials
                            .filter((m) => m.id !== mat.id)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {formatMatOptionLabel(m)}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                ))}

                {/* Assign section */}
                <div className={styles.sectionRow}>
                  <p className={styles.sectionTitle}>Assign from other configurators</p>
                  <button
                    type="button"
                    className={styles.toggleLimits}
                    onClick={() => setShowAssign((v) => !v)}
                  >
                    {showAssign ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showAssign && foreignMaterials.length > 0 ? (
                  <div className={styles.assignList}>
                    {foreignMaterials.map((fm) => {
                      const isAssigned = adminMaterials.some((m) => m.id === fm.id)
                      return (
                        <div key={fm.id} className={styles.matCard}>
                          <div className={styles.matCardHead}>
                            <div className={styles.matSwatch} style={{ backgroundColor: fm.colorHex }} />
                            <span className={styles.matName}>{fm.name}</span>
                          </div>
                          <div className={styles.matCardActions}>
                            {isAssigned ? (
                              <button type="button" className={styles.dangerBtn}
                                onClick={() => void unassignMatFromThis(fm.id, fm.configuratorId)}>
                                Unassign
                              </button>
                            ) : (
                              <button type="button" className={styles.toggleLimits}
                                onClick={() => void assignMatToThis(fm.id, fm.configuratorId)}>
                                Assign
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
                {showAssign && foreignMaterials.length === 0 ? (
                  <p className={styles.hint}>No materials from other configurators available.</p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {/* ── UV MAPPING TAB ── */}
        {tab === 'uv' ? (
          <div className={styles.tabContent}>
            <p className={styles.sectionTitle}>UV Mapping</p>
            <p className={styles.uvHint}>
              Material: <strong>{currentMatLabel}</strong>
            </p>

            {materialId && adminMaterials.filter((m) => m.id !== materialId).length > 0 ? (
              <div className={styles.matCopyRow}>
                <span className={styles.matCopyLabel}>Copy UV from</span>
                <select
                  className={styles.matSelect}
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    e.target.value = ''
                    if (id) applyUvCopyFrom(id)
                  }}
                  aria-label="Copy UV mapping from another material"
                >
                  <option value="">— Choose material —</option>
                  {adminMaterials
                    .filter((m) => m.id !== materialId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {formatMatOptionLabel(m)}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}

            <label className={styles.uvKindRow}>
              <span className={styles.dimLabel}>Surface</span>
              <select
                className={styles.uvKindSelect}
                value={uvSurfaceKind}
                onChange={(e) => {
                  setUvSurfaceKind(e.target.value)
                  setExpandedFace(null)
                }}
              >
                {SURFACE_KINDS.map((sk) => (
                  <option key={sk.value} value={sk.value}>{sk.label}</option>
                ))}
              </select>
            </label>

            {FACE_GROUPS.map((fg) => {
              const isOpen = expandedFace === fg
              const key = materialId ? uvCompoundKey(uvSurfaceKind, materialId, fg) : null
              const current = key ? uvMappings?.[key] : undefined
              return (
                <div key={fg} className={styles.uvSurface}>
                  <button
                    type="button"
                    className={styles.uvSurfaceHead}
                    onClick={() => setExpandedFace(isOpen ? null : fg)}
                  >
                    <span>{FACE_LABELS[fg]}</span>
                    <span className={styles.uvToggle}>{isOpen ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {isOpen ? (
                    <div className={styles.uvFields}>
                      {UV_FIELDS.map((f) => {
                        const val = current?.[f.key] ?? f.fallback
                        return (
                          <label key={f.key} className={styles.dimRow}>
                            <span className={styles.dimLabel}>{f.label}</span>
                            <input
                              type="range"
                              className={styles.range}
                              min={f.min}
                              max={f.max}
                              step={f.step}
                              value={val}
                              onChange={(e) => onUvFaceChange(fg, f.key, Number(e.target.value))}
                            />
                            <input
                              type="number"
                              className={styles.numInput}
                              min={f.min}
                              max={f.max}
                              step={f.step}
                              value={val}
                              onChange={(e) => onUvFaceChange(fg, f.key, Number(e.target.value))}
                            />
                          </label>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {/* ── LIGHTING TAB ── */}
        {tab === 'lighting' ? (
          <div className={styles.tabContent}>
            <p className={styles.sectionTitle}>Scene lighting</p>
            <p className={styles.hint}>
              Pick a light, adjust values, then use <strong>Save as defaults</strong> to store them for this configurator.
            </p>
            <div className={styles.lightPickList} role="tablist" aria-label="Lights">
              {LIGHTING_TAB_IDS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`${styles.lightPick} ${lightingPick === row.id ? styles.lightPickActive : ''}`}
                  onClick={() => setLightingPick(row.id)}
                >
                  {row.label}
                </button>
              ))}
            </div>

            {lightingPick === 'ambient' ? (
              <MatSliderRow
                className={styles.matFieldRow}
                label="Intensity"
                min={0}
                max={3}
                step={0.02}
                value={resolvedLight.ambientIntensity}
                onChange={(v) => patchLighting({ ambientIntensity: v })}
              />
            ) : null}

            {lightingPick === 'directional0' ? (
              <>
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos X"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional0.position[0]}
                  onChange={(v) =>
                    patchLighting({
                      directional0: {
                        position: [
                          v,
                          resolvedLight.directional0.position[1],
                          resolvedLight.directional0.position[2],
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Y"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional0.position[1]}
                  onChange={(v) =>
                    patchLighting({
                      directional0: {
                        position: [
                          resolvedLight.directional0.position[0],
                          v,
                          resolvedLight.directional0.position[2],
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Z"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional0.position[2]}
                  onChange={(v) =>
                    patchLighting({
                      directional0: {
                        position: [
                          resolvedLight.directional0.position[0],
                          resolvedLight.directional0.position[1],
                          v,
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Intensity"
                  min={0}
                  max={5}
                  step={0.02}
                  value={resolvedLight.directional0.intensity}
                  onChange={(v) => patchLighting({ directional0: { intensity: v } })}
                />
                <label className={styles.matFieldWide}>
                  <span>Colour</span>
                  <span className={styles.matColourSpan}>
                    <ColorSwatchInput
                      value={resolvedLight.directional0.color}
                      onChange={(c) => patchLighting({ directional0: { color: c } })}
                      aria-label="Directional warm colour"
                    />
                  </span>
                </label>
              </>
            ) : null}

            {lightingPick === 'directional1' ? (
              <>
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos X"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional1.position[0]}
                  onChange={(v) =>
                    patchLighting({
                      directional1: {
                        position: [
                          v,
                          resolvedLight.directional1.position[1],
                          resolvedLight.directional1.position[2],
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Y"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional1.position[1]}
                  onChange={(v) =>
                    patchLighting({
                      directional1: {
                        position: [
                          resolvedLight.directional1.position[0],
                          v,
                          resolvedLight.directional1.position[2],
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Z"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional1.position[2]}
                  onChange={(v) =>
                    patchLighting({
                      directional1: {
                        position: [
                          resolvedLight.directional1.position[0],
                          resolvedLight.directional1.position[1],
                          v,
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Intensity"
                  min={0}
                  max={5}
                  step={0.02}
                  value={resolvedLight.directional1.intensity}
                  onChange={(v) => patchLighting({ directional1: { intensity: v } })}
                />
                <label className={styles.matFieldWide}>
                  <span>Colour</span>
                  <span className={styles.matColourSpan}>
                    <ColorSwatchInput
                      value={resolvedLight.directional1.color}
                      onChange={(c) => patchLighting({ directional1: { color: c } })}
                      aria-label="Directional cool colour"
                    />
                  </span>
                </label>
              </>
            ) : null}

            {lightingPick === 'directional2' ? (
              <>
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos X"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional2.position[0]}
                  onChange={(v) =>
                    patchLighting({
                      directional2: {
                        position: [
                          v,
                          resolvedLight.directional2.position[1],
                          resolvedLight.directional2.position[2],
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Y"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional2.position[1]}
                  onChange={(v) =>
                    patchLighting({
                      directional2: {
                        position: [
                          resolvedLight.directional2.position[0],
                          v,
                          resolvedLight.directional2.position[2],
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Z"
                  min={-12}
                  max={12}
                  step={0.05}
                  value={resolvedLight.directional2.position[2]}
                  onChange={(v) =>
                    patchLighting({
                      directional2: {
                        position: [
                          resolvedLight.directional2.position[0],
                          resolvedLight.directional2.position[1],
                          v,
                        ],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Intensity"
                  min={0}
                  max={5}
                  step={0.02}
                  value={resolvedLight.directional2.intensity}
                  onChange={(v) => patchLighting({ directional2: { intensity: v } })}
                />
                <label className={styles.matFieldWide}>
                  <span>Colour</span>
                  <span className={styles.matColourSpan}>
                    <ColorSwatchInput
                      value={resolvedLight.directional2.color}
                      onChange={(c) => patchLighting({ directional2: { color: c } })}
                      aria-label="Directional rim colour"
                    />
                  </span>
                </label>
              </>
            ) : null}

            {lightingPick === 'keySpot' ? (
              <>
                <p className={styles.hint}>Stage key spot (scaled with product size). Softness is penumbra.</p>
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos X"
                  min={-6}
                  max={6}
                  step={0.02}
                  value={resolvedLight.keySpot.position[0]}
                  onChange={(v) =>
                    patchLighting({
                      keySpot: {
                        position: [v, resolvedLight.keySpot.position[1], resolvedLight.keySpot.position[2]],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Y"
                  min={-6}
                  max={6}
                  step={0.02}
                  value={resolvedLight.keySpot.position[1]}
                  onChange={(v) =>
                    patchLighting({
                      keySpot: {
                        position: [resolvedLight.keySpot.position[0], v, resolvedLight.keySpot.position[2]],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Z"
                  min={-6}
                  max={6}
                  step={0.02}
                  value={resolvedLight.keySpot.position[2]}
                  onChange={(v) =>
                    patchLighting({
                      keySpot: {
                        position: [resolvedLight.keySpot.position[0], resolvedLight.keySpot.position[1], v],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Intensity"
                  min={0}
                  max={8}
                  step={0.02}
                  value={resolvedLight.keySpot.intensity}
                  onChange={(v) => patchLighting({ keySpot: { intensity: v } })}
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Softness"
                  min={0}
                  max={1}
                  step={0.01}
                  value={resolvedLight.keySpot.softness ?? 1}
                  onChange={(v) => patchLighting({ keySpot: { softness: v } })}
                />
                <label className={styles.matFieldWide}>
                  <span>Colour</span>
                  <span className={styles.matColourSpan}>
                    <ColorSwatchInput
                      value={resolvedLight.keySpot.color}
                      onChange={(c) => patchLighting({ keySpot: { color: c } })}
                      aria-label="Key spot colour"
                    />
                  </span>
                </label>
              </>
            ) : null}

            {lightingPick === 'fillPoint' ? (
              <>
                <p className={styles.hint}>Stage fill point (scaled with product size).</p>
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos X"
                  min={-6}
                  max={6}
                  step={0.02}
                  value={resolvedLight.fillPoint.position[0]}
                  onChange={(v) =>
                    patchLighting({
                      fillPoint: {
                        position: [v, resolvedLight.fillPoint.position[1], resolvedLight.fillPoint.position[2]],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Y"
                  min={-6}
                  max={6}
                  step={0.02}
                  value={resolvedLight.fillPoint.position[1]}
                  onChange={(v) =>
                    patchLighting({
                      fillPoint: {
                        position: [resolvedLight.fillPoint.position[0], v, resolvedLight.fillPoint.position[2]],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Pos Z"
                  min={-6}
                  max={6}
                  step={0.02}
                  value={resolvedLight.fillPoint.position[2]}
                  onChange={(v) =>
                    patchLighting({
                      fillPoint: {
                        position: [resolvedLight.fillPoint.position[0], resolvedLight.fillPoint.position[1], v],
                      },
                    })
                  }
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Intensity"
                  min={0}
                  max={8}
                  step={0.02}
                  value={resolvedLight.fillPoint.intensity}
                  onChange={(v) => patchLighting({ fillPoint: { intensity: v } })}
                />
                <label className={styles.matFieldWide}>
                  <span>Colour</span>
                  <span className={styles.matColourSpan}>
                    <ColorSwatchInput
                      value={resolvedLight.fillPoint.color}
                      onChange={(c) => patchLighting({ fillPoint: { color: c } })}
                      aria-label="Fill point colour"
                    />
                  </span>
                </label>
              </>
            ) : null}

            {lightingPick === 'environment' ? (
              <>
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Environment intensity (IBL)"
                  min={0}
                  max={3}
                  step={0.02}
                  value={resolvedLight.environmentIntensity}
                  onChange={(v) => patchLighting({ environmentIntensity: v })}
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="HDR blur"
                  min={0}
                  max={1}
                  step={0.02}
                  value={resolvedLight.environmentBlur}
                  onChange={(v) => patchLighting({ environmentBlur: v })}
                />
                <p className={styles.lightEnvHint}>
                  The product is also lit by ambient, three directionals, key spot, and fill point (other
                  tabs). Turn those down to see IBL changes more clearly.
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        {/* ── PROPS TAB ── */}
        {tab === 'props' ? (
          <div className={styles.tabContent}>
            <p className={styles.sectionTitle}>Decorative props</p>
            <p className={styles.hint}>
              Manual rows can use either library props or built-in primitives. Edit the global library under{' '}
              <button type="button" className={styles.inlineLink} onClick={() => navigate('/admin/props')}>
                Admin → Props
              </button>
              .
            </p>
            {!panelPropsOk ? (
              <p className={styles.hint}>
                Shelf anchors apply to panel-based templates only (shelving, cabinets, islands). This
                template does not use shelf props.
              </p>
            ) : (
              <>
                <p className={styles.hint}>
                  Auto-fill adds props from the palette across shelf positions (3×3 horizontal × depth per
                  shelf) using randomized slots, prop choice, and size variation. Manual placements are listed
                  below; density 0 uses only manual rows.
                </p>
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Auto-fill density (0 = manual only; 10 = full)"
                  min={PROP_SETTING_MIN}
                  max={PROP_SETTING_MAX}
                  step={0.02}
                  value={propsConfig?.density ?? 0}
                  onChange={(v) => setPropsConfig({ density: clampPropUnsigned(v) })}
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Auto-fill randomness seed"
                  min={PROP_SETTING_MIN}
                  max={PROP_SETTING_MAX}
                  step={0.02}
                  value={propsConfig?.autoSeed ?? 1}
                  onChange={(v) => setPropsConfig({ autoSeed: clampPropUnsigned(v) })}
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Auto-fill size jitter"
                  min={PROP_SETTING_MIN}
                  max={PROP_SETTING_MAX}
                  step={0.02}
                  value={propsConfig?.autoScaleJitter ?? 2.25}
                  onChange={(v) => setPropsConfig({ autoScaleJitter: clampPropUnsigned(v) })}
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Auto-fill spawn jitter min"
                  min={0}
                  max={PROP_SETTING_MAX}
                  step={0.02}
                  value={propsConfig?.autoSpawnJitterMin ?? 0}
                  onChange={(v) => {
                    const curMax = propsConfig?.autoSpawnJitterMax ?? 3.5
                    const nv = Math.min(v, curMax)
                    setPropsConfig({
                      autoSpawnJitterMin: nv,
                      autoSpawnJitterMax: Math.max(curMax, nv),
                    })
                  }}
                />
                <MatSliderRow
                  className={styles.matFieldRow}
                  label="Auto-fill spawn jitter max"
                  min={0}
                  max={PROP_SETTING_MAX}
                  step={0.02}
                  value={propsConfig?.autoSpawnJitterMax ?? 3.5}
                  onChange={(v) => {
                    const curMin = propsConfig?.autoSpawnJitterMin ?? 0
                    const nv = Math.max(v, curMin)
                    setPropsConfig({
                      autoSpawnJitterMin: Math.min(curMin, v),
                      autoSpawnJitterMax: nv,
                    })
                  }}
                />
                <p className={styles.dimLabel}>Palette for auto-fill (empty = all library props)</p>
                <div className={styles.propPaletteGrid}>
                  {adminPropCatalog.map((c) => (
                    <label key={c.id} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={paletteIds.includes(c.id)}
                        onChange={() => togglePaletteProp(c.id)}
                      />
                      <span>
                        {c.name} ({c.kind})
                      </span>
                    </label>
                  ))}
                </div>
                {catalogForPlace.length === 0 ? (
                  <p className={styles.hint}>
                    No props in the library yet. Seed the database or upload GLBs under Admin → Props.
                  </p>
                ) : null}
                {placements.map((pl) => {
                  const override = Boolean(pl.materialSpec)
                  const sourceValue =
                    pl.kind === 'primitive'
                      ? `primitive:${pl.primitiveType ?? 'box'}`
                      : `library:${pl.propLibraryId ?? ''}`
                  return (
                    <div
                      key={pl.id}
                      className={`${styles.propCard}${selectedPropPlacementId === pl.id ? ` ${styles.propCardSelected}` : ''}`}
                      data-prop-placement-id={pl.id}
                    >
                      <div className={styles.propRow}>
                        <div className={styles.propField}>
                          <span className={styles.dimLabel}>Prop source</span>
                          <select
                            className={styles.matSelect}
                            value={sourceValue}
                            onChange={(e) => {
                              const v = e.target.value
                              if (v.startsWith('primitive:')) {
                                const primitiveType = v.slice('primitive:'.length) as
                                  | 'box'
                                  | 'sphere'
                                  | 'cylinder'
                                  | 'cone'
                                  | 'torus'
                                  | 'icosahedron'
                                patchPlacement(pl.id, { kind: 'primitive', primitiveType })
                              } else {
                                patchPlacement(pl.id, {
                                  kind: 'library',
                                  propLibraryId: v.slice('library:'.length),
                                })
                              }
                            }}
                          >
                            <option value="primitive:box">Primitive: Box</option>
                            <option value="primitive:sphere">Primitive: Sphere</option>
                            <option value="primitive:cylinder">Primitive: Cylinder</option>
                            <option value="primitive:cone">Primitive: Cone</option>
                            <option value="primitive:torus">Primitive: Torus</option>
                            <option value="primitive:icosahedron">Primitive: Icosahedron</option>
                            {catalogForPlace.map((c) => (
                              <option key={c.id} value={`library:${c.id}`}>
                                {c.name} ({c.kind})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.dimLabel}>Shelf</span>
                          <select
                            className={styles.matSelect}
                            value={pl.anchorId}
                            onChange={(e) => patchPlacement(pl.id, { anchorId: e.target.value })}
                          >
                            {shelfAnchorOptions.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.dimLabel}>Align X</span>
                          <select
                            className={styles.matSelect}
                            value={pl.alignX ?? 'center'}
                            onChange={(e) =>
                              patchPlacement(pl.id, {
                                alignX: e.target.value as 'left' | 'center' | 'right',
                              })
                            }
                          >
                            <option value="left">Left (toward −X)</option>
                            <option value="center">Center</option>
                            <option value="right">Right (+X)</option>
                          </select>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.dimLabel}>Align Z</span>
                          <select
                            className={styles.matSelect}
                            value={pl.alignZ ?? 'center'}
                            onChange={(e) =>
                              patchPlacement(pl.id, {
                                alignZ: e.target.value as 'back' | 'center' | 'front',
                              })
                            }
                          >
                            <option value="back">Back (−Z)</option>
                            <option value="center">Center</option>
                            <option value="front">Front (+Z)</option>
                          </select>
                        </div>
                        <div className={styles.propSliders}>
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Scale bias"
                            min={PROP_SETTING_MIN}
                            max={PROP_SETTING_MAX}
                            step={0.05}
                            value={pl.scaleBias ?? 1}
                            onChange={(v) => patchPlacement(pl.id, { scaleBias: clampPropUnsigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Scale X"
                            min={PROP_SETTING_MIN}
                            max={PROP_SETTING_MAX}
                            step={0.05}
                            value={pl.scaleX ?? 1}
                            onChange={(v) => patchPlacement(pl.id, { scaleX: clampPropUnsigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Scale Y"
                            min={PROP_SETTING_MIN}
                            max={PROP_SETTING_MAX}
                            step={0.05}
                            value={pl.scaleY ?? 1}
                            onChange={(v) => patchPlacement(pl.id, { scaleY: clampPropUnsigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Scale Z"
                            min={PROP_SETTING_MIN}
                            max={PROP_SETTING_MAX}
                            step={0.05}
                            value={pl.scaleZ ?? 1}
                            onChange={(v) => patchPlacement(pl.id, { scaleZ: clampPropUnsigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Array count X"
                            min={1}
                            max={10}
                            step={1}
                            value={pl.arrayCountX ?? 1}
                            onChange={(v) => patchPlacement(pl.id, { arrayCountX: clampIntCount(v, 1, 10) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Array count Y"
                            min={1}
                            max={10}
                            step={1}
                            value={pl.arrayCountY ?? 1}
                            onChange={(v) => patchPlacement(pl.id, { arrayCountY: clampIntCount(v, 1, 10) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Array count Z"
                            min={1}
                            max={10}
                            step={1}
                            value={pl.arrayCountZ ?? 1}
                            onChange={(v) => patchPlacement(pl.id, { arrayCountZ: clampIntCount(v, 1, 10) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Array scale jitter (±)"
                            min={0}
                            max={PROP_SETTING_MAX}
                            step={0.01}
                            value={pl.arrayScaleJitterIncrement ?? (pl.arrayScaleJitter ?? 0) * 0.5}
                            onChange={(v) =>
                              patchPlacement(pl.id, {
                                arrayScaleJitterIncrement: v <= 0 ? 0 : clampPropUnsigned(v),
                                arrayScaleJitter: undefined,
                              })
                            }
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Array spacing X (m)"
                            min={0}
                            max={PROP_SETTING_MAX}
                            step={0.005}
                            value={pl.arraySpacingX ?? 0}
                            onChange={(v) =>
                              patchPlacement(pl.id, { arraySpacingX: v <= 0 ? 0 : clampPropUnsigned(v) })
                            }
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Array spacing Y (m)"
                            min={0}
                            max={PROP_SETTING_MAX}
                            step={0.005}
                            value={pl.arraySpacingY ?? 0}
                            onChange={(v) =>
                              patchPlacement(pl.id, { arraySpacingY: v <= 0 ? 0 : clampPropUnsigned(v) })
                            }
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Array spacing Z (m)"
                            min={0}
                            max={PROP_SETTING_MAX}
                            step={0.005}
                            value={pl.arraySpacingZ ?? 0}
                            onChange={(v) =>
                              patchPlacement(pl.id, { arraySpacingZ: v <= 0 ? 0 : clampPropUnsigned(v) })
                            }
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Position offset X (m)"
                            min={PROP_SIGNED_MIN}
                            max={PROP_SIGNED_MAX}
                            step={0.002}
                            value={pl.positionOffsetX ?? 0}
                            onChange={(v) => patchPlacement(pl.id, { positionOffsetX: clampPropSigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Position offset Y (m)"
                            min={PROP_SIGNED_MIN}
                            max={PROP_SIGNED_MAX}
                            step={0.002}
                            value={pl.positionOffsetY ?? 0}
                            onChange={(v) => patchPlacement(pl.id, { positionOffsetY: clampPropSigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Position offset Z (m)"
                            min={PROP_SIGNED_MIN}
                            max={PROP_SIGNED_MAX}
                            step={0.002}
                            value={pl.positionOffsetZ ?? 0}
                            onChange={(v) => patchPlacement(pl.id, { positionOffsetZ: clampPropSigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Rotation X (deg)"
                            min={PROP_ROTATION_DEG_MIN}
                            max={PROP_ROTATION_DEG_MAX}
                            step={0.5}
                            value={((pl.rotationX ?? 0) * 180) / Math.PI}
                            onChange={(v) =>
                              patchPlacement(pl.id, { rotationX: (clampRotationDeg(v) * Math.PI) / 180 })
                            }
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Rotation Y (deg)"
                            min={PROP_ROTATION_DEG_MIN}
                            max={PROP_ROTATION_DEG_MAX}
                            step={0.5}
                            value={((pl.rotationY ?? 0) * 180) / Math.PI}
                            onChange={(v) =>
                              patchPlacement(pl.id, { rotationY: (clampRotationDeg(v) * Math.PI) / 180 })
                            }
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Rotation Z (deg)"
                            min={PROP_ROTATION_DEG_MIN}
                            max={PROP_ROTATION_DEG_MAX}
                            step={0.5}
                            value={((pl.rotationZ ?? 0) * 180) / Math.PI}
                            onChange={(v) =>
                              patchPlacement(pl.id, { rotationZ: (clampRotationDeg(v) * Math.PI) / 180 })
                            }
                          />
                          <label className={styles.propField}>
                            <span className={styles.dimLabel}>Prop group id</span>
                            <input
                              type="text"
                              className={styles.limitInput}
                              placeholder="(optional) shared id"
                              value={pl.groupId ?? ''}
                              onChange={(e) =>
                                patchPlacement(pl.id, {
                                  groupId: e.target.value.trim() || undefined,
                                })
                              }
                            />
                          </label>
                          <p className={styles.hint}>
                            Same group id: pivot is the first row (by id); others use group offset from pivot’s
                            first cell.
                          </p>
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Group offset X (m)"
                            min={PROP_SIGNED_MIN}
                            max={PROP_SIGNED_MAX}
                            step={0.002}
                            value={pl.groupOffsetX ?? 0}
                            onChange={(v) => patchPlacement(pl.id, { groupOffsetX: clampPropSigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Group offset Y (m)"
                            min={PROP_SIGNED_MIN}
                            max={PROP_SIGNED_MAX}
                            step={0.002}
                            value={pl.groupOffsetY ?? 0}
                            onChange={(v) => patchPlacement(pl.id, { groupOffsetY: clampPropSigned(v) })}
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Group offset Z (m)"
                            min={PROP_SIGNED_MIN}
                            max={PROP_SIGNED_MAX}
                            step={0.002}
                            value={pl.groupOffsetZ ?? 0}
                            onChange={(v) => patchPlacement(pl.id, { groupOffsetZ: clampPropSigned(v) })}
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.backBtn}
                          onClick={() => removePlacementRow(pl.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={override}
                          onChange={(e) => {
                            if (e.target.checked) {
                              patchPlacement(pl.id, { materialSpec: defaultMaterialSpec('#9ca3af') })
                            } else {
                              patchPlacement(pl.id, { materialSpec: null })
                            }
                          }}
                        />
                        <span>Override material (this placement)</span>
                      </label>
                      {override && pl.materialSpec ? (
                        <div className={styles.propRow}>
                          <ColorSwatchInput
                            value={pl.materialSpec.baseColorHex}
                            onChange={(v) =>
                              patchPlacement(pl.id, {
                                materialSpec: { ...pl.materialSpec, baseColorHex: v } as MaterialShaderSpec,
                              })
                            }
                            aria-label="Prop base colour"
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Roughness"
                            min={0}
                            max={1}
                            step={0.05}
                            value={pl.materialSpec.globalRoughness}
                            onChange={(val) =>
                              patchPlacement(pl.id, {
                                materialSpec: { ...pl.materialSpec, globalRoughness: val } as MaterialShaderSpec,
                              })
                            }
                          />
                          <MatSliderRow
                            className={styles.matFieldRow}
                            label="Metalness"
                            min={0}
                            max={1}
                            step={0.05}
                            value={pl.materialSpec.globalMetalness}
                            onChange={(val) =>
                              patchPlacement(pl.id, {
                                materialSpec: { ...pl.materialSpec, globalMetalness: val } as MaterialShaderSpec,
                              })
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                <button
                  type="button"
                  className={styles.saveBtn}
                  disabled={!panelPropsOk}
                  onClick={addPlacementRow}
                >
                  Add manual placement
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* ── SAVE / ACTIONS (always visible) ── */}
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={saving || !configuratorId || hasAdminSession === false}
            title={hasAdminSession === false ? 'Log in as admin on this host to save defaults.' : undefined}
          >
            {saving ? 'Saving\u2026' : 'Save as defaults'}
          </button>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/admin')}
          >
            Back to dashboard
          </button>
        </div>

        {saveMsg ? (
          <p className={`${styles.msg} ${saveMsg === 'Saved' ? styles.msgOk : styles.msgErr}`}>
            {saveMsg}
          </p>
        ) : null}
        </form>

        <div className={styles.tabsRail} role="tablist" aria-label="Admin panel sections">
          {(
            [
              ['dimensions', 'Bounding box', AdminTabDimsIcon] as const,
              ['dimensionOverlay', 'Dimension Overlay', AdminTabDimOverlayIcon] as const,
              ['camera', 'Camera', AdminTabCameraIcon] as const,
              ['parameters', 'Parameters', AdminTabParamsIcon] as const,
              ['materials', 'Materials', AdminTabMaterialsIcon] as const,
              ['uv', 'UV mapping', AdminTabUvIcon] as const,
              ['lighting', 'Lighting', AdminTabLightingIcon] as const,
              ['props', 'Props', AdminTabPropsIcon] as const,
            ] as const
          ).map(([t, label, Icon]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-label={label}
              title={label}
              aria-selected={tab === t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      <p className={styles.hint}>
        Press <kbd>P</kbd> to toggle this panel.
      </p>
    </div>
  )
}
