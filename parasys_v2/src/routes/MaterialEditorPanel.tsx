import { type FormEvent, useCallback, useState } from 'react'
import { fetchJson } from '@/lib/api'
import type { BlendMode, MaterialShaderLayer, MaterialShaderSpec, NoiseType } from '@/lib/materialShader'
import { ColorSwatchInput } from '@/components/ColorSwatchInput'
import { MatSliderRow, MatSliderRowScaleOptional } from '@/components/MatSliderControls'
import { defaultMaterialSpec } from '@/lib/defaultMaterialSpec'
import { MaterialEditorPreview } from './MaterialEditorPreview'
import styles from './materialEditorPanel.module.css'

type Material = {
  id: string
  configuratorId: string
  folder: string
  name: string
  colorHex: string
  shader: MaterialShaderSpec | null
  createdAt: string
}

function formatMatOptionLabel(m: { folder: string; name: string }): string {
  const f = m.folder.trim()
  return f ? `${f} / ${m.name}` : m.name
}

function cloneShaderAndSwatch(source: Material): { shader: MaterialShaderSpec; colorHex: string } {
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

export function MaterialEditorPanel({
  configuratorId,
  material,
  copySources,
  onClose,
  onSaved,
}: {
  configuratorId: string
  material: Material
  copySources?: Material[]
  onClose: () => void
  onSaved: () => void
}) {
  const [spec, setSpec] = useState<MaterialShaderSpec>(() => material.shader ?? defaultMaterialSpec(material.colorHex))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const updateLayer = useCallback((index: number, patch: Partial<MaterialShaderLayer>) => {
    setSpec((prev) => {
      const layers = [...prev.layers]
      const cur = layers[index]
      if (!cur) return prev
      layers[index] = { ...cur, ...patch }
      return { ...prev, layers }
    })
  }, [])

  const addLayer = () => {
    setSpec((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer()].slice(0, 3),
    }))
  }

  const removeLayer = (index: number) => {
    setSpec((prev) => ({
      ...prev,
      layers: prev.layers.filter((_, i) => i !== index),
    }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    const r = await fetchJson<{ item: Material }>(
      `/api/admin/materials/${encodeURIComponent(material.id)}?configuratorId=${encodeURIComponent(configuratorId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          folder: material.folder,
          name: material.name,
          colorHex: spec.baseColorHex,
          shader: spec,
        }),
      },
    )
    setSaving(false)
    if (!r.ok) {
      setErr(r.error ?? 'Save failed')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <div className={styles.overlay} role="dialog" aria-labelledby="mat-edit-title">
      <div className={styles.modal}>
        <div className={styles.head}>
          <h2 id="mat-edit-title" className={styles.title}>
            Material: {material.name}
          </h2>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={styles.body}>
          <aside className={styles.previewAside} aria-label="Live material preview">
            <p className={styles.previewCaption}>Live preview</p>
            <MaterialEditorPreview spec={spec} />
          </aside>
          <form className={styles.form} onSubmit={onSubmit}>
          {copySources && copySources.length > 0 ? (
            <div className={styles.copyRow}>
              <label className={styles.copyLabel}>
                <span>Copy settings from</span>
                <select
                  className={styles.select}
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    e.target.value = ''
                    if (!id) return
                    const source = copySources.find((m) => m.id === id)
                    if (!source) return
                    const { shader } = cloneShaderAndSwatch(source)
                    setSpec(shader)
                    setErr(null)
                  }}
                  aria-label="Copy shader settings from another material"
                >
                  <option value="">— Choose material —</option>
                  {copySources.map((m) => (
                    <option key={m.id} value={m.id}>
                      {formatMatOptionLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <fieldset className={styles.fieldset}>
            <legend>Base</legend>
            <label className={styles.rowMatWide}>
              <span>Base colour</span>
              <span className={styles.rowMatWideVal}>
                <ColorSwatchInput
                  value={spec.baseColorHex}
                  onChange={(v) => setSpec((p) => ({ ...p, baseColorHex: v }))}
                  aria-label="Base colour"
                />
              </span>
            </label>
            <MatSliderRow
              className={styles.rowMat}
              label="Roughness"
              min={0}
              max={1}
              step={0.01}
              value={spec.globalRoughness}
              onChange={(v) => setSpec((p) => ({ ...p, globalRoughness: v }))}
            />
            <MatSliderRow
              className={styles.rowMat}
              label="Metalness"
              min={0}
              max={1}
              step={0.01}
              value={spec.globalMetalness}
              onChange={(v) => setSpec((p) => ({ ...p, globalMetalness: v }))}
            />
            <MatSliderRow
              className={styles.rowMat}
              label="Ambient occlusion"
              min={0}
              max={1}
              step={0.01}
              value={spec.ambientOcclusion}
              onChange={(v) => setSpec((p) => ({ ...p, ambientOcclusion: v }))}
            />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Procedural layers (max 3)</legend>
            <p className={styles.hint}>
              Each layer samples 3D noise in world space, blends colour/roughness/metalness, and optionally applies displacement and normal perturbation.
            </p>
            {spec.layers.map((layer, i) => (
              <div key={layer.id} className={styles.layer}>
                <div className={styles.layerHead}>
                  <span>Layer {i + 1}</span>
                  <button type="button" className={styles.danger} onClick={() => removeLayer(i)}>
                    Remove
                  </button>
                </div>
                <MatSliderRow
                  className={styles.rowMat}
                  label="Mix"
                  min={0}
                  max={1}
                  step={0.01}
                  value={layer.mix}
                  onChange={(v) => updateLayer(i, { mix: v })}
                />
                <label className={styles.rowMatWide}>
                  <span>Blend</span>
                  <span className={styles.rowMatWideVal}>
                    <select className={styles.select} value={layer.blendMode}
                      onChange={(e) => updateLayer(i, { blendMode: e.target.value as BlendMode })}>
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="overlay">Overlay</option>
                    </select>
                  </span>
                </label>
                <label className={styles.rowMatWide}>
                  <span>Noise</span>
                  <span className={styles.rowMatWideVal}>
                    <select className={styles.select} value={layer.noiseType}
                      onChange={(e) => updateLayer(i, { noiseType: e.target.value as NoiseType })}>
                      <option value="fbm">FBM (wood-like)</option>
                      <option value="voronoi">Voronoi (cells)</option>
                      <option value="simplex">Simplex-like</option>
                      <option value="ridged">Ridged</option>
                      <option value="turbulence">Turbulence</option>
                      <option value="marble">Marble</option>
                    </select>
                  </span>
                </label>
                <MatSliderRow
                  className={styles.rowMat}
                  label="Pos X (m)"
                  min={-10}
                  max={10}
                  step={0.02}
                  value={layer.noiseOffsetX ?? 0}
                  onChange={(v) => updateLayer(i, { noiseOffsetX: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Pos Y (m)"
                  min={-10}
                  max={10}
                  step={0.02}
                  value={layer.noiseOffsetY ?? 0}
                  onChange={(v) => updateLayer(i, { noiseOffsetY: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Pos Z (m)"
                  min={-10}
                  max={10}
                  step={0.02}
                  value={layer.noiseOffsetZ ?? 0}
                  onChange={(v) => updateLayer(i, { noiseOffsetZ: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Rot X (rad)"
                  min={-Math.PI}
                  max={Math.PI}
                  step={0.01}
                  value={layer.noiseRotationX ?? 0}
                  onChange={(v) => updateLayer(i, { noiseRotationX: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Rot Y (rad)"
                  min={-Math.PI}
                  max={Math.PI}
                  step={0.01}
                  value={layer.noiseRotationY ?? 0}
                  onChange={(v) => updateLayer(i, { noiseRotationY: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Rot Z (rad)"
                  min={-Math.PI}
                  max={Math.PI}
                  step={0.01}
                  value={layer.noiseRotationZ ?? 0}
                  onChange={(v) => updateLayer(i, { noiseRotationZ: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Scale X"
                  min={0.1}
                  max={200}
                  step={0.1}
                  value={layer.noiseScale}
                  onChange={(v) => updateLayer(i, { noiseScale: v })}
                />
                <MatSliderRowScaleOptional
                  className={styles.rowMat}
                  label="Scale Y"
                  min={0}
                  max={200}
                  step={0.1}
                  value={layer.noiseScaleY}
                  onChange={(v) => updateLayer(i, { noiseScaleY: v })}
                  emptyLabel="= X"
                />
                <MatSliderRowScaleOptional
                  className={styles.rowMat}
                  label="Scale Z"
                  min={0}
                  max={200}
                  step={0.1}
                  value={layer.noiseScaleZ}
                  onChange={(v) => updateLayer(i, { noiseScaleZ: v })}
                  emptyLabel="= X"
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Strength"
                  min={0}
                  max={2}
                  step={0.01}
                  value={layer.noiseStrength}
                  onChange={(v) => updateLayer(i, { noiseStrength: v })}
                />
                <label className={styles.rowMatWide}>
                  <span>Colour</span>
                  <span className={styles.rowMatWideVal}>
                    <ColorSwatchInput value={layer.colorHex}
                      onChange={(v) => updateLayer(i, { colorHex: v })}
                      aria-label={`Layer ${i + 1} colour`} />
                  </span>
                </label>
                <MatSliderRow
                  className={styles.rowMat}
                  label="Roughness"
                  min={0}
                  max={1}
                  step={0.01}
                  value={layer.roughness}
                  onChange={(v) => updateLayer(i, { roughness: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Metalness"
                  min={0}
                  max={1}
                  step={0.01}
                  value={layer.metalness}
                  onChange={(v) => updateLayer(i, { metalness: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Displacement"
                  min={0}
                  max={1}
                  step={0.01}
                  value={layer.displacementStrength ?? 0}
                  onChange={(v) => updateLayer(i, { displacementStrength: v })}
                />
                <MatSliderRow
                  className={styles.rowMat}
                  label="Normal"
                  min={0}
                  max={2}
                  step={0.01}
                  value={layer.normalStrength ?? 0}
                  onChange={(v) => updateLayer(i, { normalStrength: v })}
                />
              </div>
            ))}
            {spec.layers.length < 3 ? (
              <button type="button" className={styles.addLayer} onClick={addLayer}>
                Add layer
              </button>
            ) : null}
          </fieldset>

          {err ? <p className={styles.error}>{err}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.save} disabled={saving}>
              {saving ? 'Saving…' : 'Save material'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
