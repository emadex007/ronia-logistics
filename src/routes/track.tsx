import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getSiteContent, trackShipment } from '~/fns/public'
import { onlinePaymentEnabled, startOnlinePayment } from '~/fns/payments'
import { SiteLayout } from '~/components/SiteLayout'
import { StatusBadge, Timeline } from '~/components/ui'
import { PROGRESS, dateOnly, dateTime, money, serviceLabel, statusLabel } from '~/lib/format'

export const Route = createFileRoute('/track')({
  validateSearch: (s: Record<string, unknown>) => ({ code: typeof s.code === 'string' ? s.code : '' }),
  loaderDeps: ({ search }) => ({ code: search.code }),
  loader: async ({ deps }) => {
    const [site, result, canPayOnline] = await Promise.all([
      getSiteContent(),
      deps.code ? trackShipment({ data: { code: deps.code } }) : Promise.resolve(null),
      onlinePaymentEnabled(),
    ])
    return { site, result, code: deps.code, canPayOnline }
  },
  head: () => ({ meta: [{ title: 'Track your package — Ronia Logistics' }] }),
  component: TrackPage,
})

function TrackPage() {
  const { site, result, code, canPayOnline } = Route.useLoaderData()
  const navigate = useNavigate()
  const [input, setInput] = useState(code)

  const s = result?.shipment
  const stepIndex = s ? PROGRESS.indexOf(s.status) : -1

  return (
    <SiteLayout settings={site.settings}>
      <section className="bg-brand-900 py-10 text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="font-display text-3xl font-bold">Track your package</h1>
          <form
            className="mt-5 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              navigate({ to: '/track', search: { code: input.trim().toUpperCase() } })
            }}
          >
            <input
              className="input !py-3 font-mono text-base tracking-wider text-slate-900 uppercase"
              placeholder="Enter tracking number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn-accent !py-3 sm:w-40">Track</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {!code && <p className="text-slate-500">Enter your tracking number above to see where your package is.</p>}

        {code && !s && (
          <div className="card p-8 text-center">
            <p className="text-4xl">🔎</p>
            <p className="mt-3 font-semibold">No package found for “{code}”</p>
            <p className="mt-1 text-sm text-slate-500">Check the number on your receipt, or call {site.settings.phone}.</p>
          </div>
        )}

        {s && (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Tracking number</p>
                  <p className="font-mono text-xl font-bold tracking-wider text-brand-900">{s.tracking_code}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>

              {stepIndex >= 0 && (
                <div className="mt-6">
                  <div className="flex justify-between gap-1">
                    {PROGRESS.map((p, i) => (
                      <div key={p} className="flex-1">
                        <div className={`h-2 rounded-full ${i <= stepIndex ? 'bg-accent-500' : 'bg-slate-200'}`} />
                        <p className={`mt-2 hidden text-[11px] sm:block ${i <= stepIndex ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                          {statusLabel(p)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Info label="From" value={`${s.origin_city}`} />
                <Info label="To" value={`${s.destination_city}, ${s.destination_country}`} />
                <Info label="Service" value={serviceLabel(s.service_type)} />
                <Info label="Sender" value={s.sender_name} />
                <Info label="Receiver" value={s.receiver_name} />
                <Info label="Current location" value={s.current_location ?? '—'} />
                <Info label="Booked on" value={dateTime(s.created_at)} />
                {s.status === 'delivered' ? (
                  <Info label="Delivered on" value={dateTime(s.delivered_at)} />
                ) : (
                  <Info label="Estimated delivery" value={dateOnly(s.estimated_delivery)} />
                )}
                <Info label="Items" value={`${s.quantity}${s.weight_kg ? ` · ${s.weight_kg} kg` : ''}`} />
              </dl>
            </div>

            {s.payment_status !== 'paid' && s.shipping_fee > 0 && s.status !== 'cancelled' && (
              <PayBox code={s.tracking_code} fee={s.shipping_fee} enabled={canPayOnline} phone={site.settings.phone} />
            )}

            <div className="card p-6">
              <h2 className="mb-5 font-display text-lg font-bold text-brand-900">Shipment history</h2>
              <Timeline events={result.events} />
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  )
}

function PayBox({ code, fee, enabled, phone }: { code: string; fee: number; enabled: boolean; phone: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="card border-accent-400/50 bg-gradient-to-br from-white to-orange-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold text-brand-900">Shipping fee due</p>
          <p className="text-sm text-slate-600">Pay now so your package isn't held.</p>
        </div>
        <p className="font-display text-2xl font-extrabold text-accent-600">{money(fee)}</p>
      </div>
      {enabled ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            const res = await startOnlinePayment({ data: { code, email, origin: window.location.origin } })
            if (!res.ok) {
              setBusy(false)
              return setError(res.error)
            }
            window.location.href = res.url
          }}
        >
          <input type="email" required className="input" placeholder="Your email (for the receipt)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-accent shrink-0" disabled={busy}>
            {busy ? 'Opening Paystack…' : 'Pay online (card / transfer / USSD)'}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Pay at our office, or call {phone} for transfer details.</p>
      )}
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  )
}
