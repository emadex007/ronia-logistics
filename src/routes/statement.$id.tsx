import { createFileRoute, notFound, redirect, useNavigate } from '@tanstack/react-router'
import { getMe } from '~/fns/auth'
import { getStatementFn } from '~/fns/portal'
import { getSiteContent } from '~/fns/public'
import { Logo } from '~/components/ui'
import { MovementsTable } from '~/components/MerchantBits'
import { dateOnly, dateTime, money } from '~/lib/format'

type Search = { from?: string; to?: string }

export const Route = createFileRoute('/statement/$id')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    from: typeof s.from === 'string' && s.from ? s.from : undefined,
    to: typeof s.to === 'string' && s.to ? s.to : undefined,
  }),
  beforeLoad: async () => {
    if (!(await getMe())) throw redirect({ to: '/login' })
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const [st, site] = await Promise.all([getStatementFn({ data: { merchantId: Number(params.id), from: deps.from, to: deps.to } }), getSiteContent()])
    if (!st) throw notFound()
    return { ...st, settings: site.settings }
  },
  head: () => ({ meta: [{ title: 'Stock statement — Ronia Logistics' }] }),
  component: Statement,
})

function Statement() {
  const st = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/statement/$id' })
  const { merchant: m, products, movements, totals, settings } = st
  const units = products.reduce((s, p) => s + p.quantity, 0)
  const value = products.reduce((s, p) => s + p.quantity * p.unit_price, 0)
  const period = st.from || st.to ? `${st.from ? dateOnly(st.from) : 'Start'} – ${st.to ? dateOnly(st.to) : 'Today'}` : 'All time'

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <form
        className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-end gap-2 px-4"
        onSubmit={(e) => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
          navigate({ search: { from: f.from || undefined, to: f.to || undefined } })
        }}
      >
        <label className="text-xs">
          <span className="label">From</span>
          <input type="date" name="from" defaultValue={search.from} className="input" />
        </label>
        <label className="text-xs">
          <span className="label">To</span>
          <input type="date" name="to" defaultValue={search.to} className="input" />
        </label>
        <button className="btn-ghost">Apply</button>
        <button type="button" className="btn-primary ml-auto" onClick={() => window.print()}>
          🖨 Print
        </button>
      </form>

      <div className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-6 border-b-2 border-brand-900 pb-5">
          <div>
            <Logo name={settings.company_name} />
            <p className="mt-2 text-xs text-slate-600">{settings.address}</p>
            <p className="text-xs text-slate-600">
              {settings.phone} · {settings.email}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-extrabold text-brand-900">STOCK STATEMENT</p>
            <p className="mt-1 text-sm font-semibold">{m.business_name}</p>
            <p className="text-xs text-slate-500">Period: {period}</p>
            <p className="text-xs text-slate-500">
              Printed {dateTime(new Date().toISOString())} by {st.printedBy}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
          {[
            ['Received', totals.received],
            ['Sold', totals.sold],
            ['Sales value', money(totals.sold_value)],
            ['Sent out', totals.dispatched],
            ['Returned', totals.returned],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-slate-200 p-3">
              <p className="text-[11px] tracking-wide text-slate-500 uppercase">{l}</p>
              <p className="font-display text-lg font-bold text-brand-900">{v}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-6 mb-2 font-display font-bold text-brand-900">Current stock in warehouse</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-y border-slate-300 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="py-2">Product</th>
              <th className="py-2">SKU</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-1.5">{p.name}</td>
                <td className="py-1.5 text-slate-500">{p.sku ?? '—'}</td>
                <td className="py-1.5 text-right">{money(p.unit_price)}</td>
                <td className="py-1.5 text-right font-semibold">{p.quantity}</td>
                <td className="py-1.5 text-right">{money(p.quantity * p.unit_price)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className="py-2" colSpan={3}>
                Total
              </td>
              <td className="py-2 text-right">{units}</td>
              <td className="py-2 text-right">{money(value)}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt-8 mb-2 font-display font-bold text-brand-900">Movements ({period})</h2>
        <MovementsTable rows={movements} compact />

        <div className="mt-12 grid grid-cols-2 gap-10 text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-1">For {settings.company_name}</div>
          <div className="border-t border-slate-400 pt-1">For {m.business_name}</div>
        </div>
      </div>
    </div>
  )
}
