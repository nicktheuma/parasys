import { getDb } from '../../db/index.js'
import { auditLog } from '../../db/schema.js'

export async function logAuditEvent(
  userId: string | undefined,
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown> | null,
): Promise<void> {
  const db = getDb()
  if (!db) return
  try {
    await db.insert(auditLog).values({
      userId: userId ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      details: details ?? null,
    })
  } catch {
    // Audit logging must not break the main operation
  }
}
