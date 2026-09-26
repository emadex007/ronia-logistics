import { Link, createFileRoute } from '@tanstack/react-router'
import { getPortalDashboard } from '~/fns/portal'
import { PageHeader, StatCard, StatusBadge } from '~/components/ui'
import { MovementsTable } from '~/components/MerchantBits'
import { dateOnly, dateTime, methodLabel, money } from '~/lib/format'

export const Route = createFileRoute('/merchant/')({
  loader: () => getPortalDashboard(),
  component: PortalHome,
})

function PortalHome() {
  const d = Route.useLoaderData()
  const units = d.products.reduce((s, p) => s + p.quantity, 0)
  const value = d.products.reduce((s, p) => s + p.quantity * p.unit_price, 0)
  const low = d.products.filter((p) => p.quantity <= p.low_stock_threshold)

  return (
    <>
      <PageHeader
        title={d.merchant?.business_name ?? 'Your business'}
        subtitle="Your stock at Ronia Logistics, updated live every time an item comes in, is sold or goes out."
        actions={
          <a href={`/statement/${d.merchant?.id}`} target="_blank" rel="noreferrer" className="btn-ghost">
            🖨 Print statement
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Units in our warehouse" value={units.toLocaleString()} hint={`${d.products.length} product(s)`} accent />
        <StatCard label="Stock value" value={money(value)} />
        <StatCard label="Sold this month" value={d.month.sold} hint={money(d.month.sold_value)} />
        <StatCard label="Sent out this month" value={d.month.dispatched} hint={`All-time sold: ${d.allTime.sold}`} />
      </div>

      {low.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <b>Running low:</b> {low.map((p) => `${p.name} (${p.quantity} left)`).join(', ')}. Send more stock to keep selling.
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display font-bold text-brand-900">Your products</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">In stock</th>
                <th className="px-4 py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No products recorded yet.
                  </td>
                </tr>
              )}
              {d.products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{p.name}</p>
                    {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
                  </td>
                  <td className="px-4 py-2 text-right">{money(p.unit_price)}</td>
                  <td className={`px-4 py-2 text-right font-display text-base font-bold ${p.quantity <= p.low_stock_threshold ? 'text-rose-700' : 'text-brand-900'}`}>
                    {p.quantity}
                  </td>
                  <td className="px-4 py-2 text-right">{money(p.quantity * p.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-display font-bold text-brand-900">Latest activity</h2>
            <Link to="/merchant/history" className="text-sm font-semibold text-brand-500 hover:underline">
              Full history →
            </Link>
          </div>
          <MovementsTable rows={d.recent} showStaff={false} />
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-display font-bold text-brand-900">Recent deliveries</h2>
            <Link to="/merchant/deliveries" className="text-sm font-semibold text-brand-500 hover:underline">
              All →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {d.shipments.length === 0 && <p className="p-5 text-sm text-slate-500">No deliveries yet.</p>}
            {d.shipments.map((s) => (
              <div key={s.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-brand-900">{s.tracking_code}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-slate-500">
                  {s.receiver_name} → {s.destination_city} · {dateTime(s.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-display font-bold text-brand-900">Your money</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Total sales we recorded for you</p>
            <p className="font-display text-xl font-bold text-brand-900">{money(d.balance.sales)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Paid to you so far</p>
            <p className="font-display text-xl font-bold text-emerald-700">{money(d.balance.paid)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Balance due to you</p>
            <p className="font-display text-xl font-bold text-accent-600">{money(d.balance.owed)}</p>
          </div>
        </div>
        {d.payouts.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-sm">
            {d.payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 py-2">
                <span>
                  {dateOnly(p.paid_at)} · {methodLabel(p.method)}
                  {p.reference ? <span className="text-slate-400"> · ref {p.reference}</span> : null}
                </span>
                <span className="font-semibold text-emerald-700">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {d.alerts.length > 0 && (
        <div className="card mt-6 p-5">
          <h2 className="mb-3 font-display font-bold text-brand-900">Alerts</h2>
          <ul className="space-y-2 text-sm">
            {d.alerts.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>
                  <b>{a.title}</b> — {a.message}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{dateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
