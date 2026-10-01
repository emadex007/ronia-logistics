import { useEffect, useState } from 'react'
import { Link, Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getMe, logout } from '~/fns/auth'
import { unreadMessageCount } from '~/fns/messages'
import { Logo } from '~/components/ui'
import { InstallAppButton } from '~/components/InstallApp'
import type { Perm } from '~/lib/permissions'
import { ROLE_LABELS } from '~/lib/format'
import { useSiteSettings } from '~/components/useSite'
import { mediaUrl } from '~/lib/site'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const user = await getMe()
    if (!user) throw redirect({ to: '/staff/login' })
    if (user.role === 'merchant') throw redirect({ to: '/merchant' })
    if (user.role === 'customer') throw redirect({ to: '/account' })
    return { user }
  },
  head: () => ({ meta: [{ title: 'Dashboard — Ronia Logistics' }] }),
  component: AdminLayout,
})

type NavItem = { to: string; label: string; icon: string; exact?: boolean; perms?: Perm[]; soon?: boolean }

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: '▦', exact: true },
  { to: '/admin/deliveries', label: 'My deliveries', icon: '🛵', perms: ['shipments'] },
  { to: '/admin/shipments/new', label: 'New shipment', icon: '＋', perms: ['shipments'] },
  { to: '/admin/shipments', label: 'Shipments', icon: '📦', exact: true, perms: ['shipments'] },
  { to: '/admin/merchants', label: 'Merchants & stock', icon: '🏬', perms: ['merchants'] },
  { to: '/admin/rates', label: 'Prices & booking', icon: '🏷', perms: ['finance'] },
  { to: '/admin/finance', label: 'Income & expenses', icon: '₦', perms: ['finance', 'record_money'] },
  { to: '/admin/inbox', label: 'Messages', icon: '💬', perms: ['inbox'] },
  { to: '/admin/staff', label: 'Staff', icon: '👥', perms: ['staff'] },
  { to: '/admin/website', label: 'Website', icon: '🎨', perms: ['website'] },
]

function AdminLayout() {
  const { user } = Route.useRouteContext()
  const site = useSiteSettings()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const items = NAV.filter((n) => !n.perms || n.perms.some((p) => user.perms.includes(p)))
  const unread = useUnreadMessages(user.perms.includes('inbox'))

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 px-2">
        <Logo light compact />
      </div>
      {items.map((n) =>
        n.soon ? (
          <span key={n.label} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500">
            <span className="w-5 text-center">{n.icon}</span>
            {n.label}
            <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">Soon</span>
          </span>
        ) : (
          <Link
            key={n.to}
            to={n.to as '/admin'}
            onClick={() => setOpen(false)}
            activeOptions={{ exact: !!n.exact }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            activeProps={{ className: '!bg-white/15 !text-white' }}
          >
            <span className="w-5 text-center">{n.icon}</span>
            {n.label}
            {n.to === '/admin/inbox' && unread > 0 && (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{unread}</span>
            )}
          </Link>
        ),
      )}
      <InstallAppButton className="mt-4 mb-2 flex items-center gap-3 rounded-lg bg-accent-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-accent-500" label="📲 Install app on this phone" />
      <div className="mt-auto rounded-xl bg-white/5 p-3">
        <p className="truncate text-sm font-semibold text-white">{user.full_name}</p>
        <p className="text-xs text-slate-400">
          {ROLE_LABELS[user.role]}
          {user.branch ? ` · ${user.branch}` : ''}
        </p>
        <button
          className="mt-3 w-full rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
          onClick={async () => {
            await logout()
            await router.invalidate()
            router.navigate({ to: '/staff/login' })
          }}
        >
          Log out
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen md:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 bg-brand-950 md:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between bg-brand-950 px-4 py-3 md:hidden">
        <Logo light compact />
        <button className="relative rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white" onClick={() => setOpen(true)}>
          Menu
          {unread > 0 && <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-red-600 ring-2 ring-brand-950" />}
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-950">{sidebar}</aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}

/** Unread website chats/messages: polls every 30s, beeps softly and updates the tab title when new ones arrive. */
function useUnreadMessages(enabled: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let prev = -1
    let alive = true
    const base = document.title.replace(/^\(\d+\) /, '')
    const tick = async () => {
      const r = await unreadMessageCount().catch(() => null)
      if (!alive || !r) return
      const count = r.conversations
      setN(count)
      document.title = (count > 0 ? `(${count}) ` : '') + document.title.replace(/^\(\d+\) /, '')
      if (prev >= 0 && count > prev) beep()
      prev = count
    }
    tick()
    const id = setInterval(tick, 30000)
    window.addEventListener('ronia:inbox-read', tick)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('ronia:inbox-read', tick)
      document.title = base
    }
  }, [enabled])
  return n
}

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.08, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.4)
  } catch {
    /* sound not allowed until the page is clicked — badge still shows */
  }
}
