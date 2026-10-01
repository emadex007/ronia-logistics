import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { bookShipment, getPriceList, type PublicRate } from '~/fns/booking'
import { SiteLayout } from '~/components/SiteLayout'
import { PageHero } from '~/components/Sections'
import { useSiteSettings } from '~/components/useSite'
import { money, serviceLabel } from '~/lib/format'

export const Route = createFileRoute('/book')({
  loader: () => getPriceList(),
  head: () => ({
    meta: [
      { title: 'Book a delivery — Ronia Logistics' },
      { name: 'description', content: 'Get an instant price and book a pickup or drop-off for deliveries across Nigeria.' },
    ],
  }),
  component: BookPage,
})

/** Same formula as the server: base + extra per kg above the included weight, × quantity. */
const price = (r: PublicRate, kg: number, qty: number) =>
  (r.base_fee + Math.max(0, Math.ceil(Math.max(0, kg) - r.included_kg)) * r.extra_per_kg) * Math.max(1, Math.floor(qty) || 1)

const uniq = (a: string[]) => [...new Set(a)]

function BookPage() {
  const { rates, enabled, note } = Route.useLoaderData()
  const s = useSiteSettings()
  const navigate = useNavigate()

  const origins = uniq(rates.map((r) => r.origin))
  const [origin, setOrigin] = useState(origins[0] ?? 'Abuja')
  const destinations = uniq(rates.filter((r) => r.origin === origin).map((r) => r.destination)).sort()
  const [destination, setDestination] = useState('')
  const services = rates.filter((r) => r.origin === origin && r.destination === destination)
  const [service, setService] = useState('')
  const [kg, setKg] = useState('1')
  const [qty, setQty] = useState('1')
  const rate = services.find((r) => r.service_type === service) ?? services[0]
  // Same limits as the server, so the price shown is always the price charged
  const w = Math.min(1000, Math.max(0.1, Number(kg) || 1))
  const q = Math.min(50, Math.max(1, Math.floor(Number(qty) || 1)))
  const total = rate ? price(rate, w, q) : 0

  const [f, setF] = useState({
    description: '',
    sender_name: '',
    sender_phone: '',
    sender_email: '',
    sender_address: '',
    receiver_name: '',
    receiver_phone: '',
    receiver_email: '',
    receiver_address: '',
    website: '',
  })
  const [pickup, setPickup] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const wa = (s.whatsapp || '').replace(/[^0-9]/g, '')
  const routeMissing = useMemo(() => destination && services.length === 0, [destination, services.length])

  if (!enabled || rates.length === 0) {
    return (
      <SiteLayout settings={s}>
        <PageHero title="Book a delivery" subtitle="Online booking is not available right now." image={s.hero_image} />
        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-slate-600">Please call {s.phone} or WhatsApp us to book a delivery.</p>
        </section>
      </SiteLayout>
    )
  }

  return (
    <SiteLayout settings={s}>
      <PageHero title="Book a delivery" subtitle="See your price instantly, then book a pickup or drop off at our office." image={s.hero_image} />

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px]">
        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!rate) return setError('Choose where the package is going.')
            setBusy(true)
            setError('')
            const res = await bookShipment({
              data: {
                ...f,
                origin,
                destination,
                service_type: rate.service_type,
                weight_kg: w,
                quantity: q,
                pickup,
              },
            }).catch((err) => ({ ok: false as const, error: String(err?.message ?? err) }))
            setBusy(false)
            if (!res.ok) return setError(res.error)
            navigate({ to: '/track', search: { code: res.code, booked: 1 } })
          }}
        >
          <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={up('website')} aria-hidden />

          <div className="card space-y-4 p-6">
            <h2 className="font-display text-lg font-bold text-brand-900">1. Where is it going?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">From</span>
                <select
                  className="input"
                  value={origin}
                  onChange={(e) => {
                    setOrigin(e.target.value)
                    setDestination('')
                  }}
                >
                  {origins.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">To *</span>
                <select
                  className="input"
                  required
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value)
                    setService('')
                  }}
                >
                  <option value="">Choose a city…</option>
                  {destinations.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Weight (kg)</span>
                <input className="input" type="number" min={0.1} step={0.1} value={kg} onChange={(e) => setKg(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Number of packages</span>
                <input className="input" type="number" min={1} max={50} value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
            </div>

            {services.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((r) => {
                  const on = rate?.id === r.id
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setService(r.service_type)}
                      className={`rounded-xl border-2 p-4 text-left transition ${on ? 'border-accent-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <p className="font-semibold text-slate-900">{serviceLabel(r.service_type)}</p>
                      <p className="font-display text-xl font-bold text-brand-900">{money(price(r, w, q))}</p>
                      {r.eta && <p className="text-xs text-slate-500">{r.eta}</p>}
                    </button>
                  )
                })}
              </div>
            )}
            {routeMissing && (
              <p className="text-sm text-slate-600">
                We don't have an online price for that route yet — {wa ? <a className="font-semibold text-brand-500" href={`https://wa.me/${wa}`}>WhatsApp us</a> : `call ${s.phone}`} for a quote.
              </p>
            )}
            <label className="block">
              <span className="label">What are you sending?</span>
              <input className="input" value={f.description} onChange={up('description')} placeholder="e.g. Clothes, documents, phone accessories" />
            </label>
          </div>

          <div className="card space-y-4 p-6">
            <h2 className="font-display text-lg font-bold text-brand-900">2. Your details (sender)</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: true, t: '🛵 Pick up from me', d: 'Our rider comes to your address' },
                { v: false, t: '🏢 I will drop it off', d: `At our ${origin} office` },
              ].map((o) => (
                <button
                  type="button"
                  key={String(o.v)}
                  onClick={() => setPickup(o.v)}
                  className={`rounded-xl border-2 p-3 text-left text-sm ${pickup === o.v ? 'border-accent-500 bg-orange-50' : 'border-slate-200'}`}
                >
                  <span className="block font-semibold">{o.t}</span>
                  <span className="text-xs text-slate-500">{o.d}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Your name *" value={f.sender_name} onChange={up('sender_name')} required />
              <Input label="Your phone *" type="tel" value={f.sender_phone} onChange={up('sender_phone')} required />
              <Input label="Your email (for updates & receipt)" type="email" value={f.sender_email} onChange={up('sender_email')} />
              <Input label={pickup ? 'Pickup address *' : 'Your address'} value={f.sender_address} onChange={up('sender_address')} required={pickup} />
            </div>
          </div>

          <div className="card space-y-4 p-6">
            <h2 className="font-display text-lg font-bold text-brand-900">3. Receiver</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Receiver's name *" value={f.receiver_name} onChange={up('receiver_name')} required />
              <Input label="Receiver's phone *" type="tel" value={f.receiver_phone} onChange={up('receiver_phone')} required />
            </div>
            <Input label={`Delivery address in ${destination || 'the destination city'} *`} value={f.receiver_address} onChange={up('receiver_address')} required />
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          <button className="btn btn-accent w-full !py-3 text-base lg:hidden" disabled={busy || !rate}>
            {busy ? 'Booking…' : `Book now${rate ? ` · ${money(total)}` : ''}`}
          </button>
          <button id="book-submit" className="hidden" />
        </form>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="card space-y-3 p-6">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Your price</p>
            <p className="font-display text-4xl font-extrabold text-brand-900">{rate ? money(total) : '—'}</p>
            {rate ? (
              <div className="space-y-1 text-sm text-slate-600">
                <p>
                  {origin} → {destination}
                </p>
                <p>
                  {serviceLabel(rate.service_type)}
                  {rate.eta ? ` · ${rate.eta}` : ''}
                </p>
                <p>
                  {q} package(s) · {w} kg
                </p>
                <p className="text-xs text-slate-400">
                  Includes up to {rate.included_kg} kg per package{rate.extra_per_kg ? `, then ${money(rate.extra_per_kg)} per extra kg` : ''}.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Choose a destination to see the price.</p>
            )}
            <button
              type="button"
              className="btn btn-accent hidden w-full !py-3 text-base lg:block"
              disabled={busy || !rate}
              onClick={() => document.getElementById('book-submit')?.click()}
            >
              {busy ? 'Booking…' : 'Book now'}
            </button>
            <p className="text-xs text-slate-500">You can pay online with card, transfer or USSD after booking, or pay the rider / at the office.</p>
            {note && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{note}</p>}
          </div>
        </aside>
      </section>
    </SiteLayout>
  )
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (e: { target: { value: string } }) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" type={type} value={value} onChange={onChange} required={required} />
    </label>
  )
}
