import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from './ui'
import { isDark, mediaUrl, SOCIALS } from '~/lib/site'
import type { Settings } from '~/lib/types'

const NAV = [
  { to: '/', label: 'Home', exact: true },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
] as const

export function SiteLayout({ settings, children }: { settings: Settings; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const wa = (settings.whatsapp || '').replace(/[^0-9]/g, '')
  const logo = mediaUrl(settings.logo_key)
  const socials = SOCIALS.filter((s) => settings[s.key])
  const dark = isDark(settings.header_bg || '#000000')
  const footerDark = isDark(settings.footer_bg || '#000000')
  const hover = dark ? 'hover:bg-white/10' : 'hover:bg-black/5'
  const line = dark ? 'border-white/10' : 'border-black/10'

  return (
    <div className="flex min-h-screen flex-col">
      <header className={`sticky top-0 z-30 border-b shadow-sm ${line}`} style={{ background: 'var(--header-bg, #000)', color: 'var(--header-text, #fff)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6" style={{ minHeight: 'var(--header-h, 76px)' }}>
          <Link to="/" onClick={() => setOpen(false)}>
            <Logo name={settings.company_name} src={logo || undefined} light={dark} />
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: 'exact' in n }}
                className={`rounded-lg px-3 py-2 opacity-80 transition hover:opacity-100 ${hover}`}
                activeProps={{ className: '!opacity-100 font-semibold' }}
              >
                {n.label}
              </Link>
            ))}
            <Link to="/track" search={{ code: '' }} className={`rounded-lg px-3 py-2 opacity-80 transition hover:opacity-100 ${hover}`}>
              Track
            </Link>
            <span className="mx-2 h-5 w-px bg-current opacity-20" />
            <Link to="/login" className={`rounded-lg px-3 py-2 opacity-80 transition hover:opacity-100 ${hover}`}>
              Customer login
            </Link>
            <Link to="/merchant/login" className="btn-accent !px-4 !py-2">
              Merchant login
            </Link>
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            <Link to="/track" search={{ code: '' }} className="btn-accent !px-3 !py-1.5 text-xs">
              Track
            </Link>
            <button
              aria-label="Menu"
              className={`grid h-9 w-9 place-items-center rounded-lg border ${line}`}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {open && (
          <nav className={`border-t px-4 pb-4 lg:hidden ${line}`}>
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className={`block border-b py-3 font-medium ${line}`}>
                {n.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost">
                Customer login
              </Link>
              <Link to="/merchant/login" onClick={() => setOpen(false)} className="btn-primary">
                Merchant login
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer style={{ background: 'var(--footer-bg, #000)', color: 'var(--footer-text, #cbd5e1)' }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            {settings.footer_show_logo !== '0' && <Logo name={settings.company_name} light={footerDark} src={logo || undefined} />}
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-line opacity-80">{settings.footer_about || settings.tagline}</p>
            {socials.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={settings[s.key]}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-current/20 px-3 py-1 text-xs opacity-80 hover:opacity-100"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="text-sm">
            <p className="font-semibold" style={{ color: 'var(--footer-heading, #fff)' }}>Company</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/about" className="hover:underline hover:opacity-100">
                  About us
                </Link>
              </li>
              <li>
                <Link to="/services" className="hover:underline hover:opacity-100">
                  Services
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:underline hover:opacity-100">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/track" search={{ code: '' }} className="hover:underline hover:opacity-100">
                  Track a package
                </Link>
              </li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold" style={{ color: 'var(--footer-heading, #fff)' }}>Accounts</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/login" className="hover:underline hover:opacity-100">
                  Customer login
                </Link>
              </li>
              <li>
                <Link to="/merchant/login" className="hover:underline hover:opacity-100">
                  Merchant login
                </Link>
              </li>
              <li>
                <Link to="/merchant/login" search={{ tab: 'apply' }} className="hover:underline hover:opacity-100">
                  Become a merchant
                </Link>
              </li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold" style={{ color: 'var(--footer-heading, #fff)' }}>Contact</p>
            <ul className="mt-3 space-y-2">
              <li>📍 {settings.address}</li>
              <li>
                📞{' '}
                <a href={`tel:${settings.phone}`} className="hover:underline hover:opacity-100">
                  {settings.phone}
                </a>
              </li>
              <li>
                ✉️{' '}
                <a href={`mailto:${settings.email}`} className="hover:underline hover:opacity-100">
                  {settings.email}
                </a>
              </li>
              {settings.office_hours && <li>🕘 {settings.office_hours}</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-current/10 py-5 text-center text-xs opacity-70">
          {(settings.footer_copyright || '© {year} {company}. All rights reserved.')
            .replace('{year}', String(new Date().getFullYear()))
            .replace('{company}', settings.company_name || '')}
        </div>
      </footer>

      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="no-print fixed right-5 bottom-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        </a>
      )}
    </div>
  )
}
