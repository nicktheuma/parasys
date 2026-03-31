/**
 * Inserts demo configurators + materials + initial admin user (idempotent).
 * Run: npm run db:seed
 *
 * Rebuild demo rows (drops existing demo configurators by slug — cascades materials, orders, assignments):
 *   npm run db:seed:demos
 *
 * Each demo has a single default material; `defaultMaterialId` in settings points to it.
 */
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { defaultMaterialShader } from '../shared/materialDefaults'
import { getDb } from './index'
import type { ConfiguratorSettingsRow } from './schema'
import { configurators, materials, propLibrary, users } from './schema'

const PLACEHOLDER_PROPS = [
  { slug: 'cube-small', name: 'Placeholder cube (small)', placeholderDimsMm: [80, 120, 60] as [number, number, number] },
  { slug: 'cube-medium', name: 'Placeholder cube (medium)', placeholderDimsMm: [120, 180, 100] as [number, number, number] },
  { slug: 'cube-tall', name: 'Placeholder cube (tall)', placeholderDimsMm: [100, 220, 80] as [number, number, number] },
  { slug: 'cube-wide', name: 'Placeholder cube (wide)', placeholderDimsMm: [160, 80, 140] as [number, number, number] },
] as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.join(__dirname, '..', '.env') })

const DEMOS = [
  {
    slug: 'demo-oak-shelf',
    name: 'Oak shelving unit',
    templateKey: 'open_shelf',
    settings: { defaultDims: { widthMm: 900, depthMm: 350, heightMm: 1900 } },
    material: { folder: 'Wood', name: 'Natural oak', colorHex: '#c4a882' },
  },
  {
    slug: 'demo-media-console',
    name: 'Walnut media console',
    templateKey: 'media_unit',
    settings: { defaultDims: { widthMm: 1600, depthMm: 450, heightMm: 520 } },
    material: { folder: 'Wood', name: 'American walnut', colorHex: '#6b4e3d' },
  },
  {
    slug: 'demo-kitchen-island',
    name: 'Kitchen island',
    templateKey: 'kitchen_island',
    settings: { defaultDims: { widthMm: 1800, depthMm: 900, heightMm: 920 } },
    material: { folder: 'Stone', name: 'Quartz white', colorHex: '#e8e6e1' },
  },
] as const

const reseedDemos =
  process.argv.includes('--reseed-demos') || process.env.RESEED_DEMOS === '1'

async function main() {
  const db = getDb()
  if (!db) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  for (const p of PLACEHOLDER_PROPS) {
    const found = await db.select().from(propLibrary).where(eq(propLibrary.slug, p.slug)).limit(1)
    if (found[0]) continue
    await db.insert(propLibrary).values({
      name: p.name,
      slug: p.slug,
      kind: 'placeholder_cube',
      placeholderDimsMm: p.placeholderDimsMm,
      glbUrl: null,
      defaultShader: defaultMaterialShader('#9ca3af'),
    })
    console.log(`[seed] created prop_library: ${p.slug}`)
  }

  if (reseedDemos) {
    console.log('[seed] reseed-demos: removing existing demo configurators (cascade)...')
    for (const demo of DEMOS) {
      const found = await db
        .select({ id: configurators.id })
        .from(configurators)
        .where(eq(configurators.slug, demo.slug))
        .limit(1)
      if (found[0]) {
        await db.delete(configurators).where(eq(configurators.id, found[0].id))
        console.log(`[seed]   deleted: ${demo.slug}`)
      }
    }
  }

  for (const demo of DEMOS) {
    const existing = await db.select().from(configurators).where(eq(configurators.slug, demo.slug)).limit(1)
    if (existing[0]) {
      console.log(`[seed] skip (exists): ${demo.slug}`)
      continue
    }
    const [row] = await db
      .insert(configurators)
      .values({
        slug: demo.slug,
        name: demo.name,
        templateKey: demo.templateKey,
        settings: demo.settings,
      })
      .returning()
    if (!row) continue
    console.log(`[seed] created configurator ${demo.slug}`)
    const m = demo.material
    const [mRow] = await db
      .insert(materials)
      .values({
        configuratorId: row.id,
        folder: m.folder,
        name: m.name,
        colorHex: m.colorHex,
        shader: defaultMaterialShader(m.colorHex),
      })
      .returning()
    if (!mRow) continue
    await db
      .update(configurators)
      .set({
        settings: {
          ...demo.settings,
          defaultMaterialId: mRow.id,
        },
      })
      .where(eq(configurators.id, row.id))
    console.log(`[seed]   + 1 material (default)`)
  }
  const adminEmail = 'admin@parasys.local'
  const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1)
  if (existingAdmin) {
    console.log(`[seed] skip admin user (exists): ${adminEmail}`)
  } else {
    const hash = await bcrypt.hash('admin1234', 12)
    await db.insert(users).values({ email: adminEmail, passwordHash: hash, role: 'admin' })
    console.log(`[seed] created admin user: ${adminEmail} / admin1234  ← change this password!`)
  }

  /** One placeholder on shelf:1 for each panel demo so props are visible without admin setup */
  const medium = await db.select().from(propLibrary).where(eq(propLibrary.slug, 'cube-medium')).limit(1)
  const mediumId = medium[0]?.id
  if (mediumId) {
    for (const slug of ['demo-oak-shelf', 'demo-media-console', 'demo-kitchen-island'] as const) {
      const rows = await db.select().from(configurators).where(eq(configurators.slug, slug)).limit(1)
      const row = rows[0]
      if (!row) continue
      const prev = (row.settings ?? null) as ConfiguratorSettingsRow | null
      if (prev?.props?.placements?.length) continue
      const base: ConfiguratorSettingsRow = prev ?? {}
      await db
        .update(configurators)
        .set({
          settings: {
            ...base,
            props: {
              placements: [
                {
                  id: randomUUID(),
                  propLibraryId: mediumId,
                  anchorId: 'shelf:1',
                  scaleBias: 1,
                },
              ],
            },
          },
        })
        .where(eq(configurators.id, row.id))
      console.log(`[seed] default prop placement for ${slug}`)
    }
  } else {
    console.log('[seed] skip demo prop placements (cube-medium missing)')
  }

  console.log('[seed] done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
