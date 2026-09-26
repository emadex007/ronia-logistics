import { Link, createFileRoute } from '@tanstack/react-router'
import { getPortalShipments } from '~/fns/portal'
import { PageHeader, PaymentBadge, StatusBadge } from '~/components/ui'
import { dateTime, money } from '~/lib/format'

export const Route = createFileRoute('/merchant/deliveries')({
  loader: () => getPortalShipments(),
  component: Deliveries,
})

function Deliveries() {
  const rows = Route.useLoaderData()
  const pendingCod = rows.filter((s) => s.cod_amount > 0 && s.status !== 'delivered' && s.status !== 'cancelled').reduce((a, s) => a + s.cod_amount, 0)
  const collectedCod = rows.filter((s) => s.cod_amount > 0 && s.status === 'delivered').reduce((a, s) => a + s.cod_amount, 0)

  return (
    <>
      <PageHeader title="Deliveries" subtitle={`${rows.length} delivery(ies) sent for you`} />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">To collect (on the way)</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">{money(pendingCod)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Collected on delivery</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-700">{money(collectedCod)}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Tracking no.</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3 text-right">Collect</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Booked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No deliveries yet.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <Link to="/track" search={{ code: s.tracking_code }} className="font-mono font-semibold text-brand-900 hover:underline">
                    {s.tracking_code}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {s.receiver_name}
                  <div className="text-xs text-slate-400">{s.receiver_phone}</div>
                </td>
                <td className="px-4 py-3">
                  {s.destination_city}
                  {s.current_location && <div className="text-xs text-slate-400">Now: {s.current_location}</div>}
                </td>
                <td className="px-4 py-3 text-right">{s.cod_amount ? money(s.cod_amount) : '—'}</td>
                <td className="px-4 py-3">
                  <PaymentBadge status={s.payment_status} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{dateTime(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
