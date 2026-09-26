import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from './ui'
import { useSiteSettings } from './useSite'
import { mediaUrl } from '~/lib/site'

type Props = {
  title: string
  subtitle: string
  children: ReactNode
  headline?: string
  blurb?: string
  badge?: string
  wide?: boolean
}

export function AuthShell({
  title,
  subtitle,
  children,
  headline = 'Every package. Every step. Every naira.',
  blurb = "Shipments, staff, vendors' stock and the money in and out — all in one place.",
  badge,
  wide = false,
}: Props) {
  const site = useSiteSettings()
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-900 p-10 text-white md:flex md:flex-col md:justify-between">
        {site.hero_image && <img src={mediaUrl(site.hero_image)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/95 via-brand-900/80 to-brand-900/60" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl" />
        <Link to="/" className="relative">
          <Logo light name={site.company_name} src={mediaUrl(site.logo_key) || undefined} />
        </Link>
        <div className="relative">
          {badge && <p className="mb-3 inline-block rounded-full bg-accent-500/20 px-3 py-1 text-xs font-semibold tracking-wide text-orange-200 uppercase">{badge}</p>}
          <p className="font-display text-3xl font-bold">{headline}</p>
          <p className="mt-3 text-slate-300">{blurb}</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className={`w-full ${wide ? 'max-w-md' : 'max-w-sm'} py-6`}>
          <div className="mb-8 md:hidden">
            <Link to="/">
              <Logo name={site.company_name} src={mediaUrl(site.logo_key) || undefined} />
            </Link>
          </div>
          <h1 className="font-display text-2xl font-bold text-brand-900">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">{subtitle}</p>
          {children}
          <p className="mt-8 text-center text-xs text-slate-400">
            <Link to="/" className="hover:text-slate-600">
              ← Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
