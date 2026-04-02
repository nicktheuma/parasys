import { desc, eq } from 'drizzle-orm'
import type { ConfiguratorSettingsRow, MaterialShaderSpec, PropKind } from '../../../db/schema'
import { getDb } from '../../../db/index.js'
import { configurators } from '../../../db/schema.js'
import { TEMPLATE_KEYS } from '../../../shared/constants.js'
import { normalizeSettings } from '../dimensions.js'
import { listMaterialsForPublicConfigurator } from './materials.js'
import { listPropsPublic } from './props.js'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

export type ConfiguratorRow = {
  id: string
  slug: string
  name: string
  templateKey: string
  clientLabel: string | null
  settings: ConfiguratorSettingsRow | null
  createdAt: string
}

function mapRow(r: typeof configurators.$inferSelect): ConfiguratorRow {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    templateKey: r.templateKey,
    clientLabel: r.clientLabel ?? null,
    settings: normalizeSettings(r.settings),
    createdAt: r.createdAt.toISOString(),
  }
}

function isPublicSettings(settings: ConfiguratorSettingsRow | null | undefined): boolean {
  return settings?.isPublic !== false
}

export async function listConfigurators(): Promise<
  { ok: true; items: ConfiguratorRow[] } | { ok: false; status: number; error: string }
> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const rows = await db.select().from(configurators).orderBy(desc(configurators.createdAt))
  return { ok: true, items: rows.map(mapRow) }
}

export async function createConfigurator(input: {
  name: string
  slug: string
  templateKey: string
  clientLabel?: string
  settings?: ConfiguratorSettingsRow | null
}): Promise<{ ok: true; item: ConfiguratorRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const slug = input.slug.trim().toLowerCase()
  if (!SLUG_RE.test(slug)) {
    return { ok: false, status: 400, error: 'Invalid slug' }
  }
  if (!TEMPLATE_KEYS.has(input.templateKey)) {
    return { ok: false, status: 400, error: 'Invalid template' }
  }
  const name = input.name.trim()
  if (!name) {
    return { ok: false, status: 400, error: 'Name required' }
  }
  const settings = input.settings != null ? normalizeSettings(input.settings) : null
  try {
    const [row] = await db
      .insert(configurators)
      .values({
        slug,
        name,
        templateKey: input.templateKey,
        clientLabel: input.clientLabel?.trim() || null,
        settings,
      })
      .returning()
    if (!row) {
      return { ok: false, status: 500, error: 'Insert failed' }
    }
    return { ok: true, item: mapRow(row) }
  } catch {
    return { ok: false, status: 409, error: 'Slug already exists' }
  }
}

export async function getConfiguratorBySlug(
  slug: string,
): Promise<{ ok: true; item: ConfiguratorRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const rows = await db.select().from(configurators).where(eq(configurators.slug, slug)).limit(1)
  const row = rows[0]
  if (!row) {
    return { ok: false, status: 404, error: 'Not found' }
  }
  return { ok: true, item: mapRow(row) }
}

export type PublicMaterialRow = {
  id: string
  name: string
  folder: string
  colorHex: string
  shader: MaterialShaderSpec | null
}

/** Enabled global prop catalog rows (same shape as GET /api/props) */
export type PublicPropLibraryRow = {
  id: string
  name: string
  slug: string
  kind: PropKind
  glbUrl: string | null
  placeholderDimsMm: [number, number, number]
  defaultShader: MaterialShaderSpec | null
  enabled: boolean
  createdAt: string
}

export async function getPublicConfigurator(
  slug: string,
  opts?: { allowPrivate?: boolean },
): Promise<
  | {
      ok: true
      item: {
        id: string
        slug: string
        name: string
        templateKey: string
        settings: ConfiguratorSettingsRow | null
        materials: PublicMaterialRow[]
        propsCatalog: PublicPropLibraryRow[]
      }
    }
  | { ok: false; status: number; error: string }
> {
  const r = await getConfiguratorBySlug(slug.trim())
  if (!r.ok) return r
  if (!opts?.allowPrivate && !isPublicSettings(r.item.settings)) {
    return { ok: false, status: 404, error: 'Not found' }
  }
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const matRows = await listMaterialsForPublicConfigurator(r.item.id)

  const materialsOut: PublicMaterialRow[] = matRows.map((m) => ({
    id: m.id,
    name: m.name,
    folder: m.folder,
    colorHex: m.colorHex,
    shader: m.shader ?? null,
  }))

  const propsR = await listPropsPublic()
  const propsCatalog: PublicPropLibraryRow[] = propsR.ok ? propsR.items : []

  const { id: cid, slug: s, name, templateKey, settings } = r.item
  return {
    ok: true,
    item: {
      id: cid,
      slug: s,
      name,
      templateKey,
      settings,
      materials: materialsOut,
      propsCatalog,
    },
  }
}

export type PublicConfiguratorListItem = {
  slug: string
  name: string
  templateKey: string
  clientLabel: string | null
}

