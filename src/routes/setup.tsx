import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { needsSetup, setupFirstAdmin } from '~/fns/auth'
import { Alert, Field } from '~/components/ui'
import { AuthShell } from '~/components/AuthShell'

export const Route = createFileRoute('/setup')({
  beforeLoad: async () => {
    if (!(await needsSetup())) throw redirect({ to: '/login' })
  },
  head: () => ({ meta: [{ title: 'First-time setup — Ronia Logistics' }] }),
  component: SetupPage,
})

function SetupPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <AuthShell title="Create the admin account" subtitle="This only appears once — the first account becomes the main administrator.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          if (f.get('password') !== f.get('confirm')) return setError('Passwords do not match.')
          setBusy(true)
          setError('')
          const res = await setupFirstAdmin({
            data: {
              full_name: String(f.get('full_name')),
              email: String(f.get('email')),
              phone: String(f.get('phone') || ''),
              password: String(f.get('password')),
            },
          })
          setBusy(false)
          if (!res.ok) return setError(res.error)
          await router.invalidate()
          router.navigate({ to: '/admin' })
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Full name">
          <input name="full_name" required className="input" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className="input" />
        </Field>
        <Field label="Phone">
          <input name="phone" className="input" />
        </Field>
        <Field label="Password (min. 8 characters)">
          <input name="password" type="password" minLength={8} required className="input" />
        </Field>
        <Field label="Confirm password">
          <input name="confirm" type="password" minLength={8} required className="input" />
        </Field>
        <button className="btn-primary w-full !py-2.5" disabled={busy}>
          {busy ? 'Creating…' : 'Create admin & continue'}
        </button>
      </form>
    </AuthShell>
  )
}
