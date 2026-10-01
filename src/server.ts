// Cloudflare Worker entry. TanStack Start handles every request,
// except /media/* which streams uploaded logos, photos and videos straight from R2.
// (Phase 4 adds a `scheduled` handler here to send queued SMS/email notifications.)
import handler from '@tanstack/react-start/server-entry'
import { forwardCopy, handleIncomingEmail } from './server/inbound-email'

async function serveMedia(request: Request, env: Cloudflare.Env, key: string) {
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 })
  const hasRange = request.headers.has('range')
  const obj = await env.MEDIA.get(key, hasRange ? { range: request.headers } : undefined)
  if (!obj) return new Response('Not found', { status: 404 })

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  // Keys are unique per upload, so files never change — cache for a year
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.set('x-content-type-options', 'nosniff')

  if (request.headers.get('if-none-match') === obj.httpEtag) return new Response(null, { status: 304, headers })

  const range = (obj as R2ObjectBody & { range?: { offset: number; length: number } }).range
  if (hasRange && range && 'offset' in range && 'length' in range) {
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${obj.size}`)
    headers.set('content-length', String(range.length))
    return new Response(obj.body, { status: 206, headers })
  }
  headers.set('content-length', String(obj.size))
  return new Response(obj.body, { headers })
}

/** The "install as app" description, built from Admin → Website (name, colours, app icon). */
async function manifest(env: Cloudflare.Env) {
  const rows = await env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('company_name','app_short_name','tagline','primary_color','app_icon_key','app_icon_192_key','app_icon_maskable_key','app_icon_bg')",
  ).all<{ key: string; value: string }>()
  const s = Object.fromEntries(rows.results.map((r) => [r.key, r.value])) as Record<string, string>
  const name = s.company_name || 'Ronia Logistics'
  const hex = (v: string | undefined, d: string) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v! : d)
  const media = (k?: string) => (!k ? '' : /^https?:/i.test(k) ? k : `/media/${k}`)
  const i512 = media(s.app_icon_key)
  const i192 = media(s.app_icon_192_key)
  const iMask = media(s.app_icon_maskable_key)
  // Only ever offer ONE design: phones (especially Android) pick the maskable icon for the home screen,
  // so mixing the built-in icon with a custom one shows the wrong logo.
  const icons = i512
    ? i192 && iMask
      ? [
          { src: i192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: i512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: iMask, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      : [{ src: i512, sizes: '512x512', purpose: 'any maskable' }]
    : [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
  const shortcutIcon = [{ src: i192 || i512 || '/icon-192.png', sizes: '192x192' }]
  const body = {
    id: '/',
    name,
    short_name: (s.app_short_name || name).slice(0, 12),
    description: s.tagline || 'Book deliveries and track packages.',
    start_url: '/?app=1',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: hex(s.app_icon_bg, '#ffffff'),
    theme_color: hex(s.primary_color, '#0b2545'),
    icons,
    shortcuts: [
      { name: 'Track a package', url: '/track', icons: shortcutIcon },
      { name: 'Book a delivery', url: '/book', icons: shortcutIcon },
      { name: 'My deliveries (riders)', url: '/admin/deliveries', icons: shortcutIcon },
      { name: 'Merchant portal', url: '/merchant', icons: shortcutIcon },
    ],
  }
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=300' },
  })
}

export default {
  async fetch(request: Request, env: Cloudflare.Env) {
    const url = new URL(request.url)
    if (url.pathname === '/manifest.webmanifest') return manifest(env)
    // Browsers ask for /favicon.ico directly — serve the icon uploaded in Admin → Website
    if (url.pathname === '/favicon.ico') {
      const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'favicon_key'").first<{ value: string }>()
      if (row?.value && !/^https?:/i.test(row.value)) {
        const res = await serveMedia(request, env, row.value)
        if (res.status !== 404) {
          const headers = new Headers(res.headers)
          headers.set('cache-control', 'public, max-age=3600')
          return new Response(res.body, { status: res.status, headers })
        }
      }
      return Response.redirect(new URL('/favicon.svg', url).toString(), 302)
    }
    if (url.pathname.startsWith('/media/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return serveMedia(request, env, decodeURIComponent(url.pathname.slice('/media/'.length)))
    }
    return handler.fetch(request)
  },

  /** Emails to info@ronialogistics.com (Cloudflare Email Routing → Send to a Worker) */
  async email(message: ForwardableEmailMessage, env: Cloudflare.Env) {
    try {
      await handleIncomingEmail(message, env)
    } catch (e) {
      console.error('Incoming email failed', e)
    }
    await forwardCopy(message, env)
  },
}
