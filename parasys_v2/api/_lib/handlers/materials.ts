import { and, desc, eq, inArray, or } from 'drizzle-orm'
import type { MaterialShaderSpec } from '../../../db/schema'
import { getDb } from '../../../db/index.js'
import { configurators, materials, materialAssignments } from '../../../db/schema.js'
import { defaultMaterialShader, normalizeMaterialShader } from '../materialShaderNormalize.js'

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

export type MaterialRow = {
  id: string
  configuratorId: string
  folder: string
  name: string
  colorHex: string
  shader: MaterialShaderSpec | null
  enabled: boolean
  createdAt: string
  /** True when this row is included because of material_assignments, not native ownership */
  linkedViaAssignment?: boolean
}

function mapRow(r: typeof materials.$inferSelect): MaterialRow {
  return {
    id: r.id,
    configuratorId: r.configuratorId,
    folder: r.folder,
    name: r.name,
    colorHex: r.colorHex,
    shader: r.shader ?? null,
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function listMaterials(
  configuratorId: string,
): Promise<{ ok: true; items: MaterialRow[] } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const assignedRows = await db
    .select({ materialId: materialAssignments.materialId })
    .from(materialAssignments)
    .where(eq(materialAssignments.configuratorId, configuratorId))
  const assignedIds = assignedRows.map((r) => r.materialId)

  const rows =
    assignedIds.length === 0
      ? await db
          .select()
          .from(materials)
          .where(eq(materials.configuratorId, configuratorId))
          .orderBy(desc(materials.createdAt))
      : await db
          .select()
          .from(materials)
          .where(or(eq(materials.configuratorId, configuratorId), inArray(materials.id, assignedIds)))
          .orderBy(desc(materials.createdAt))

  const items = rows.map((r) => {
    const row = mapRow(r)
    return {
      ...row,
      linkedViaAssignment: row.configuratorId !== configuratorId,
    }
  })
  return { ok: true, items }
}

export async function listAllMaterials(): Promise<
  { ok: true; items: MaterialRow[] } | { ok: false; status: number; error: string }
> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const rows = await db.select().from(materials).orderBy(desc(materials.createdAt))
  return { ok: true, items: rows.map(mapRow) }
}

export async function createMaterial(input: {
  configuratorId: string
  folder?: string
  name: string
  colorHex?: string
  shader?: unknown
}): Promise<{ ok: true; item: MaterialRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  if (!input.configuratorId?.trim()) {
    return { ok: false, status: 400, error: 'configuratorId required' }
  }
  const name = input.name.trim()
  if (!name) {
    return { ok: false, status: 400, error: 'Name required' }
  }
  const colorHex = (input.colorHex ?? '#888888').trim()
  if (!HEX_RE.test(colorHex)) {
    return { ok: false, status: 400, error: 'colorHex must be #RGB or #RRGGBB' }
  }
  const cfg = await db
    .select({ id: configurators.id })
    .from(configurators)
    .where(eq(configurators.id, input.configuratorId))
    .limit(1)
  if (!cfg[0]) {
    return { ok: false, status: 404, error: 'Configurator not found' }
  }
  const shader =
    input.shader !== undefined
      ? normalizeMaterialShader(input.shader, colorHex)
      : defaultMaterialShader(colorHex)
  const [row] = await db
    .insert(materials)
    .values({
      configuratorId: input.configuratorId,
      folder: (input.folder ?? '').trim(),
      name,
      colorHex,
      shader,
    })
    .returning()
  if (!row) {
    return { ok: false, status: 500, error: 'Insert failed' }
  }
  return { ok: true, item: mapRow(row) }
}

