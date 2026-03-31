import { type ChangeEvent, useCallback, useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { apiUrl, fetchJson } from '@/lib/api'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import type { PropLibraryItem } from '@/features/configurator/props/types'
import { MaterialEditorPanel } from './MaterialEditorPanel'
import styles from './adminMaterials.module.css'

const gltfLoader = new GLTFLoader()

/** Assumes glTF units are metres; returns axis-aligned bounding box size in millimetres. */
async function computeGlbBBoxMm(file: File): Promise<[number, number, number]> {
  const url = URL.createObjectURL(file)
  try {
    const gltf = await gltfLoader.loadAsync(url)
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const size = box.getSize(new THREE.Vector3())
    return [size.x * 1000, size.y * 1000, size.z * 1000]
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function AdminProps() {
  const [items, setItems] = useState<PropLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<PropLibraryItem | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await fetchJson<{ items: PropLibraryItem[] }>('/api/admin/props', { method: 'GET' })
    setLoading(false)
    if (!r.ok) {
      setError(r.error ?? 'Failed to load props')
      return
    }
    setItems(r.data?.items ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    setUploading(true)
    setUploadMsg(null)
    setError(null)
    const files = Array.from(list)
    try {
      const meta = await Promise.all(
        files.map(async (f) => {
          const bboxMm = await computeGlbBBoxMm(f)
          const name = f.name.replace(/\.glb$/i, '').trim() || 'Prop'
          return { name, bboxMm }
        }),
      )
      const fd = new FormData()
      fd.append('meta', JSON.stringify(meta))
      for (const f of files) {
        fd.append('files', f)
      }
      const res = await fetch(apiUrl('/api/admin/props/upload'), {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; items?: unknown }
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Upload failed')
        return
      }
      const n = Array.isArray(body.items) ? body.items.length : files.length
      setUploadMsg(`Uploaded ${n} GLB${n === 1 ? '' : 's'}.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <h1 className={styles.heading}>Prop library</h1>
      <p className={styles.sub}>
        Global catalog of decorative objects. Placeholder cubes use fixed sizes; GLB props are sized from
        their bounding box (assumed metres in the file → stored as mm). You can override shaders per prop.
      </p>

      <section className={styles.list} aria-label="Upload GLB props">
        <p className={styles.muted}>
          Select one or more <code>.glb</code> files. Each is analysed in the browser, then uploaded with
          its bbox used for shelf fitting.
        </p>
        <label className={styles.checkRow}>
          <input
            type="file"
            accept=".glb,model/gltf-binary"
            multiple
            disabled={uploading}
            onChange={(ev) => void onPickFiles(ev)}
          />
          <span>{uploading ? 'Processing…' : 'Choose GLB files'}</span>
        </label>
        {uploadMsg ? <p className={styles.msgOk}>{uploadMsg}</p> : null}
      </section>

      {loading ? <p className={styles.muted}>Loading…</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <section className={styles.list} aria-label="Props list">
          {items.length === 0 ? (
            <p className={styles.muted}>No props yet. Upload GLBs above or run the database seed.</p>
          ) : (
            <ul className={styles.ul}>
              {items.map((p) => (
                <li key={p.id} className={`${styles.li} ${p.enabled === false ? styles.liDisabled : ''}`}>
                  <div className={styles.liMain}>
                    <span className={styles.matMeta}>
                      <strong>{p.name}</strong>
                      <code className={styles.hex}>
                        {p.kind === 'placeholder_cube'
                          ? `${p.placeholderDimsMm[0]}×${p.placeholderDimsMm[1]}×${p.placeholderDimsMm[2]} mm`
                          : p.glbUrl ?? 'GLB'}
                      </code>
                      {p.enabled === false ? <span className={styles.disabledBadge}>Hidden</span> : null}
                    </span>
                    <div className={styles.matActions}>
                      <button type="button" className={styles.edit} onClick={() => setEditing(p)}>
                        Edit shader
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {editing ? (
        <MaterialEditorPanel
          key={editing.id}
          mode="prop"
          prop={{
            id: editing.id,
            name: editing.name,
            shader: editing.defaultShader as MaterialShaderSpec | null,
          }}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  )
}
