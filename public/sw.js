// Ronia Logistics app — makes the website installable and opens quickly on slow networks.
// Pages always come fresh from the internet; only build files, icons and photos are cached.
const VERSION = 'ronia-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll([OFFLINE_URL, '/icon-192.png', '/icon-512.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Never cache logins, admin data or server calls
  if (url.pathname.startsWith('/_server') || url.pathname.startsWith('/_serverFn') || url.searchParams.has('_serverFnId')) return

  // Pages: network first, offline page if there is no connection
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Build files (hashed names), icons and uploaded photos never change → cache first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/media/') || (/\.(png|svg|woff2?)$/.test(url.pathname) && url.pathname !== '/favicon.svg')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.status === 200) {
              const copy = res.clone()
              caches.open(VERSION).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
