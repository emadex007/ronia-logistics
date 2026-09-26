import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { login, type Portal } from '~/fns/auth'
import { Alert, Field } from './ui'

/** Sign-in form shared by the staff, merchant and customer login pages. */
export function LoginForm({ portal }: { portal: Portal }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        setRedirectTo(null)
        const f = new FormData(e.currentTarget)
        const res = await login({ data: { email: String(f.get('email')), password: String(f.get('password')), portal } })
        setBusy(false)
        if (!res.ok) {
          setError(res.error)
          if ('redirectTo' in res && res.redirectTo) setRedirectTo(res.redirectTo)
          return
        }
        await router.invalidate()
        router.navigate({ to: res.home as '/admin' })
      }}
    >
      {error && (
        <Alert>
          {error}
          {redirectTo && (
            <>
              {' '}
              <a href={redirectTo} className="font-semibold underline">
                Go there →
              </a>
            </>
          )}
        </Alert>
      )}
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
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string }[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`rounded-lg py-2 transition ${value === t.value ? 'bg-white text-brand-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
