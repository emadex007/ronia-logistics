// Server-only database helpers. Only import this from inside server functions.
import { env } from 'cloudflare:workers'

export function db() {
  return env.DB
}

export async function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
  const res = await env.DB.prepare(sql).bind(...params).all<T>()
  return res.results ?? []
}

export async function first<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null> {
  return env.DB.prepare(sql).bind(...params).first<T>()
}

export async function run(sql: string, ...params: unknown[]) {
  return env.DB.prepare(sql).bind(...params).run()
}

export function nowIso() {
  return new Date().toISOString()
}

/** Today's date in Lagos time as YYYY-MM-DD */
export function todayLagos() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
}

export async function audit(userId: number | null, action: string, entity?: string, entityId?: number, details?: unknown) {
  await run(
    'INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    userId,
    action,
    entity ?? null,
    entityId ?? null,
    details === undefined ? null : JSON.stringify(details),
  )
}
