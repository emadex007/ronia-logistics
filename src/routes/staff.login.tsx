import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMe, needsSetup } from '~/fns/auth'
import { AuthShell } from '~/components/AuthShell'
import { LoginForm } from '~/components/LoginForm'

export const Route = createFileRoute('/staff/login')({
  beforeLoad: async () => {
    if (await needsSetup()) throw redirect({ to: '/setup' })
    const me = await getMe()
    if (me && me.role !== 'merchant' && me.role !== 'customer') throw redirect({ to: '/admin' })
  },
  head: () => ({ meta: [{ title: 'Staff login — Ronia Logistics' }, { name: 'robots', content: 'noindex' }] }),
  component: () => (
    <AuthShell title="Staff login" subtitle="For Ronia Logistics admin and staff only." badge="Staff area">
      <LoginForm portal="staff" />
    </AuthShell>
  ),
})