export async function listPublicConfigurators(): Promise<
  { ok: true; items: PublicConfiguratorListItem[] } | { ok: false; status: number; error: string }
> {
  const db = getDb()
  if (!db) return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  const rows = await db.select().from(configurators).orderBy(desc(configurators.createdAt))
  const items = rows
    .filter((r) => isPublicSettings(r.settings))
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      templateKey: r.templateKey,
      clientLabel: r.clientLabel ?? null,
    }))
  return { ok: true, items }
}

export async function updateConfigurator(
  id: string,
  patch: {
    name?: string
    slug?: string
    templateKey?: string
    clientLabel?: string | null
    settings?: ConfiguratorSettingsRow | null
  },
): Promise<{ ok: true; item: ConfiguratorRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const existing = await db.select().from(configurators).where(eq(configurators.id, id)).limit(1)
  if (!existing[0]) {
    return { ok: false, status: 404, error: 'Not found' }
  }

  const updates: Partial<typeof configurators.$inferInsert> = {}
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) return { ok: false, status: 400, error: 'Name required' }
    updates.name = name
  }
  if (patch.slug !== undefined) {
    const slug = patch.slug.trim().toLowerCase()
    if (!SLUG_RE.test(slug)) return { ok: false, status: 400, error: 'Invalid slug' }
    updates.slug = slug
  }
  if (patch.templateKey !== undefined) {
    if (!TEMPLATE_KEYS.has(patch.templateKey)) {
      return { ok: false, status: 400, error: 'Invalid template' }
    }
    updates.templateKey = patch.templateKey
  }
  if (patch.clientLabel !== undefined) {
    updates.clientLabel = patch.clientLabel?.trim() || null
  }
  if (patch.settings !== undefined) {
    if (patch.settings === null) {
      updates.settings = null
    } else {
      const prev = existing[0].settings
      const merged: ConfiguratorSettingsRow = {
        ...prev,
        ...patch.settings,
        defaultDims:
          patch.settings.defaultDims !== undefined
            ? {
                ...prev?.defaultDims,
                ...patch.settings.defaultDims,
              }
            : prev?.defaultDims,
        defaultMaterialId:
          patch.settings.defaultMaterialId !== undefined
            ? patch.settings.defaultMaterialId
            : prev?.defaultMaterialId,
        paramGraph:
          patch.settings.paramGraph !== undefined ? patch.settings.paramGraph : prev?.paramGraph,
        templateParams:
          patch.settings.templateParams !== undefined
            ? {
                ...(prev?.templateParams ?? {}),
                ...patch.settings.templateParams,
              }
            : prev?.templateParams,
        dimLimits:
          patch.settings.dimLimits !== undefined
            ? {
                ...(prev?.dimLimits ?? {}),
                ...patch.settings.dimLimits,
              }
            : prev?.dimLimits,
        paramLimits:
          patch.settings.paramLimits !== undefined
            ? {
                ...(prev?.paramLimits ?? {}),
                ...patch.settings.paramLimits,
              }
            : prev?.paramLimits,
        uvMappings:
          patch.settings.uvMappings !== undefined
            ? {
                ...(prev?.uvMappings ?? {}),
                ...patch.settings.uvMappings,
              }
            : prev?.uvMappings,
        lighting:
          patch.settings.lighting !== undefined
            ? {
                ...(prev?.lighting ?? {}),
                ...patch.settings.lighting,
                directional0: {
                  ...(prev?.lighting?.directional0 ?? {}),
                  ...patch.settings.lighting?.directional0,
                },
                directional1: {
                  ...(prev?.lighting?.directional1 ?? {}),
                  ...patch.settings.lighting?.directional1,
                },
                directional2: {
                  ...(prev?.lighting?.directional2 ?? {}),
                  ...patch.settings.lighting?.directional2,
                },
                keySpot: {
                  ...(prev?.lighting?.keySpot ?? {}),
                  ...patch.settings.lighting?.keySpot,
                },
                fillPoint: {
                  ...(prev?.lighting?.fillPoint ?? {}),
                  ...patch.settings.lighting?.fillPoint,
                },
              }
            : prev?.lighting,
        props: patch.settings.props !== undefined ? patch.settings.props : prev?.props,
      }
      updates.settings = normalizeSettings(merged)
    }
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true, item: mapRow(existing[0]) }
  }

  try {
    const [row] = await db.update(configurators).set(updates).where(eq(configurators.id, id)).returning()
    if (!row) return { ok: false, status: 404, error: 'Not found' }
    return { ok: true, item: mapRow(row) }
  } catch {
    return { ok: false, status: 409, error: 'Slug already exists' }
  }
}

export async function deleteConfigurator(
  id: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const deleted = await db.delete(configurators).where(eq(configurators.id, id)).returning({ id: configurators.id })
  if (deleted.length === 0) {
    return { ok: false, status: 404, error: 'Not found' }
  }
  return { ok: true }
}
