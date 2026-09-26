import { useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { getMe } from '~/fns/auth'
import { applyAsMerchant } from '~/fns/accounts'
import { AuthShell } from '~/components/AuthShell'
import { LoginForm, Tabs } from '~/components/LoginForm'
import { Alert, Field } from '~/components/ui'

export const Route = createFileRoute('/merchant_/login')({
  validateSearch: (s: Record<string, unknown>): { tab?: 'apply' } => (s.tab === 'apply' ? { tab: 'apply' } : {}),
  beforeLoad: async () => {
    const me = await getMe()
    if (me?.role === 'merchant') throw redirect({ to: '/merchant' })
  },
  head: () => ({ meta: [{ title: 'Merchant login — Ronia Logistics' }] }),
  component: MerchantLogin,
})

function MerchantLogin() {
  const search = Route.useSearch()
  const [tab, setTab] = useState<'signin' | 'apply'>(search.tab === 'apply' ? 'apply' : 'signin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  return (
    <AuthShell
      title={tab === 'signin' ? 'Merchant login' : 'Become a Ronia merchant'}
      subtitle={tab === 'signin' ? 'See your stock, sales, deliveries and payouts.' : 'Store your goods with us. We deliver, collect payment and pay you.'}
      headline="Your stock, sold and delivered."
      blurb="Keep your products in our Abuja warehouse. We pack, deliver and collect payment — and you watch every item and every naira from your own dashboard."
      badge="Merchant portal"
      wide
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'signin', label: 'Sign in' },
          { value: 'apply', label: 'Apply' },
        ]}
      />

      {tab === 'signin' && <LoginForm portal="merchant" />}

      {tab === 'apply' && done && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-3xl">✓</p>
          <p className="mt-2 font-display text-lg font-bold text-emerald-900">Application received</p>
          <p className="mt-1 text-sm text-emerald-800">
            Our team will review it and contact you. Once you're approved, sign in here with the email and password you just chose.
          </p>
        </div>
      )}

      {tab === 'apply' && !done && (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
            if (f.password !== f.confirm) return setError('Passwords do not match.')
            setBusy(true)
            setError('')
            const res = await applyAsMerchant({
              data: {
                business_name: f.business_name,
                contact_name: f.contact_name,
                phone: f.phone,
                email: f.email,
                address: f.address,
                what_they_sell: f.what_they_sell,
                password: f.password,
              },
            })
            setBusy(false)
            if (!res.ok) return setError(res.error)
            setDone(true)
          }}
        >
          {error && (
            <div className="sm:col-span-2">
              <Alert>{error}</Alert>
            </div>
          )}
          <Field label="Business name *" className="sm:col-span-2">
            <input name="business_name" required className="input" />
          </Field>
          <Field label="Contact person *">
            <input name="contact_name" required className="input" />
          </Field>
          <Field label="Phone / WhatsApp *">
            <input name="phone" type="tel" required className="input" />
          </Field>
          <Field label="Email *" className="sm:col-span-2">
            <input name="email" type="email" required className="input" />
          </Field>
          <Field label="Business address" className="sm:col-span-2">
            <input name="address" className="input" />
          </Field>
          <Field label="What do you sell?" className="sm:col-span-2">
            <input name="what_they_sell" className="input" placeholder="e.g. Hair, shoes, skincare…" />
          </Field>
          <Field label="Password (min. 8) *">
            <input name="password" type="password" minLength={8} required className="input" />
          </Field>
          <Field label="Confirm password *">
            <input name="confirm" type="password" minLength={8} required className="input" />
          </Field>
          <button className="btn-accent w-full !py-2.5 sm:col-span-2" disabled={busy}>
            {busy ? 'Sending…' : 'Submit application'}
          </button>
          <p className="text-center text-xs text-slate-500 sm:col-span-2">Every application is reviewed by our team before the account is activated.</p>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Just sending a package?{' '}
        <Link to="/login" className="font-semibold text-brand-500 hover:underline">
          Customer login
        </Link>
      </p>
    </AuthShell>
  )
}
