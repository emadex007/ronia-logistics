// Website editor: settings + media uploads. Only admins and staff with "Website editor" permission.
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { all, audit, db } from '~/server/db'
import { requireUser } from '~/server/auth'
import { COLOR_KEYS, EDITABLE_KEYS, HEX, NUMBER_KEYS } from '~/lib/site'
import type { Settings } from '~/lib/types'

async function requireSiteEditor() {
  const me = await requireUser(['admin', 'manager', 'staff', 'rider'])
  if (me.role !== 'admin' && !me.can_edit_site) throw new Error('You do not have permission to edit the website. Ask the administrator.')
  return me
}

export const getSiteSettings = createServerFn({ method: 'GET' }).handler(async () => {
  await requireSiteEditor()
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings')
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Settings
})

/** Validates editor values; returns the clean [key, value] pairs or an error message. */
function validateValues(values: Record<string, unknown>): { entries: [string, string][] } | { error: string } {
  const allowed = new Set<string>(EDITABLE_KEYS)
  const entries = (Object.entries(values ?? {}) as [string, unknown][]).filter((e): e is [string, string] => allowed.has(e[0]) && typeof e[1] === 'string')
  for (const [k, v] of entries) {
    if (COLOR_KEYS.includes(k) && !HEX.test(v)) return { error: 'Colours must look like #0b2545.' }
    if (k in NUMBER_KEYS) {
      const [min, max] = NUMBER_KEYS[k]
      const n = Number(v)
      if (!Number.isFinite(n) || n < min || n > max) return { error: `${k.replace(/_/g, ' ')} must be between ${min} and ${max}.` }
    }
    if (k.endsWith('_json')) {
      try {
        JSON.parse(v)
      } catch {
        return { error: `Invalid list data for ${k}.` }
      }
    }
    if (k === 'tracking_prefix' && !/^[A-Z0-9]{1,5}$/.test(v)) return { error: 'Tracking prefix must be 1–5 capital letters or numbers.' }
    if (v.length > 20000) return { error: `${k} is too long.` }
  }
  return { entries }
}

async function writeSettings(entries: [string, string][]) {
  if (!entries.length) return
  await db().batch(entries.map(([k, v]) => db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v.trim())))
}

export const saveSiteSettings = createServerFn({ method: 'POST' })
  .inputValidator((d: { values: Record<string, string> }) => d)
  .handler(async ({ data }) => {
    const me = await requireSiteEditor()
    const res = validateValues(data.values)
    if ('error' in res) return { ok: false as const, error: res.error }
    await writeSettings(res.entries)
    await audit(me.id, 'site.update', 'settings', undefined, { keys: res.entries.map(([k]) => k) })
    return { ok: true as const }
  })

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}
const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm' }
const MAX_IMAGE = 8 * 1024 * 1024
const MAX_VIDEO = 60 * 1024 * 1024

/** Upload a logo, icon, photo or short video to R2. Returns the key to store in settings. */
export const uploadMedia = createServerFn({ method: 'POST' })
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error('Expected a file upload.')
    return d
  })
  .handler(async ({ data }) => {
    const me = await requireSiteEditor()
    const file = data.get('file')
    if (!file || typeof file === 'string') return { ok: false as const, error: 'No file received.' }
    const ext = IMAGE_TYPES[file.type] ?? VIDEO_TYPES[file.type]
    if (!ext) return { ok: false as const, error: 'Use a JPG, PNG, WebP or GIF image (ICO for the site icon), or an MP4/WebM video.' }
    const isVideo = file.type in VIDEO_TYPES
    if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) {
      return { ok: false as const, error: isVideo ? 'Videos must be under 60 MB. Use a short, compressed clip.' : 'Images must be under 8 MB.' }
    }
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')
    const key = `site/${Date.now()}-${rand}.${ext}`
    await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } })
    await audit(me.id, 'site.upload', 'media', undefined, { key, size: file.size, type: file.type })
    return { ok: true as const, key }
  })

// ───────────── Export / import (copy the website between localhost and live) ─────────────

const MEDIA_KEY_RE = /site\/[0-9]+-[0-9a-f]+\.(?:jpg|png|webp|gif|ico|mp4|webm)/g
const MAX_EMBED_TOTAL = 45 * 1024 * 1024

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let out = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(out)
}
function fromBase64(b64: string) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export type SiteExport = {
  app: 'ronia-website'
  version: 1
  exported_at: string
  settings: Record<string, string>
  media: Record<string, { type: string; data: string }>
  skipped: string[]
}

/** Everything in the Website editor, plus the uploaded photos/logo embedded, as one JSON file. */
export const exportSite = createServerFn({ method: 'GET' }).handler(async () => {
  await requireSiteEditor()
  const allowed = new Set<string>(EDITABLE_KEYS)
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings')
  const settings = Object.fromEntries(rows.filter((r) => allowed.has(r.key)).map((r) => [r.key, r.value]))
  const keys = new Set<string>()
  for (const v of Object.values(settings)) for (const m of v.matchAll(MEDIA_KEY_RE)) keys.add(m[0])

  const media: SiteExport['media'] = {}
  const skipped: string[] = []
  let total = 0
  for (const key of keys) {
    const obj = await env.MEDIA.get(key)
    if (!obj) {
      skipped.push(`${key} (missing)`)
      continue
    }
    if (total + obj.size > MAX_EMBED_TOTAL) {
      skipped.push(`${key} (too large to include — re-upload it on the other site)`)
      continue
    }
    total += obj.size
    media[key] = { type: obj.httpMetadata?.contentType ?? 'application/octet-stream', data: toBase64(await obj.arrayBuffer()) }
  }
  const payload: SiteExport = { app: 'ronia-website', version: 1, exported_at: new Date().toISOString(), settings, media, skipped }
  return payload
})

/** Load an export file: puts the photos into this site's storage and replaces the website settings. */
export const importSite = createServerFn({ method: 'POST' })
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error('Expected a file upload.')
    return d
  })
  .handler(async ({ data }) => {
    const me = await requireSiteEditor()
    const file = data.get('file')
    if (!file || typeof file === 'string') return { ok: false as const, error: 'No file received.' }
    let payload: SiteExport
    try {
      payload = JSON.parse(await file.text())
    } catch {
      return { ok: false as const, error: 'That file is not a website export.' }
    }
    if (payload?.app !== 'ronia-website' || !payload.settings) return { ok: false as const, error: 'That file is not a website export from this system.' }

    const res = validateValues(payload.settings)
    if ('error' in res) return { ok: false as const, error: res.error }

    let uploaded = 0
    for (const [key, m] of Object.entries(payload.media ?? {})) {
      const match = key.match(MEDIA_KEY_RE)
      if (!match || match[0] !== key) continue
      if (!(m.type in IMAGE_TYPES) && !(m.type in VIDEO_TYPES)) continue
      await env.MEDIA.put(key, fromBase64(m.data), { httpMetadata: { contentType: m.type } })
      uploaded++
    }
    await writeSettings(res.entries)
    await audit(me.id, 'site.import', 'settings', undefined, { keys: res.entries.length, media: uploaded, from: payload.exported_at })
    return { ok: true as const, settings: res.entries.length, media: uploaded, skipped: payload.skipped ?? [] }
  })
