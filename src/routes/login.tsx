import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getMe, login, needsSetup } from '~/fns/auth'
import { Alert, Field } from '~/components/ui'
import { AuthShell } from '~/components/AuthShell'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await needsSetup()) throw redirect({ to: '/setup' })
    const me = await getMe()
    if (me) throw redirect({ to: me.role === 'merchant' ? '/merchant' : '/admin' })
  },
  head: () => ({ meta: [{ title: 'Login — Ronia Logistics' }] }),
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <AuthShell title="Welcome back" subtitle="Staff and merchants sign in here.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          const f = new FormData(e.currentTarget)
          const res = await login({ data: { email: String(f.get('email')), password: String(f.get('password')) } })
          setBusy(false)
          if (!res.ok) return setError(res.error)
          await router.invalidate()
          router.navigate({ to: res.role === 'merchant' ? '/merchant' : '/admin' })
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className="input" />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </Field>
        <button className="btn-primary w-full !py-2.5" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
