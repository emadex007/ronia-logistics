import type { ReactNode } from 'react'
import { statusLabel, statusTone } from '~/lib/format'

export function Logo({ name = 'Ronia Logistics', light = false }: { name?: string; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill={light ? '#ffffff' : '#0b2545'} />
        <path d="M16 22l16-8 16 8v20l-16 8-16-8z" fill="none" stroke="#f97316" strokeWidth="4" strokeLinejoin="round" />
        <path d="M16 22l16 8 16-8M32 30v20" fill="none" stroke={light ? '#0b2545' : '#fff'} strokeWidth="4" strokeLinejoin="round" />
      </svg>
      <span className={`font-display text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-brand-900'}`}>{name}</span>
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(status)}`}>{statusLabel(status)}</span>
}

export function PaymentBadge({ status }: { status: string }) {
  const tone = status === 'paid' ? 'bg-emerald-100 text-emerald-800' : status === 'cod' ? 'bg-violet-100 text-violet-800' : 'bg-rose-100 text-rose-700'
  const label = status === 'paid' ? 'Paid' : status === 'cod' ? 'Pay on delivery' : 'Unpaid'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-sky-200 bg-sky-50 text-sky-800'
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, accent = false }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? 'border-accent-400/40 bg-gradient-to-br from-white to-orange-50' : ''}`}>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-brand-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/** Vertical timeline of tracking events (newest first). */
export function Timeline({ events, showStaff = false }: { events: { id: number; status: string; location: string | null; note: string | null; created_at: string; staff_name?: string | null }[]; showStaff?: boolean }) {
  if (!events.length) return <p className="text-sm text-slate-500">No updates yet.</p>
  return (
    <ol className="relative ml-2 border-l-2 border-slate-200">
      {events.map((e, i) => (
        <li key={e.id} className="mb-6 ml-6 last:mb-0">
          <span
            className={`absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-white ${i === 0 ? 'bg-accent-500 ring-4 ring-orange-100' : 'bg-slate-300'}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={e.status} />
            <time className="text-xs text-slate-500">{new Date(e.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })}</time>
          </div>
          {e.location && <p className="mt-1 text-sm font-medium text-slate-800">📍 {e.location}</p>}
          {e.note && <p className="mt-0.5 text-sm text-slate-600">{e.note}</p>}
          {showStaff && e.staff_name && <p className="mt-0.5 text-xs text-slate-400">Handled by {e.staff_name}</p>}
        </li>
      ))}
    </ol>
  )
}
