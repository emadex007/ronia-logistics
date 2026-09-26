// Cloudflare Worker entry. TanStack Start handles every request,
// except /media/* which streams uploaded logos, photos and videos straight from R2.
// (Phase 4 adds a `scheduled` handler here to send queued SMS/email notifications.)
import handler from '@tanstack/react-start/server-entry'

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

export default {
  async fetch(request: Request, env: Cloudflare.Env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/media/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return serveMedia(request, env, decodeURIComponent(url.pathname.slice('/media/'.length)))
    }
    return handler.fetch(request)
  },
}
