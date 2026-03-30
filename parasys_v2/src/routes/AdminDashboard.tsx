import { type FormEvent, useCallback, useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchJson } from '@/lib/api'
import { TEMPLATE_OPTIONS } from '@/config/templates'
import { clampDimMm, DIM_MM } from '@/lib/configuratorDimensions'
import { getTemplateParametricPreset } from '@/features/parametric/mvp1/templateParametricPresets'
import type { TemplateParametricPreset } from '@shared/types'
import {
  EMPTY_TPL_FIELDS,
  TemplateParamFields,
  type TplFieldValues,
} from '@/components/TemplateParamFields'
import { ConfiguratorThumbnail } from '@/components/ConfiguratorThumbnail'
import styles from './adminDashboard.module.css'

type Configurator = {
  id: string
  slug: string
  name: string
  templateKey: string
  clientLabel: string | null
  settings: {
    defaultDims?: { widthMm?: number; depthMm?: number; heightMm?: number }
    templateParams?: Record<string, TemplateParametricPreset> | null
    thumbnailSrc?: string | null
  } | null
  createdAt: string
}

type FormState = {
  name: string
  slug: string
  templateKey: string
  clientLabel: string
  w: string
  d: string
  h: string
  tpl: TplFieldValues
}

const INITIAL_FORM: FormState = {
  name: '',
  slug: '',
  templateKey: TEMPLATE_OPTIONS[0].key,
  clientLabel: '',
  w: '',
  d: '',
  h: '',
  tpl: EMPTY_TPL_FIELDS,
}

type FormAction =
  | { type: 'set'; field: keyof Omit<FormState, 'tpl'>; value: string }
  | { type: 'setTpl'; value: TplFieldValues }
  | { type: 'reset' }
  | { type: 'switchTemplate'; templateKey: string; existingSettings?: Record<string, TemplateParametricPreset> | null }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'set':
      return { ...state, [action.field]: action.value }
    case 'setTpl':
      return { ...state, tpl: action.value }
    case 'reset':
      return INITIAL_FORM
    case 'switchTemplate': {
      const fromSettings = action.existingSettings?.[action.templateKey] ?? null
      const fromDefault = getTemplateParametricPreset(action.templateKey)
      const merged = { ...fromDefault, ...fromSettings }
      return { ...state, templateKey: action.templateKey, tpl: tplFromPreset(merged) }
    }
  }
}

function tplFromPreset(p: TemplateParametricPreset | null): TplFieldValues {
  if (!p) return EMPTY_TPL_FIELDS
  return {
    dividers: p.dividers != null ? String(p.dividers) : '',
    shelves: p.shelves != null ? String(p.shelves) : '',
    edgeOffset: p.edgeOffset != null ? String(p.edgeOffset) : '',
    slotOffsetFactor: p.slotOffsetFactor != null ? String(p.slotOffsetFactor) : '',
    interlockEnabled: p.interlockEnabled ?? true,
    interlockClearance: p.interlockClearanceFactor != null ? String(p.interlockClearanceFactor) : '',
    interlockLength: p.interlockLengthFactor != null ? String(p.interlockLengthFactor) : '',
  }
}

function buildSettingsFromForm(form: FormState):
  | {
      defaultDims?: { widthMm: number; depthMm: number; heightMm: number }
      templateParams?: Record<string, TemplateParametricPreset>
    }
  | undefined {
  const out: {
    defaultDims?: { widthMm: number; depthMm: number; heightMm: number }
    templateParams?: Record<string, TemplateParametricPreset>
  } = {}

  const has = form.w.trim() !== '' || form.d.trim() !== '' || form.h.trim() !== ''
  if (has) {
    out.defaultDims = {
      widthMm: clampDimMm('width', form.w.trim() === '' ? DIM_MM.width.default : Number(form.w)),
      depthMm: clampDimMm('depth', form.d.trim() === '' ? DIM_MM.depth.default : Number(form.d)),
      heightMm: clampDimMm('height', form.h.trim() === '' ? DIM_MM.height.default : Number(form.h)),
    }
  }

  const n = (v: string): number | undefined => {
    const t = v.trim()
    if (!t) return undefined
    const x = Number(t)
    return Number.isFinite(x) ? x : undefined
  }
  const p: TemplateParametricPreset = {
    dividers: n(form.tpl.dividers),
    shelves: n(form.tpl.shelves),
    edgeOffset: n(form.tpl.edgeOffset),
    slotOffsetFactor: n(form.tpl.slotOffsetFactor),
    interlockEnabled: form.tpl.interlockEnabled,
    interlockClearanceFactor: n(form.tpl.interlockClearance),
    interlockLengthFactor: n(form.tpl.interlockLength),
  }
  const hasTpl = Object.values(p).some((v) => v !== undefined)
  if (hasTpl) out.templateParams = { [form.templateKey]: p }

  return Object.keys(out).length > 0 ? out : undefined
}

type ListRes = { items: Configurator[] }

