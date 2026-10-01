/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '~/styles.css?url'
import { getSiteContent } from '~/fns/public'
import { brandCss, mediaUrl } from '~/lib/site'

/** Changes whenever the app's name, icon or colours change, so phones fetch the new app details instead of a saved copy. */
function appVersion(st: Record<string, string>) {
  const raw = ['app_name', 'company_name', 'app_short_name', 'app_icon_key', 'app_icon_192_key', 'app_icon_maskable_key', 'app_icon_bg', 'primary_color']
    .map((k) => st[k] ?? '')
    .join('|')
  let h = 0
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function iconType(key: string) {
  const ext = key.split('.').pop()?.toLowerCase()
  return ext === 'ico' ? 'image/x-icon' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
}

export const Route = createRootRoute({
  loader: () => getSiteContent(),
  head: ({ loaderData }) => {
    const st = loaderData?.settings ?? {}
    const name = st.company_name || 'Ronia Logistics'
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: `${name} — Track your package` },
        { name: 'description', content: st.seo_description || 'Same-day, interstate and international deliveries with live package tracking.' },
        { name: 'theme-color', content: st.primary_color || '#0b2545' },
        // Installable phone app (Android "Install app", iPhone "Add to Home Screen")
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: (st.app_short_name || st.app_name || name).trim().slice(0, 12) },
        { property: 'og:title', content: name },
        { property: 'og:description', content: st.seo_description || st.tagline || '' },
        ...(st.hero_image ? [{ property: 'og:image', content: mediaUrl(st.hero_image) }] : []),
      ],
      links: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap' },
        { rel: 'stylesheet', href: appCss },
        { rel: 'manifest', href: `/manifest.webmanifest?v=${appVersion(st)}` },
        { rel: 'apple-touch-icon', href: st.app_icon_key ? mediaUrl(st.app_icon_key) : '/apple-touch-icon.png' },
        ...(st.favicon_key
          ? [
              { rel: 'icon', href: mediaUrl(st.favicon_key), type: iconType(st.favicon_key) },
              { rel: 'shortcut icon', href: mediaUrl(st.favicon_key) },
            ]
          : [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }]),
      ],
      styles: [{ children: brandCss(st) }],
    }
  },
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-display text-6xl font-extrabold text-brand-900">404</p>
      <p className="mt-3 text-slate-600">We couldn't find that page.</p>
      <Link to="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  ),
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
      </body>
    </html>
  )
}
