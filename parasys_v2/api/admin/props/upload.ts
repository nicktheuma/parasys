import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import formidable from 'formidable'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAdminRequest } from '../../_lib/auth'
import { createPropGlb, type PropLibraryRow } from '../../_lib/handlers/props'
import { json } from '../../_lib/http'

type MetaEntry = { name: string; bboxMm: [number, number, number] }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  if (!(await isAdminRequest(req))) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'props')
  await mkdir(uploadDir, { recursive: true })

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024,
    maxFiles: 24,
    filename: () => `${randomUUID()}.glb`,
  })

  let fields: formidable.Fields
  let files: formidable.Files
  try {
    ;[fields, files] = await form.parse(req as any)
  } catch {
    json(res, 400, { error: 'Multipart parse failed' })
    return
  }

  const metaStr = fields.meta
  const metaRaw = Array.isArray(metaStr) ? metaStr[0] : metaStr
  let meta: MetaEntry[] = []
  try {
    if (typeof metaRaw === 'string') meta = JSON.parse(metaRaw) as MetaEntry[]
  } catch {
    json(res, 400, { error: 'Invalid meta JSON' })
    return
  }

  const rawFiles = files.files
  const fileArr = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : []
  if (fileArr.length === 0) {
    json(res, 400, { error: 'No files' })
    return
  }
  if (meta.length !== fileArr.length) {
    json(res, 400, { error: 'meta array length must match number of files' })
    return
  }

  const items: PropLibraryRow[] = []
  for (let i = 0; i < fileArr.length; i += 1) {
    const f = fileArr[i] as formidable.File
    const m = meta[i]
    if (!m?.name?.trim() || !Array.isArray(m.bboxMm) || m.bboxMm.length !== 3) {
      json(res, 400, { error: `Invalid meta for file ${i}` })
      return
    }
    const base = path.basename(f.filepath)
    const glbUrl = `/uploads/props/${base}`
    const r = await createPropGlb({
      name: m.name.trim(),
      slugHint: m.name,
      glbUrl,
      placeholderDimsMm: [m.bboxMm[0], m.bboxMm[1], m.bboxMm[2]],
    })
    if (!r.ok) {
      json(res, r.status, { error: r.error })
      return
    }
    items.push(r.item)
  }

  json(res, 200, { items })
}
