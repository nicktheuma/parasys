import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { ColorSwatchInput } from '@/components/ColorSwatchInput'
import { MaterialThumb } from '@/components/MaterialThumb'
import { fetchJson } from '@/lib/api'
import type { MaterialShaderSpec } from '@/lib/materialShader'
import { MaterialEditorPanel } from './MaterialEditorPanel'
import styles from './adminMaterials.module.css'

type Configurator = {
  id: string
  slug: string
  name: string
}

type Material = {
  id: string
  configuratorId: string
  folder: string
  name: string
  colorHex: string
  shader: MaterialShaderSpec | null
  createdAt: string
}

export function AdminMaterials() {
  const [configurators, setConfigurators] = useState<Configurator[]>([])
  const [configId, setConfigId] = useState('')
  const [items, setItems] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [folder, setFolder] = useState('')
  const [name, setName] = useState('')
  const [colorHex, setColorHex] = useState('#c4a882')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const r = await fetchJson<{ items: Configurator[] }>('/api/admin/configurators', { method: 'GET' })
      if (cancelled) return
      setLoading(false)
      if (!r.ok) {
        setError(r.error ?? 'Failed to load configurators')
        return
      }
      const list = r.data?.items ?? []
      setConfigurators(list)
      setConfigId((prev) => prev || list[0]?.id || '')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadMaterials = useCallback(async () => {
    if (!configId) {
      setItems([])
      return
    }
    setListLoading(true)
    setError(null)
    const qid = configId === '__all__' ? '__all__' : configId
    const r = await fetchJson<{ items: Material[] }>(
      `/api/admin/materials?configuratorId=${encodeURIComponent(qid)}`,
      { method: 'GET' },
    )
    setListLoading(false)
    if (!r.ok) {
      setError(r.error ?? 'Failed to load materials')
      return
    }
    setItems(r.data?.items ?? [])
  }, [configId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when configurator selection changes
    void loadMaterials()
  }, [loadMaterials])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!configId) return
    setCreating(true)
    setError(null)
    const r = await fetchJson<{ item: Material }>('/api/admin/materials', {
      method: 'POST',
      body: JSON.stringify({
        configuratorId: configId,
        folder: folder.trim(),
        name: name.trim(),
        colorHex: colorHex.trim(),
      }),
    })
    setCreating(false)
    if (!r.ok) {
      setError(r.error ?? 'Create failed')
      return
    }
    setFolder('')
    setName('')
    await loadMaterials()
  }

  async function onDelete(mat: Material) {
    if (!window.confirm('Delete this material?')) return
    const cid = configId === '__all__' ? mat.configuratorId : configId
    const r = await fetchJson(
      `/api/admin/materials/${encodeURIComponent(mat.id)}?configuratorId=${encodeURIComponent(cid)}`,
      { method: 'DELETE' },
    )
    if (!r.ok) {
      setError(r.error ?? 'Delete failed')
      return
    }
    await loadMaterials()
  }

  return (
    <div>
      <h1 className={styles.heading}>Materials library</h1>
      <p className={styles.sub}>
        Materials are scoped to a product configurator (project). Use folders to organise swatches (e.g. Wood, Metal).
      </p>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <label className={styles.pick}>
          Configurator
          <select
            className={styles.select}
            value={configId}
            onChange={(e) => setConfigId(e.target.value)}
          >
            <option value="">— Select —</option>
            <option value="__all__">All configurators</option>
            {configurators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.slug})
              </option>
            ))}
          </select>
        </label>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      {configId && configId !== '__all__' ? (
        <section className={styles.panel} aria-labelledby="add-mat">
          <h2 id="add-mat" className={styles.h2}>
            Add material
          </h2>
          <form className={styles.form} onSubmit={onCreate}>
            <div className={styles.row}>
              <label className={styles.label}>
                Folder
                <input
                  className={styles.input}
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="Wood"
                />
              </label>
              <label className={styles.label}>
                Name
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
            </div>
            <label className={styles.label}>
              Colour
              <ColorSwatchInput value={colorHex} onChange={setColorHex} aria-label="New material colour" />
            </label>
            <button type="submit" className={styles.button} disabled={creating}>
              {creating ? 'Adding…' : 'Add material'}
            </button>
          </form>
        </section>
      ) : null}

      {editing ? (
        <MaterialEditorPanel
          key={editing.id}
          configuratorId={configId === '__all__' ? editing.configuratorId : configId}
          material={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void loadMaterials()}
        />
      ) : null}

      {configId ? (
        <section className={styles.list} aria-label="Materials list">
          {listLoading ? (
            <p className={styles.muted}>Loading materials…</p>
          ) : items.length === 0 ? (
            <p className={styles.muted}>No materials yet for this configurator.</p>
          ) : (
            <ul className={styles.ul}>
              {items.map((m) => (
                <li key={m.id} className={styles.li}>
                  <MaterialThumb shader={m.shader} colorHex={m.colorHex} />
                  <span className={styles.matMeta}>
                    <strong>{m.folder ? `${m.folder} / ` : ''}</strong>
                    {m.name}
                    <code className={styles.hex}>{m.colorHex}</code>
                    {configId === '__all__' ? (
                      <span className={styles.cfgBadge}>
                        {configurators.find((c) => c.id === m.configuratorId)?.name ?? m.configuratorId}
                      </span>
                    ) : null}
                  </span>
                  <button type="button" className={styles.edit} onClick={() => setEditing(m)}>
                    Edit shader
                  </button>
                  <button type="button" className={styles.danger} onClick={() => void onDelete(m)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
