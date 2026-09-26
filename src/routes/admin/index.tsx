import { Link, createFileRoute } from '@tanstack/react-router'
import { getDashboard } from '~/fns/dashboard'
import { PageHeader, PaymentBadge, StatCard, StatusBadge } from '~/components/ui'
import { dateTime, money } from '~/lib/format'

export const Route = createFileRoute('/admin/')({
  loader: () => getDashboard(),
  component: Dashboard,
})

function Dashboard() {
  const d = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const c = d.statusCounts
  const inMotion = (c.in_transit ?? 0) + (c.arrived_hub ?? 0) + (c.out_for_delivery ?? 0)

  return (
    <>
      <PageHeader
        title={`Hello, ${user.full_name.split(' ')[0]} 👋`}
        subtitle="Here's what's happening at Ronia Logistics today."
        actions={
          <Link to="/admin/shipments/new" className="btn-accent">
            ＋ New shipment
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Booked today" value={d.todayCount} hint={`${d.deliveredToday} delivered today`} accent />
        <StatCard label="At the office" value={(c.received ?? 0) + (c.pending ?? 0)} hint="Received or awaiting pickup" />
        <StatCard label="On the move" value={inMotion} hint="In transit, at hub or out for delivery" />
        <StatCard label="Delivered (all time)" value={c.delivered ?? 0} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {d.finance && (
          <>
            <StatCard label="Income this month" value={money(d.finance.income)} />
            <StatCard label="Expenses this month" value={money(d.finance.expense)} hint={`Net: ${money(d.finance.income - d.finance.expense)}`} />
          </>
        )}
        <StatCard label="Awaiting payment" value={money(d.unpaid.total)} hint={`${d.unpaid.n} shipment(s) not yet paid`} />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-display font-bold text-brand-900">Recent shipments</h2>
          <Link to="/admin/shipments" className="text-sm font-semibold text-brand-500 hover:underline">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {d.recent.length === 0 && <p className="p-5 text-sm text-slate-500">No shipments yet. Create the first one!</p>}
          {d.recent.map((s) => (
            <Link
              key={s.id}
              to="/admin/shipments/$id"
              params={{ id: String(s.id) }}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-slate-50"
            >
              <span className="font-mono text-sm font-semibold text-brand-900">{s.tracking_code}</span>
              <span className="text-sm text-slate-600">
                {s.receiver_name} → {s.destination_city}
                {s.destination_country !== 'Nigeria' ? `, ${s.destination_country}` : ''}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <PaymentBadge status={s.payment_status} />
                <StatusBadge status={s.status} />
                <span className="hidden text-xs text-slate-400 sm:inline">{dateTime(s.created_at)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
