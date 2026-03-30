import { type FormEvent, useCallback, useState } from 'react'
import { fetchJson } from '@/lib/api'
import type { BlendMode, MaterialShaderLayer, MaterialShaderSpec, NoiseType } from '@/lib/materialShader'
import { ColorSwatchInput } from '@/components/ColorSwatchInput'
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
  onClose,
  onSaved,
}: {
  configuratorId: string
  material: Material
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
          colorHex: material.colorHex,
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
          <fieldset className={styles.fieldset}>
            <legend>Base</legend>
            <label className={styles.row}>
              Base colour
              <ColorSwatchInput
                value={spec.baseColorHex}
                onChange={(v) => setSpec((p) => ({ ...p, baseColorHex: v }))}
                aria-label="Base colour"
              />
              <span className={styles.num} aria-hidden />
            </label>
            <label className={styles.row}>
              Roughness
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={spec.globalRoughness}
                onChange={(e) => setSpec((p) => ({ ...p, globalRoughness: Number(e.target.value) }))}
              />
              <span className={styles.num}>{spec.globalRoughness.toFixed(2)}</span>
            </label>
            <label className={styles.row}>
              Metalness
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={spec.globalMetalness}
                onChange={(e) => setSpec((p) => ({ ...p, globalMetalness: Number(e.target.value) }))}
              />
              <span className={styles.num}>{spec.globalMetalness.toFixed(2)}</span>
            </label>
            <label className={styles.row}>
              Ambient occlusion
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={spec.ambientOcclusion}
                onChange={(e) => setSpec((p) => ({ ...p, ambientOcclusion: Number(e.target.value) }))}
              />
              <span className={styles.num}>{spec.ambientOcclusion.toFixed(2)}</span>
            </label>
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
                <label className={styles.row}>
                  Mix
                  <input type="range" min={0} max={1} step={0.01} value={layer.mix}
                    onChange={(e) => updateLayer(i, { mix: Number(e.target.value) })} />
                  <span className={styles.num}>{layer.mix.toFixed(2)}</span>
                </label>
                <label className={styles.row}>
                  Blend
                  <select className={styles.select} value={layer.blendMode}
                    onChange={(e) => updateLayer(i, { blendMode: e.target.value as BlendMode })}>
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="overlay">Overlay</option>
                  </select>
                </label>
                <label className={styles.row}>
                  Noise
                  <select className={styles.select} value={layer.noiseType}
                    onChange={(e) => updateLayer(i, { noiseType: e.target.value as NoiseType })}>
                    <option value="fbm">FBM (wood-like)</option>
                    <option value="voronoi">Voronoi (cells)</option>
                    <option value="simplex">Simplex-like</option>
                    <option value="ridged">Ridged</option>
                    <option value="turbulence">Turbulence</option>
                    <option value="marble">Marble</option>
                  </select>
                </label>
                <label className={styles.row}>
                  Scale X
                  <input type="range" min={0.1} max={24} step={0.1} value={layer.noiseScale}
                    onChange={(e) => updateLayer(i, { noiseScale: Number(e.target.value) })} />
                  <span className={styles.num}>{layer.noiseScale.toFixed(1)}</span>
                </label>
                <label className={styles.row}>
                  Scale Y
                  <input type="range" min={0} max={24} step={0.1} value={layer.noiseScaleY ?? 0}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      updateLayer(i, { noiseScaleY: v > 0 ? v : undefined })
                    }} />
                  <span className={styles.num}>{(layer.noiseScaleY ?? 0) > 0 ? (layer.noiseScaleY!).toFixed(1) : '= X'}</span>
                </label>
                <label className={styles.row}>
                  Scale Z
                  <input type="range" min={0} max={24} step={0.1} value={layer.noiseScaleZ ?? 0}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      updateLayer(i, { noiseScaleZ: v > 0 ? v : undefined })
                    }} />
                  <span className={styles.num}>{(layer.noiseScaleZ ?? 0) > 0 ? (layer.noiseScaleZ!).toFixed(1) : '= X'}</span>
                </label>
                <label className={styles.row}>
                  Strength
                  <input type="range" min={0} max={2} step={0.01} value={layer.noiseStrength}
                    onChange={(e) => updateLayer(i, { noiseStrength: Number(e.target.value) })} />
                  <span className={styles.num}>{layer.noiseStrength.toFixed(2)}</span>
                </label>
                <label className={styles.row}>
                  Colour
                  <ColorSwatchInput value={layer.colorHex}
                    onChange={(v) => updateLayer(i, { colorHex: v })}
                    aria-label={`Layer ${i + 1} colour`} />
                  <span className={styles.num} aria-hidden />
                </label>
                <label className={styles.row}>
                  Roughness
                  <input type="range" min={0} max={1} step={0.01} value={layer.roughness}
                    onChange={(e) => updateLayer(i, { roughness: Number(e.target.value) })} />
                  <span className={styles.num}>{layer.roughness.toFixed(2)}</span>
                </label>
                <label className={styles.row}>
                  Metalness
                  <input type="range" min={0} max={1} step={0.01} value={layer.metalness}
                    onChange={(e) => updateLayer(i, { metalness: Number(e.target.value) })} />
                  <span className={styles.num}>{layer.metalness.toFixed(2)}</span>
                </label>
                <label className={styles.row}>
                  Displacement
                  <input type="range" min={0} max={1} step={0.01} value={layer.displacementStrength ?? 0}
                    onChange={(e) => updateLayer(i, { displacementStrength: Number(e.target.value) })} />
                  <span className={styles.num}>{(layer.displacementStrength ?? 0).toFixed(2)}</span>
                </label>
                <label className={styles.row}>
                  Normal
                  <input type="range" min={0} max={2} step={0.01} value={layer.normalStrength ?? 0}
                    onChange={(e) => updateLayer(i, { normalStrength: Number(e.target.value) })} />
                  <span className={styles.num}>{(layer.normalStrength ?? 0).toFixed(2)}</span>
                </label>
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
