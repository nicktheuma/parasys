#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const base = (process.argv[2] ?? 'https://parasysv2.vercel.app').replace(/\/$/, '')
const requiredEnvKeys = ['ADMIN_PASSWORD', 'SESSION_SECRET', 'DATABASE_URL', 'PUBLIC_APP_URL']

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`OK: ${message}`)
}

function checkEnvKeys() {
  const r = spawnSync('npx', ['vercel', 'env', 'ls'], {
    encoding: 'utf8',
    shell: true,
  })
  if (r.status !== 0) {
    fail(`unable to read Vercel env list (${r.stderr || 'unknown error'})`)
  }
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`
  for (const key of requiredEnvKeys) {
    if (!out.includes(key)) fail(`missing required Vercel env var: ${key}`)
  }
  pass('required Vercel env vars exist')
}

async function checkJson(pathname, expectedStatus) {
  const res = await fetch(`${base}${pathname}`)
  const bodyText = await res.text()
  if (res.status !== expectedStatus) {
    fail(`${pathname} returned ${res.status} (expected ${expectedStatus}) -> ${bodyText.slice(0, 240)}`)
  }
  if (bodyText.includes('FUNCTION_INVOCATION_FAILED')) {
    fail(`${pathname} failed with FUNCTION_INVOCATION_FAILED`)
  }
  let data = null
  try {
    data = JSON.parse(bodyText)
  } catch {
    fail(`${pathname} did not return valid JSON`)
  }
  pass(`${pathname} responded ${expectedStatus}`)
  return data
}

async function main() {
  checkEnvKeys()
  const session = await checkJson('/api/auth/session', 200)
  if (typeof session?.ok !== 'boolean') fail('/api/auth/session missing boolean ok field')

  const props = await checkJson('/api/props', 200)
  if (!Array.isArray(props?.items)) fail('/api/props missing items array')
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
