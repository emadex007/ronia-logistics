/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '~/styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ronia Logistics — Track your package' },
      { name: 'description', content: 'Ronia Logistics, Abuja: same-day, interstate and international deliveries with live package tracking.' },
      { name: 'theme-color', content: '#0b2545' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
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
