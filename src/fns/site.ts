// Website editor: settings + media uploads. Only admins and staff with "Website editor" permission.
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { all, audit, db } from '~/server/db'
import { requireUser } from '~/server/auth'
import { EDITABLE_KEYS, HEX } from '~/lib/site'
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

export const saveSiteSettings = createServerFn({ method: 'POST' })
  .inputValidator((d: { values: Record<string, string> }) => d)
  .handler(async ({ data }) => {
    const me = await requireSiteEditor()
    const allowed = new Set<string>(EDITABLE_KEYS)
    const entries = (Object.entries(data.values ?? {}) as [string, unknown][]).filter((e): e is [string, string] => allowed.has(e[0]) && typeof e[1] === 'string')
    for (const [k, v] of entries) {
      if ((k === 'primary_color' || k === 'accent_color') && !HEX.test(v)) return { ok: false as const, error: 'Colours must look like #0b2545.' }
      if (k.endsWith('_json')) {
        try {
          JSON.parse(v)
        } catch {
          return { ok: false as const, error: `Invalid list data for ${k}.` }
        }
      }
      if (k === 'tracking_prefix' && !/^[A-Z0-9]{1,5}$/.test(v)) return { ok: false as const, error: 'Tracking prefix must be 1–5 capital letters or numbers.' }
      if (v.length > 20000) return { ok: false as const, error: `${k} is too long.` }
    }
    if (!entries.length) return { ok: true as const }
    await db().batch(entries.map(([k, v]) => db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v.trim())))
    await audit(me.id, 'site.update', 'settings', undefined, { keys: entries.map(([k]) => k) })
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
