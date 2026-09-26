import { useState } from 'react'
import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getMe } from '~/fns/auth'
import { registerCustomer } from '~/fns/accounts'
import { AuthShell } from '~/components/AuthShell'
import { LoginForm, Tabs } from '~/components/LoginForm'
import { Alert, Field } from '~/components/ui'

/** Customer login — optional. Anyone can still track a package without an account. */
export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { tab?: 'register' } => (s.tab === 'register' ? { tab: 'register' } : {}),
  beforeLoad: async () => {
    const me = await getMe()
    if (me?.role === 'customer') throw redirect({ to: '/account' })
  },
  head: () => ({ meta: [{ title: 'Customer login — Ronia Logistics' }] }),
  component: CustomerLogin,
})

function CustomerLogin() {
  const search = Route.useSearch()
  const router = useRouter()
  const [tab, setTab] = useState<'signin' | 'register'>(search.tab === 'register' ? 'register' : 'signin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <AuthShell
      title={tab === 'signin' ? 'Customer login' : 'Create your account'}
      subtitle="Optional — you can always track a package without an account."
      headline="All your packages in one place."
      blurb="With a free account you see every package you've sent, get updates, and never have to hunt for a tracking number again."
      badge="Customers"
      wide
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'signin', label: 'Sign in' },
          { value: 'register', label: 'Create account' },
        ]}
      />

      {tab === 'signin' && <LoginForm portal="customer" />}

      {tab === 'register' && (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
            if (f.password !== f.confirm) return setError('Passwords do not match.')
            setBusy(true)
            setError('')
            const res = await registerCustomer({ data: { full_name: f.full_name, phone: f.phone, email: f.email, password: f.password } })
            setBusy(false)
            if (!res.ok) return setError(res.error)
            await router.invalidate()
            router.navigate({ to: '/account' })
          }}
        >
          {error && (
            <div className="sm:col-span-2">
              <Alert>{error}</Alert>
            </div>
          )}
          <Field label="Full name" className="sm:col-span-2">
            <input name="full_name" required className="input" />
          </Field>
          <Field label="Phone">
            <input name="phone" type="tel" required className="input" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required className="input" />
          </Field>
          <Field label="Password (min. 8)">
            <input name="password" type="password" minLength={8} required className="input" />
          </Field>
          <Field label="Confirm password">
            <input name="confirm" type="password" minLength={8} required className="input" />
          </Field>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Tip: give our front desk this same email when you send a package, and it will show up in your account automatically.
          </p>
          <button className="btn-accent w-full !py-2.5 sm:col-span-2" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-1 text-center text-sm text-slate-500">
        <p>
          <Link to="/track" search={{ code: '' }} className="font-semibold text-brand-500 hover:underline">
            Track without an account →
          </Link>
        </p>
        <p>
          Selling with us?{' '}
          <Link to="/merchant/login" className="font-semibold text-brand-500 hover:underline">
            Merchant login
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
