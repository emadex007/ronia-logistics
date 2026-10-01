import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '~/components/SiteLayout'
import { useSiteSettings } from '~/components/useSite'
import { InstallHelp, useInstall } from '~/components/InstallApp'
import { mediaUrl } from '~/lib/site'

export const Route = createFileRoute('/app')({
  head: () => ({
    meta: [
      { title: 'Get the app — Ronia Logistics' },
      { name: 'description', content: 'Install the Ronia Logistics app on your phone to book deliveries and track packages.' },
    ],
  }),
  component: AppPage,
})

function AppPage() {
  const s = useSiteSettings()
  const app = useInstall()
  const [help, setHelp] = useState<null | 'ios' | 'android'>(null)
  const icon = s.app_icon_key ? mediaUrl(s.app_icon_key) : '/icon-512.png'
  const name = s.company_name || 'Ronia Logistics'

  return (
    <SiteLayout settings={s}>
      <section className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 py-14 text-center sm:px-6 md:flex-row md:text-left">
          <img src={icon} alt="" className="h-32 w-32 shrink-0 rounded-[28px] shadow-2xl ring-4 ring-white/10" />
          <div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Get the {name} app</h1>
            <p className="mt-2 text-lg text-slate-200">Book deliveries, pay and track your packages from your home screen. Free, small, and no app store needed.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
              {app.ready && app.standalone ? (
                <p className="rounded-xl bg-white/10 px-4 py-3 font-semibold">✅ You are using the app</p>
              ) : app.ready && app.canPrompt ? (
                <button className="btn-accent !px-6 !py-3 text-base" onClick={() => app.install()}>
                  📲 Install now
                </button>
              ) : (
                <>
                  <button className="btn-accent !px-6 !py-3 text-base" onClick={() => setHelp('android')}>
                    Android phone
                  </button>
                  <button className="btn border border-white/30 !px-6 !py-3 text-base text-white hover:bg-white/10" onClick={() => setHelp('ios')}>
                    iPhone
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-3">
        {([
          {
            icon: '📦',
            title: 'Customers',
            text: 'Get prices instantly, book a pickup, pay online and follow your package to the door.',
            link: { to: '/book', label: 'Book a delivery' },
          },
          {
            icon: '🛵',
            title: 'Riders',
            text: 'See today’s deliveries, call or map the customer, and confirm delivery with a photo and signature.',
            link: { to: '/staff/login', label: 'Staff sign in' },
          },
          {
            icon: '🏬',
            title: 'Merchants',
            text: 'Check your stock, sales, deliveries and payments any time.',
            link: { to: '/merchant/login', label: 'Merchant sign in' },
          },
        ] as const).map((c) => (
          <div key={c.title} className="card p-6">
            <p className="text-3xl">{c.icon}</p>
            <p className="mt-2 font-display text-lg font-bold text-brand-900">{c.title}</p>
            <p className="mt-1 text-sm text-slate-600">{c.text}</p>
            <Link to={c.link.to} className="mt-3 inline-block text-sm font-semibold text-brand-500 hover:underline">
              {c.link.label} →
            </Link>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <div className="card grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <p className="font-display font-bold text-brand-900">Android (Chrome)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Open our website in Chrome</li>
              <li>
                Tap <b>⋮</b> (top right)
              </li>
              <li>
                Tap <b>Install app</b> → <b>Install</b>
              </li>
            </ol>
          </div>
          <div>
            <p className="font-display font-bold text-brand-900">iPhone (Safari)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Open our website in Safari</li>
              <li>
                Tap the <b>Share</b> button (square with arrow)
              </li>
              <li>
                Tap <b>Add to Home Screen</b> → <b>Add</b>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {help && <InstallHelp ios={help === 'ios'} onClose={() => setHelp(null)} />}
    </SiteLayout>
  )
}
