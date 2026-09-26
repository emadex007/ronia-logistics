import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from './ui'
import type { Settings } from '~/lib/types'

export function SiteLayout({ settings, children }: { settings: Settings; children: ReactNode }) {
  const wa = (settings.whatsapp || '').replace(/[^0-9]/g, '')
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/">
            <Logo name={settings.company_name} />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
            <Link to="/" hash="services" className="hidden rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 sm:inline-block">
              Services
            </Link>
            <Link to="/track" search={{ code: '' }} className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
              Track
            </Link>
            <Link to="/login" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
              <span className="sm:hidden">Login</span>
              <span className="hidden sm:inline">Customer login</span>
            </Link>
            <Link to="/merchant/login" className="btn-primary !px-3 !py-1.5">
              <span className="sm:hidden">Merchants</span>
              <span className="hidden sm:inline">Merchant login</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-brand-950 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
          <div>
            <Logo name={settings.company_name} light />
            <p className="mt-3 text-sm text-slate-400">{settings.tagline}</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-white">Contact</p>
            <p className="mt-2">{settings.address}</p>
            <p>
              <a href={`tel:${settings.phone}`} className="hover:text-white">
                {settings.phone}
              </a>
            </p>
            <p>
              <a href={`mailto:${settings.email}`} className="hover:text-white">
                {settings.email}
              </a>
            </p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-white">Quick links</p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link to="/track" search={{ code: '' }} className="hover:text-white">
                  Track a package
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white">
                  Customer login
                </Link>
              </li>
              <li>
                <Link to="/merchant/login" className="hover:text-white">
                  Merchant login
                </Link>
              </li>
              <li>
                <Link to="/merchant/login" search={{ tab: 'apply' }} className="hover:text-white">
                  Become a merchant
                </Link>
              </li>
              {wa && (
                <li>
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="hover:text-white">
                    Chat on WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {settings.company_name}. All rights reserved.
        </div>
      </footer>

      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="no-print fixed right-5 bottom-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        </a>
      )}
    </div>
  )
}
