import { useState } from 'react'
import { Link, createFileRoute, useNavigate, useRouter, redirect } from '@tanstack/react-router'
import { listMerchants, saveMerchant } from '~/fns/merchants'
import { approveApplication, listApplications, rejectApplication } from '~/fns/accounts'
import { Alert, PageHeader } from '~/components/ui'
import { MerchantFields } from '~/components/MerchantBits'
import { dateTime, money } from '~/lib/format'

export const Route = createFileRoute('/admin/merchants/')({
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('merchants')) throw redirect({ to: '/admin' })
  },
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s.q === 'string' && s.q ? { q: s.q } : {}),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [rows, applications] = await Promise.all([listMerchants({ data: deps }), listApplications({ data: { status: 'pending' } })])
    return { rows, applications }
  },
  head: () => ({ meta: [{ title: 'Merchants — Ronia Logistics' }] }),
  component: MerchantsPage,
})

function MerchantsPage() {
  const { rows, applications } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/admin/merchants/' })
  const router = useRouter()
  const canManage = user.perms.includes('merchants')
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

      {applications.length > 0 && (
        <div className="card mb-6 overflow-hidden border-accent-400/50">
          <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-5 py-3">
            <h2 className="font-display font-bold text-orange-900">Pending applications ({applications.length})</h2>
            <p className="text-xs text-orange-800">Approving creates the merchant and activates their login.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {applications.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-display text-base font-bold text-brand-900">{a.business_name}</p>
                  <p className="text-slate-600">
                    {a.contact_name} · <a href={`tel:${a.phone}`} className="text-brand-500 hover:underline">{a.phone}</a> · {a.email}
                  </p>
                  {a.address && <p className="text-slate-500">{a.address}</p>}
                  {a.what_they_sell && <p className="text-slate-500">Sells: {a.what_they_sell}</p>}
                  <p className="mt-1 text-xs text-slate-400">Applied {dateTime(a.created_at)}</p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button
                      className="btn-accent"
                      disabled={busy}
                      onClick={async () => {
                        if (!confirm(`Approve ${a.business_name} as a merchant? Their login will work immediately.`)) return
                        setBusy(true)
                        const res = await approveApplication({ data: { id: a.id } })
                        setBusy(false)
                        if (!res.ok) return setError(res.error)
                        navigate({ to: '/admin/merchants/$id', params: { id: String(res.merchantId) } })
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={busy}
                      onClick={async () => {
                        const reason = prompt(`Reason for rejecting ${a.business_name}? (they will see this when they try to sign in)`)
                        if (reason === null) return
                        setBusy(true)
                        const res = await rejectApplication({ data: { id: a.id, reason } })
                        setBusy(false)
                        if (!res.ok) return setError(res.error)
                        router.invalidate()
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {error && !showForm && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
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
