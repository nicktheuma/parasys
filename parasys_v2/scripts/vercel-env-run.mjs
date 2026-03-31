#!/usr/bin/env node
/**
 * Runs the Vercel CLI after optionally loading `.env.vercel.local` into the process env.
 * Lets you use VERCEL_TOKEN without putting it in the shell profile.
 *
 * Usage: node scripts/vercel-env-run.mjs [vercel args...]
 *   npm run vercel:cli -- whoami
 *   npm run deploy   (uses this wrapper via package.json)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const envFile = path.join(root, '.env.vercel.local')

function loadEnvFile() {
  if (!existsSync(envFile)) return
  const text = readFileSync(envFile, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key) process.env[key] = val
  }
}

loadEnvFile()

const args = process.argv.slice(2)
const r = spawnSync('npx', ['vercel', ...args], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: process.env,
})
process.exit(r.status ?? 1)
