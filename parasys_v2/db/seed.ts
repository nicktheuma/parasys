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
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { defaultMaterialShader } from '../shared/materialDefaults'
import { getDb } from './index'
import { configurators, materials, users } from './schema'

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

  console.log('[seed] done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