export function AdminDashboard() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Configurator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createForm, dispatchCreate] = useReducer(formReducer, INITIAL_FORM)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await fetchJson<ListRes>('/api/admin/configurators', { method: 'GET' })
    setLoading(false)
    if (!r.ok) {
      setError(r.error ?? 'Failed to load')
      return
    }
    setItems(r.data?.items ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    const settings = buildSettingsFromForm(createForm)
    const r = await fetchJson<{ item: Configurator }>('/api/admin/configurators', {
      method: 'POST',
      body: JSON.stringify({
        name: createForm.name,
        slug: createForm.slug.trim().toLowerCase().replace(/\s+/g, '-'),
        templateKey: createForm.templateKey,
        clientLabel: createForm.clientLabel.trim() || undefined,
        ...(settings ? { settings } : {}),
      }),
    })
    setCreating(false)
    if (!r.ok) {
      setError(r.error ?? 'Create failed')
      return
    }
    dispatchCreate({ type: 'reset' })
    setShowCreateModal(false)
    await load()
  }

  async function onDelete(c: Configurator) {
    if (!window.confirm(`Delete "${c.name}"? This removes related orders and materials.`)) return
    setError(null)
    const r = await fetchJson(`/api/admin/configurators/${encodeURIComponent(c.id)}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      setError(r.error ?? 'Delete failed')
      return
    }
    await load()
  }

  return (
    <div>
      <h1 className={styles.heading}>Product configurators</h1>
      <p className={styles.sub}>
        Each entry is a hosted configurator you can map to a client path (reverse proxy). Public
        visitors never see this admin.
      </p>

      <button
        type="button"
        className={styles.button}
        style={{ marginBottom: '1.25rem' }}
        onClick={() => { dispatchCreate({ type: 'reset' }); setShowCreateModal(true) }}
      >
        + New configurator
      </button>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section aria-label="Configurators">
        {loading ? (
          <p className={styles.muted}>Loading\u2026</p>
        ) : items.length === 0 ? (
          <p className={styles.muted}>No configurators yet. Create one above.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((c) => (
              <li key={c.id} className={styles.listRow}>
                <div className={styles.listThumb} title="Configurator preview image">
                  <ConfiguratorThumbnail templateKey={c.templateKey} settings={c.settings} />
                </div>
                <div className={styles.listMain}>
                  <h3 className={styles.listTitle}>{c.name}</h3>
                  <p className={styles.listMeta}>
                    <code>/{c.slug}</code>
                    <span aria-hidden="true"> · </span>
                    <span>{c.templateKey.replace(/_/g, ' ')}</span>
                    {c.clientLabel ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{c.clientLabel}</span>
                      </>
                    ) : null}
                  </p>
                  {c.settings?.defaultDims ? (
                    <p className={styles.listDims}>
                      Defaults (mm): W {c.settings.defaultDims.widthMm ?? '\u2014'} \u00d7 D{' '}
                      {c.settings.defaultDims.depthMm ?? '\u2014'} \u00d7 H{' '}
                      {c.settings.defaultDims.heightMm ?? '\u2014'}
                    </p>
                  ) : null}
                </div>
                <div className={styles.listActions}>
                  <a
                    className={styles.preview}
                    href={`/c/${encodeURIComponent(c.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Preview \u2192
                  </a>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => navigate(`/c/${encodeURIComponent(c.slug)}`)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => void onDelete(c)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showCreateModal ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-labelledby="create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-title" className={styles.modalTitle}>
              New configurator
            </h2>
            <form className={styles.form} onSubmit={onCreate}>
              <div className={styles.row}>
                <label className={styles.label}>
                  Name
                  <input
                    className={styles.input}
                    value={createForm.name}
                    onChange={(e) => dispatchCreate({ type: 'set', field: 'name', value: e.target.value })}
                    required
                    placeholder="Oak desk — Acme Ltd"
                  />
                </label>
                <label className={styles.label}>
                  URL slug
                  <input
                    className={styles.input}
                    value={createForm.slug}
                    onChange={(e) => dispatchCreate({ type: 'set', field: 'slug', value: e.target.value })}
                    required
                    placeholder="acme-desk"
                    pattern="[a-z0-9][a-z0-9-]*"
                    title="Lowercase letters, numbers, hyphens"
                  />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>
                  Template
                  <select
                    className={styles.select}
                    value={createForm.templateKey}
                    onChange={(e) =>
                      dispatchCreate({ type: 'switchTemplate', templateKey: e.target.value })
                    }
                  >
                    {TEMPLATE_OPTIONS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  Client label (optional)
                  <input
                    className={styles.input}
                    value={createForm.clientLabel}
                    onChange={(e) =>
                      dispatchCreate({ type: 'set', field: 'clientLabel', value: e.target.value })
                    }
                    placeholder="Acme Manufacturing"
                  />
                </label>
              </div>
              <p className={styles.dimHint}>
                Default dimensions (mm, optional)
              </p>
              <div className={styles.row3}>
                <label className={styles.label}>
                  Width
                  <input className={styles.input} type="number" value={createForm.w} onChange={(e) => dispatchCreate({ type: 'set', field: 'w', value: e.target.value })} placeholder={String(DIM_MM.width.default)} min={DIM_MM.width.min} max={DIM_MM.width.max} />
                </label>
                <label className={styles.label}>
                  Depth
                  <input className={styles.input} type="number" value={createForm.d} onChange={(e) => dispatchCreate({ type: 'set', field: 'd', value: e.target.value })} placeholder={String(DIM_MM.depth.default)} min={DIM_MM.depth.min} max={DIM_MM.depth.max} />
                </label>
                <label className={styles.label}>
                  Height
                  <input className={styles.input} type="number" value={createForm.h} onChange={(e) => dispatchCreate({ type: 'set', field: 'h', value: e.target.value })} placeholder={String(DIM_MM.height.default)} min={DIM_MM.height.min} max={DIM_MM.height.max} />
                </label>
              </div>
              <TemplateParamFields
                value={createForm.tpl}
                onChange={(tpl) => dispatchCreate({ type: 'setTpl', value: tpl })}
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondary} onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.button} disabled={creating}>
                  {creating ? 'Creating\u2026' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
