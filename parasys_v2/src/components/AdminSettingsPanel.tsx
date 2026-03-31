import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
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
  AdminTabDimsIcon,
  AdminTabLightingIcon,
  AdminTabMaterialsIcon,
  AdminTabParamsIcon,
  AdminTabUvIcon,
} from './icons'
import { FACE_GROUPS } from '@shared/types'
import styles from './adminSettingsPanel.module.css'

type Tab = 'dimensions' | 'parameters' | 'materials' | 'uv' | 'lighting'

type NumericParamKey = Exclude<keyof TemplateParametricPreset, 'interlockEnabled'>

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
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [uvSurfaceKind, setUvSurfaceKind] = useState('back')
  const [expandedFace, setExpandedFace] = useState<FaceGroup | null>(null)
  const [lightingPick, setLightingPick] = useState<LightingTabId>('ambient')

  useEffect(() => {
    if (tab === 'lighting') setLightingEditorPick(lightingPick)
    else setLightingEditorPick(null)
  }, [tab, lightingPick, setLightingEditorPick])

  useEffect(
    () => () => {
      setLightingEditorPick(null)
    },
    [setLightingEditorPick],
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
            templateParams: { [templateKey]: merged },
            paramLimits: { [templateKey]: localLimits },
            uvMappings: uvMappings ?? {},
            ...(lighting && Object.keys(lighting).length > 0 ? { lighting } : {}),
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
            <p className={styles.sectionTitle}>Dimensions (mm)</p>
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
              <MatSliderRow
                className={styles.matFieldRow}
                label="HDR blur"
                min={0}
                max={1}
                step={0.02}
                value={resolvedLight.environmentBlur}
                onChange={(v) => patchLighting({ environmentBlur: v })}
              />
            ) : null}
          </div>
        ) : null}

        {/* ── SAVE / ACTIONS (always visible) ── */}
        <div className={styles.actions}>
          <button type="submit" className={styles.saveBtn} disabled={saving || !configuratorId}>
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
              ['dimensions', 'Dimensions', AdminTabDimsIcon] as const,
              ['parameters', 'Parameters', AdminTabParamsIcon] as const,
              ['materials', 'Materials', AdminTabMaterialsIcon] as const,
              ['uv', 'UV mapping', AdminTabUvIcon] as const,
              ['lighting', 'Lighting', AdminTabLightingIcon] as const,
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
