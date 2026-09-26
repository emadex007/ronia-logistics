import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getSiteContent } from '~/fns/public'
import { SiteLayout } from '~/components/SiteLayout'

export const Route = createFileRoute('/')({
  loader: () => getSiteContent(),
  component: Home,
})

const SERVICE_ICONS = ['⚡', '🚚', '✈️', '🏬', '💵', '📦']

function Home() {
  const { settings, pages } = Route.useLoaderData()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const services = (pages.services?.body ?? '').split('\n').filter(Boolean)

  return (
    <SiteLayout settings={settings}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }}
        />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-orange-200 uppercase">
              📍 {settings.address}
            </p>
            <h1 className="mt-5 font-display text-4xl leading-tight font-extrabold sm:text-5xl">{settings.hero_title}</h1>
            <p className="mt-4 max-w-lg text-lg text-slate-300">{settings.hero_subtitle}</p>
          </div>

          <form
            className="rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.trim()) navigate({ to: '/track', search: { code: code.trim().toUpperCase() } })
            }}
          >
            <p className="font-display text-xl font-bold text-brand-900">Track your package</p>
            <p className="mt-1 text-sm text-slate-500">Enter the tracking number on your receipt.</p>
            <input
              className="input mt-4 !py-3 font-mono text-base tracking-wider uppercase"
              placeholder="e.g. RL-260926-7KP3Q"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Tracking number"
            />
            <button className="btn-accent mt-3 w-full !py-3 text-base">Track now →</button>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
              <div>
                <p className="font-display text-lg font-bold text-brand-900">Live</p>updates
              </div>
              <div>
                <p className="font-display text-lg font-bold text-brand-900">36</p>states
              </div>
              <div>
                <p className="font-display text-lg font-bold text-brand-900">Intl</p>shipping
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-bold text-brand-900">{pages.services?.title ?? 'Our Services'}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <div key={s} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-2xl">{SERVICE_ICONS[i % SERVICE_ICONS.length]}</div>
              <p className="mt-4 font-semibold text-slate-900">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold text-brand-900">How it works</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              ['Drop off or book pickup', 'Bring your package to our Abuja office or call us for pickup.'],
              ['Get your tracking number', 'We register it and give you a printed receipt with a tracking number.'],
              ['Follow every step', 'Get SMS/email updates as it moves: in transit, at hub, out for delivery.'],
              ['Delivered', 'Your receiver gets it, and you get a delivery confirmation.'],
            ].map(([t, d], i) => (
              <div key={t}>
                <span className="font-display text-4xl font-extrabold text-accent-500/80">0{i + 1}</span>
                <p className="mt-2 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About + merchants CTA */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
        <div className="card p-8">
          <h2 className="font-display text-2xl font-bold text-brand-900">{pages.about?.title}</h2>
          <p className="mt-3 whitespace-pre-line text-slate-600">{pages.about?.body}</p>
        </div>
        <div className="card flex flex-col justify-between bg-gradient-to-br from-brand-900 to-brand-700 p-8 text-white">
          <div>
            <h2 className="font-display text-2xl font-bold">Vendors: store with us, sell more</h2>
            <p className="mt-3 text-slate-200">
              Keep your stock in our warehouse. We pack, deliver and collect payment, and you see every sale and every item that leaves, live on
              your own merchant dashboard.
            </p>
          </div>
          <a href={`tel:${settings.phone}`} className="btn-accent mt-6 self-start">
            Call {settings.phone}
          </a>
        </div>
      </section>
    </SiteLayout>
  )
}
