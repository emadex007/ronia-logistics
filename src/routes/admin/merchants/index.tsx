import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { listMerchants, saveMerchant } from '~/fns/merchants'
import { Alert, PageHeader } from '~/components/ui'
import { MerchantFields } from '~/components/MerchantBits'
import { money } from '~/lib/format'

export const Route = createFileRoute('/admin/merchants/')({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s.q === 'string' && s.q ? { q: s.q } : {}),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listMerchants({ data: deps }),
  head: () => ({ meta: [{ title: 'Merchants — Ronia Logistics' }] }),
  component: MerchantsPage,
})

function MerchantsPage() {
  const rows = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/admin/merchants/' })
  const canManage = user.role === 'admin' || user.role === 'manager'
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState(search.q ?? '')

  const totalValue = rows.reduce((s, r) => s + r.stock_value, 0)
  const totalUnits = rows.reduce((s, r) => s + r.units_in_stock, 0)

  return (
    <>
      <PageHeader
        title="Merchants & stock"
        subtitle={`${rows.length} merchant(s) · ${totalUnits.toLocaleString()} units in the warehouse · ${money(totalValue)} stock value`}
        actions={
          canManage && (
            <button className="btn-accent" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Close' : '＋ Add merchant'}
            </button>
          )
        }
      />

      {showForm && (
        <form
          className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
            setBusy(true)
            setError('')
            const res = await saveMerchant({ data: f as never })
            setBusy(false)
            if (!res.ok) return setError(res.error)
            navigate({ to: '/admin/merchants/$id', params: { id: String(res.id) } })
          }}
        >
          <h2 className="font-display font-bold text-brand-900 sm:col-span-2 lg:col-span-3">New merchant</h2>
          {error && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Alert>{error}</Alert>
            </div>
          )}
          <MerchantFields />
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save merchant'}
            </button>
          </div>
        </form>
      )}

      <form
        className="card mb-4 flex gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          navigate({ search: q ? { q } : {} })
        }}
      >
        <input className="input" placeholder="Search business, contact or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary">Search</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">No merchants yet.</p>}
        {rows.map((m) => (
          <Link
            key={m.id}
            to="/admin/merchants/$id"
            params={{ id: String(m.id) }}
            className={`card block p-5 transition hover:-translate-y-0.5 hover:shadow-md ${m.is_active ? '' : 'opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display font-bold text-brand-900">{m.business_name}</p>
                <p className="text-xs text-slate-500">
                  {m.contact_name ?? '—'}
                  {m.phone ? ` · ${m.phone}` : ''}
                </p>
              </div>
              {!m.is_active && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase">Inactive</span>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="font-display text-lg font-bold text-brand-900">{m.product_count}</p>
                <p className="text-[11px] text-slate-500">products</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="font-display text-lg font-bold text-brand-900">{m.units_in_stock}</p>
                <p className="text-[11px] text-slate-500">units</p>
              </div>
              <div className={`rounded-lg p-2 ${m.low_stock ? 'bg-rose-50' : 'bg-slate-50'}`}>
                <p className={`font-display text-lg font-bold ${m.low_stock ? 'text-rose-700' : 'text-brand-900'}`}>{m.low_stock}</p>
                <p className="text-[11px] text-slate-500">low stock</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Stock value {money(m.stock_value)}</span>
              <span>{m.has_login ? '✓ Portal login' : 'No portal login'}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
