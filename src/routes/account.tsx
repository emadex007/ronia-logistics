import { useState } from 'react'
import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getMe, logout } from '~/fns/auth'
import { getMyShipments, unwatchShipment, watchShipment } from '~/fns/accounts'
import { getSiteContent } from '~/fns/public'
import { SiteLayout } from '~/components/SiteLayout'
import { PaymentBadge, StatusBadge } from '~/components/ui'
import { dateTime, money } from '~/lib/format'
import type { Shipment } from '~/lib/types'

export const Route = createFileRoute('/account')({
  beforeLoad: async () => {
    const me = await getMe()
    if (!me) throw redirect({ to: '/login' })
    if (me.role === 'merchant') throw redirect({ to: '/merchant' })
    if (me.role !== 'customer') throw redirect({ to: '/admin' })
  },
  loader: async () => {
    const [data, site] = await Promise.all([getMyShipments(), getSiteContent()])
    return { ...data, settings: site.settings }
  },
  head: () => ({ meta: [{ title: 'My account — Ronia Logistics' }] }),
  component: Account,
})

function Account() {
  const d = Route.useLoaderData()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const active = d.mine.filter((s) => s.status !== 'delivered' && s.status !== 'cancelled').length

  return (
    <SiteLayout settings={d.settings}>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-900">Hello, {d.me.full_name.split(' ')[0]}</h1>
            <p className="text-sm text-slate-500">
              {d.mine.length} package(s) on your account · {active} on the way
            </p>
          </div>
          <button
            className="btn-ghost"
            onClick={async () => {
              await logout()
              await router.invalidate()
              router.navigate({ to: '/' })
            }}
          >
            Log out
          </button>
        </div>

        <form
          className="card mt-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-center"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            const res = await watchShipment({ data: { code } })
            setBusy(false)
            if (!res.ok) return setError(res.error)
            setCode('')
            router.invalidate()
          }}
        >
          <p className="text-sm font-semibold text-slate-700 sm:w-56">Follow a package</p>
          <input
            className="input font-mono uppercase"
            placeholder="Enter a tracking number"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button className="btn-accent shrink-0" disabled={busy}>
            Add to my list
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}

        <ShipmentList title="Packages you sent" rows={d.mine} empty="No packages linked to your account yet. Give the front desk your account email when you send one." />
        <ShipmentList
          title="Packages you're following"
          rows={d.watching}
          empty="Add any tracking number above to follow it here."
          onRemove={async (id) => {
            await unwatchShipment({ data: { shipment_id: id } })
            router.invalidate()
          }}
        />
      </section>
    </SiteLayout>
  )
}

function ShipmentList({ title, rows, empty, onRemove }: { title: string; rows: Shipment[]; empty: string; onRemove?: (id: number) => void }) {
  return (
    <div className="card mt-6 overflow-hidden">
      <h2 className="border-b border-slate-100 px-5 py-4 font-display font-bold text-brand-900">{title}</h2>
      {rows.length === 0 && <p className="p-5 text-sm text-slate-500">{empty}</p>}
      <div className="divide-y divide-slate-100">
        {rows.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
            <div className="min-w-0 flex-1">
              <Link to="/track" search={{ code: s.tracking_code }} className="font-mono font-semibold text-brand-900 hover:underline">
                {s.tracking_code}
              </Link>
              <p className="text-sm text-slate-600">
                To {s.receiver_name} · {s.destination_city}
                {s.destination_country !== 'Nigeria' ? `, ${s.destination_country}` : ''}
              </p>
              <p className="text-xs text-slate-400">
                {s.current_location ? `Now at ${s.current_location} · ` : ''}updated {dateTime(s.updated_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {s.payment_status !== 'paid' && s.shipping_fee > 0 ? (
                <Link to="/track" search={{ code: s.tracking_code }} className="rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white">
                  Pay {money(s.shipping_fee)}
                </Link>
              ) : (
                <PaymentBadge status={s.payment_status} />
              )}
              <StatusBadge status={s.status} />
              {onRemove && (
                <button className="text-xs text-slate-400 hover:text-rose-600" onClick={() => onRemove(s.id)}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
