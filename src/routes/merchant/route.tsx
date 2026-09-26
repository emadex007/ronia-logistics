import { Link, Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getMe, logout } from '~/fns/auth'
import { Logo } from '~/components/ui'

export const Route = createFileRoute('/merchant')({
  beforeLoad: async () => {
    const user = await getMe()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'merchant') throw redirect({ to: '/admin' })
    return { user }
  },
  head: () => ({ meta: [{ title: 'Merchant portal — Ronia Logistics' }] }),
  component: MerchantLayout,
})

const TABS = [
  { to: '/merchant', label: 'Overview', exact: true },
  { to: '/merchant/history', label: 'Stock history' },
  { to: '/merchant/deliveries', label: 'Deliveries' },
] as const

function MerchantLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  return (
    <div className="min-h-screen">
      <header className="no-print bg-brand-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo light />
            <span className="hidden rounded-full bg-accent-500/20 px-2.5 py-0.5 text-xs font-semibold text-orange-200 sm:inline">Merchant portal</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-300 sm:inline">{user.full_name}</span>
            <button
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              onClick={async () => {
                await logout()
                await router.invalidate()
                router.navigate({ to: '/login' })
              }}
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: 'exact' in t }}
              className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap text-slate-300 hover:text-white"
              activeProps={{ className: '!border-accent-500 !text-white' }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
