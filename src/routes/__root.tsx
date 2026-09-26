/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '~/styles.css?url'
import { getSiteContent } from '~/fns/public'
import { brandCss, mediaUrl } from '~/lib/site'

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
        { property: 'og:title', content: name },
        { property: 'og:description', content: st.seo_description || st.tagline || '' },
        ...(st.hero_image ? [{ property: 'og:image', content: mediaUrl(st.hero_image) }] : []),
      ],
      links: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap' },
        { rel: 'stylesheet', href: appCss },
        ...(st.favicon_key
          ? [
              { rel: 'icon', href: mediaUrl(st.favicon_key), type: iconType(st.favicon_key) },
              { rel: 'shortcut icon', href: mediaUrl(st.favicon_key) },
              { rel: 'apple-touch-icon', href: mediaUrl(st.favicon_key) },
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
      </body>
    </html>
  )
}