export async function updateMaterial(
  id: string,
  configuratorId: string,
  patch: {
    folder?: string
    name?: string
    colorHex?: string
    shader?: unknown | null
    enabled?: boolean
  },
): Promise<{ ok: true; item: MaterialRow } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const existing = await db
    .select()
    .from(materials)
    .where(and(eq(materials.id, id), eq(materials.configuratorId, configuratorId)))
    .limit(1)
  const row0 = existing[0]
  if (!row0) {
    return { ok: false, status: 404, error: 'Not found' }
  }

  const updates: Partial<typeof materials.$inferInsert> = {}
  if (patch.folder !== undefined) {
    updates.folder = patch.folder.trim()
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) return { ok: false, status: 400, error: 'Name required' }
    updates.name = name
  }
  let nextHex = row0.colorHex
  if (patch.colorHex !== undefined) {
    const colorHex = patch.colorHex.trim()
    if (!HEX_RE.test(colorHex)) {
      return { ok: false, status: 400, error: 'colorHex must be #RGB or #RRGGBB' }
    }
    updates.colorHex = colorHex
    nextHex = colorHex
  }
  if (patch.shader !== undefined) {
    if (patch.shader === null) {
      updates.shader = null
    } else {
      updates.shader = normalizeMaterialShader(patch.shader, nextHex)
    }
  }
  if (patch.enabled !== undefined) {
    updates.enabled = patch.enabled
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true, item: mapRow(row0) }
  }

  const [row] = await db
    .update(materials)
    .set(updates)
    .where(and(eq(materials.id, id), eq(materials.configuratorId, configuratorId)))
    .returning()
  if (!row) {
    return { ok: false, status: 404, error: 'Not found' }
  }
  return { ok: true, item: mapRow(row) }
}

export async function deleteMaterial(
  id: string,
  configuratorId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) {
    return { ok: false, status: 503, error: 'Database not configured (DATABASE_URL)' }
  }
  const del = await db
    .delete(materials)
    .where(and(eq(materials.id, id), eq(materials.configuratorId, configuratorId)))
    .returning({ id: materials.id })
  if (del.length === 0) {
    return { ok: false, status: 404, error: 'Not found' }
  }
  return { ok: true }
}

export async function assignMaterial(
  materialId: string,
  configuratorId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) return { ok: false, status: 503, error: 'Database not configured' }
  const existing = await db
    .select({ id: materialAssignments.id })
    .from(materialAssignments)
    .where(and(eq(materialAssignments.materialId, materialId), eq(materialAssignments.configuratorId, configuratorId)))
    .limit(1)
  if (existing[0]) return { ok: true }
  await db.insert(materialAssignments).values({ materialId, configuratorId })
  return { ok: true }
}

export async function unassignMaterial(
  materialId: string,
  configuratorId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = getDb()
  if (!db) return { ok: false, status: 503, error: 'Database not configured' }
  await db
    .delete(materialAssignments)
    .where(and(eq(materialAssignments.materialId, materialId), eq(materialAssignments.configuratorId, configuratorId)))
  return { ok: true }
}

export async function getAssignedConfiguratorIds(
  materialId: string,
): Promise<string[]> {
  const db = getDb()
  if (!db) return []
  const rows = await db
    .select({ configuratorId: materialAssignments.configuratorId })
    .from(materialAssignments)
    .where(eq(materialAssignments.materialId, materialId))
  return rows.map((r) => r.configuratorId)
}

export async function listMaterialsForPublicConfigurator(
  configuratorId: string,
): Promise<MaterialRow[]> {
  const db = getDb()
  if (!db) return []
  const assignedIds = await db
    .select({ materialId: materialAssignments.materialId })
    .from(materialAssignments)
    .where(eq(materialAssignments.configuratorId, configuratorId))
  const assignedMatIds = assignedIds.map((r) => r.materialId)

  const condition = assignedMatIds.length > 0
    ? and(eq(materials.enabled, true), or(
        eq(materials.configuratorId, configuratorId),
        inArray(materials.id, assignedMatIds),
      ))
    : and(eq(materials.enabled, true), eq(materials.configuratorId, configuratorId))

  const rows = await db
    .select()
    .from(materials)
    .where(condition!)
    .orderBy(desc(materials.createdAt))
  return rows.map(mapRow)
}
