import { desc, eq } from 'drizzle-orm'
import { getDb } from '../../../db/index'
import type { MaterialShaderSpec, PropKind } from '../../../db/schema'
import { propLibrary } from '../../../db/schema'
import { defaultMaterialShader } from '../../../shared/materialDefaults'

export type PropLibraryRow = {
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

function mapRow(r: typeof propLibrary.$inferSelect): PropLibraryRow {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    kind: r.kind,
    glbUrl: r.glbUrl ?? null,
    placeholderDimsMm: r.placeholderDimsMm,
    defaultShader: r.defaultShader ?? null,
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function listPropsPublic(): Promise<
  { ok: true; items: PropLibraryRow[] } | { ok: false; status: number; error: string }
> {
  const db = getDb()
  if (!db) return { ok: false, status: 503, error: 'Database not configured' }
  try {
    const rows = await db
      .select()
      .from(propLibrary)
      .where(eq(propLibrary.enabled, true))
      .orderBy(desc(propLibrary.createdAt))
    return { ok: true, items: rows.map(mapRow) }
  } catch {
    return { ok: false, status: 500, error: 'Failed to list props' }
  }
}

export async function listPropsAdmin(): Promise<
  { ok: true; items: PropLibraryRow[] } | { ok: false; status: number; error: string }
> {
  const db = getDb()
  if (!db) return { ok: false, status: 503, error: 'Database not configured' }
  try {
    const rows = await db.select().from(propLibrary).orderBy(desc(propLibrary.createdAt))
    return { ok: true, items: rows.map(mapRow) }
  } catch {
    return { ok: false, status: 500, error: 'Failed to list props' }
  }
}

function slugifyBase(s: string): string {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return t || 'prop'
}

async function uniqueSlug(db: NonNullable<ReturnType<typeof getDb>>, base: string): Promise<string> {
  let slug = base
  let n = 0
  while (n < 50) {
    const found = await db.select().from(propLibrary).where(eq(propLibrary.slug, slug)).limit(1)
    if (!found[0]) return slug
    n += 1
    slug = `${base}-${n}`
  }
  return `${base}-${Date.now()}`
}

export async function createPropGlb(input: {
  name: string
  slugHint?: string
  glbUrl: string
  placeholderDimsMm: [number, number, number]
}): Promise<{ ok: true; item: PropLibraryRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) return { ok: false, status: 503, error: 'Database not configured' }
  const [dw, dh, dd] = input.placeholderDimsMm
  if (![dw, dh, dd].every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 1e7)) {
    return { ok: false, status: 400, error: 'Invalid bounding box (mm)' }
  }
  const name = input.name.trim()
  if (!name) return { ok: false, status: 400, error: 'Name required' }
  const base = slugifyBase(input.slugHint ?? name)
  try {
    const slug = await uniqueSlug(db, base)
    const [row] = await db
      .insert(propLibrary)
      .values({
        name,
        slug,
        kind: 'glb',
        glbUrl: input.glbUrl.trim(),
        placeholderDimsMm: [dw, dh, dd],
        defaultShader: defaultMaterialShader('#9ca3af'),
      })
      .returning()
    if (!row) return { ok: false, status: 500, error: 'Insert failed' }
    return { ok: true, item: mapRow(row) }
  } catch {
    return { ok: false, status: 500, error: 'Create failed' }
  }
}

export async function updatePropShader(
  id: string,
  defaultShader: MaterialShaderSpec | null,
): Promise<{ ok: true; item: PropLibraryRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) return { ok: false, status: 503, error: 'Database not configured' }
  try {
    const [row] = await db
      .update(propLibrary)
      .set({ defaultShader })
      .where(eq(propLibrary.id, id))
      .returning()
    if (!row) return { ok: false, status: 404, error: 'Not found' }
    return { ok: true, item: mapRow(row) }
  } catch {
    return { ok: false, status: 500, error: 'Update failed' }
  }
}
