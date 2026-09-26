import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from './ui'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-900 p-10 text-white md:flex md:flex-col md:justify-between">
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl" />
        <Link to="/">
          <Logo light />
        </Link>
        <div className="relative">
          <p className="font-display text-3xl font-bold">Every package. Every step. Every naira.</p>
          <p className="mt-3 text-slate-300">Shipments, staff, vendors' stock and the money in and out — all in one place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-2xl font-bold text-brand-900">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
