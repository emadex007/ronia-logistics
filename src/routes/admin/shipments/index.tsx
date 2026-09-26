import { useState } from 'react'
import { Link, createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { listShipments } from '~/fns/shipments'
import { PageHeader, PaymentBadge, StatusBadge } from '~/components/ui'
import { STATUSES, dateTime, money } from '~/lib/format'

type Search = { q?: string; status?: string; page?: number }

export const Route = createFileRoute('/admin/shipments/')({
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('shipments')) throw redirect({ to: '/admin' })
  },
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    page: Number(s.page) > 1 ? Number(s.page) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listShipments({ data: deps }),
  component: ShipmentsPage,
})

function ShipmentsPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/admin/shipments/' })
  const [q, setQ] = useState(search.q ?? '')

  return (
    <>
      <PageHeader
        title="Shipments"
        subtitle={`${data.total} shipment${data.total === 1 ? '' : 's'}`}
        actions={
          <Link to="/admin/shipments/new" className="btn-accent">
            ＋ New shipment
          </Link>
        }
      />

      <form
        className="card mb-4 flex flex-col gap-2 p-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          navigate({ search: (s) => ({ ...s, q: q || undefined, page: undefined }) })
        }}
      >
        <input className="input" placeholder="Search tracking no., name, phone or city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          className="input sm:w-56"
          value={search.status ?? ''}
          onChange={(e) => navigate({ search: (s) => ({ ...s, status: e.target.value || undefined, page: undefined }) })}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="btn-primary">Search</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Tracking no.</th>
              <th className="px-4 py-3">Sender → Receiver</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Booked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No shipments found.
                </td>
              </tr>
            )}
            {data.rows.map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate({ to: '/admin/shipments/$id', params: { id: String(s.id) } })}>
                <td className="px-4 py-3 font-mono font-semibold text-brand-900">{s.tracking_code}</td>
                <td className="px-4 py-3">
                  {s.sender_name} <span className="text-slate-400">→</span> {s.receiver_name}
                  <div className="text-xs text-slate-400">{s.receiver_phone}</div>
                </td>
                <td className="px-4 py-3">
                  {s.destination_city}
                  {s.destination_country !== 'Nigeria' && <div className="text-xs text-slate-400">{s.destination_country}</div>}
                </td>
                <td className="px-4 py-3">{money(s.shipping_fee)}</td>
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

      {data.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button className="btn-ghost" disabled={data.page <= 1} onClick={() => navigate({ search: (s) => ({ ...s, page: data.page - 1 }) })}>
            ← Prev
          </button>
          <span className="px-2 text-slate-500">
            Page {data.page} of {data.pages}
          </span>
          <button className="btn-ghost" disabled={data.page >= data.pages} onClick={() => navigate({ search: (s) => ({ ...s, page: data.page + 1 }) })}>
            Next →
          </button>
        </div>
      )}
    </>
  )
}
