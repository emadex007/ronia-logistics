// Public website sections. All text and pictures come from Admin → Website.
import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { jsonSetting, mediaUrl, SOCIALS, type Faq, type Service, type Stat, type Step } from '~/lib/site'
import { SOCIAL_LABELS, SocialLogo, type SocialKey } from './SocialIcons'
import type { Settings } from '~/lib/types'

export function TrackBox({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  return (
    <form
      className={compact ? 'flex flex-col gap-2 sm:flex-row' : ''}
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) navigate({ to: '/track', search: { code: code.trim().toUpperCase() } })
      }}
    >
      <input
        className={`input font-mono text-base tracking-wider uppercase ${compact ? '!py-3' : 'mt-4 !py-3'}`}
        placeholder="e.g. RL-260926-7KP3Q"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-label="Tracking number"
      />
      <button className={`btn-accent !py-3 text-base ${compact ? 'shrink-0 sm:w-40' : 'mt-3 w-full'}`}>Track now →</button>
    </form>
  )
}

export function Hero({ s }: { s: Settings }) {
  const video = s.hero_media_type === 'video' ? mediaUrl(s.hero_video) : ''
  const image = mediaUrl(s.hero_image)
  const h = Number(s.hero_height)
  return (
    <section className="relative isolate flex items-center overflow-hidden bg-brand-950 text-white" style={h > 0 ? { minHeight: `calc(${h}vh - var(--header-h, 76px))` } : undefined}>
      {video ? (
        <video className="absolute inset-0 -z-20 h-full w-full object-cover" src={video} poster={image || undefined} autoPlay muted loop playsInline />
      ) : image ? (
        <img className="absolute inset-0 -z-20 h-full w-full object-cover" src={image} alt="" fetchPriority="high" />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950/95 via-brand-950/80 to-brand-950/30" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-brand-950/60 to-transparent" />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-16 pb-28 sm:px-6 md:grid-cols-[1.2fr_1fr] md:pt-24 md:pb-36">
        <div>
          {s.hero_badge && (
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-orange-100 uppercase backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              {s.hero_badge}
            </p>
          )}
          <h1 className="mt-5 font-display text-4xl leading-[1.1] font-extrabold sm:text-5xl lg:text-6xl">{s.hero_title}</h1>
          <p className="mt-5 max-w-xl text-lg text-slate-200">{s.hero_subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/contact" className="btn-accent !px-6 !py-3 text-base">
              {s.hero_cta_label || 'Book a delivery'}
            </Link>
            <Link to="/services" className="btn border border-white/30 !px-6 !py-3 text-base text-white backdrop-blur hover:bg-white/10">
              Our services
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-2xl ring-1 ring-black/5">
          <p className="font-display text-xl font-bold text-brand-900">Track your package</p>
          <p className="mt-1 text-sm text-slate-500">Enter the tracking number on your receipt.</p>
          <TrackBox />
          <p className="mt-4 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
            No account needed ·{' '}
            <Link to="/login" className="font-semibold text-brand-500 hover:underline">
              Customer login
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

export function StatsBar({ s, overlap = true }: { s: Settings; overlap?: boolean }) {
  const stats = jsonSetting<Stat[]>(s, 'stats_json', [])
  if (!stats.length) return null
  return (
    <div className={`relative z-10 mx-auto max-w-6xl px-4 sm:px-6 ${overlap ? '-mt-16' : 'mt-12'}`}>
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 lg:grid-cols-4">
        {stats.map((st, i) => (
          <div key={i} className="border-slate-100 p-5 text-center sm:p-6 [&:not(:last-child)]:border-r">
            <p className="font-display text-2xl font-extrabold text-brand-900 sm:text-3xl">{st.value}</p>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">{st.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SectionTitle({ eyebrow, title, subtitle, center = false }: { eyebrow?: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow && <p className="text-xs font-bold tracking-[0.2em] text-accent-600 uppercase">{eyebrow}</p>}
      <h2 className="mt-2 font-display text-3xl font-bold text-brand-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-slate-600">{subtitle}</p>}
    </div>
  )
}

export function ServicesGrid({ s, limit }: { s: Settings; limit?: number }) {
  const services = jsonSetting<Service[]>(s, 'services_json', [])
  const list = limit ? services.slice(0, limit) : services
  return (
    <section id="services" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionTitle eyebrow="Services" title={s.services_title || 'What we do'} subtitle={s.services_subtitle} />
        {limit && services.length > limit && (
          <Link to="/services" className="text-sm font-semibold text-brand-500 hover:underline">
            All services →
          </Link>
        )}
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((sv, i) => (
          <article key={i} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl">
            <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
              {sv.image && <img src={mediaUrl(sv.image)} alt={sv.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
              <span className="absolute top-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 font-display text-sm font-bold text-brand-900 shadow">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <div className="p-6">
              <h3 className="font-display text-lg font-bold text-brand-900">{sv.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{sv.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function Steps({ s }: { s: Settings }) {
  const steps = jsonSetting<Step[]>(s, 'steps_json', [])
  if (!steps.length) return null
  return (
    <section className="bg-brand-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-bold tracking-[0.2em] text-accent-400 uppercase">Simple process</p>
        <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{s.steps_title || 'How it works'}</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((st, i) => (
            <div key={i} className="relative">
              <span className="font-display text-5xl font-extrabold text-accent-500">{String(i + 1).padStart(2, '0')}</span>
              {i < steps.length - 1 && <span className="absolute top-7 left-20 hidden h-px w-[calc(100%-5rem)] bg-white/15 lg:block" />}
              <p className="mt-3 text-lg font-semibold">{st.title}</p>
              <p className="mt-1 text-sm text-slate-300">{st.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function AboutBlock({ s, full = false }: { s: Settings; full?: boolean }) {
  const points = jsonSetting<string[]>(s, 'about_points_json', [])
  const body = s.about_body ?? ''
  const shown = full ? body : body.split('\n\n')[0]
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
      <div className="relative">
        {s.about_image && <img src={mediaUrl(s.about_image)} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-xl" />}
        <div className="absolute -right-4 -bottom-6 hidden rounded-2xl bg-accent-500 px-6 py-5 text-white shadow-xl sm:block">
          <p className="font-display text-2xl font-extrabold">{s.address?.split(',')[0] || 'Abuja'}</p>
          <p className="text-xs opacity-90">Head office</p>
        </div>
      </div>
      <div>
        <SectionTitle eyebrow="About us" title={s.about_title || 'About us'} />
        <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">{shown}</p>
        {points.length > 0 && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {points.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs text-emerald-700">✓</span>
                {p}
              </li>
            ))}
          </ul>
        )}
        {!full && (
          <Link to="/about" className="btn-primary mt-8">
            More about us
          </Link>
        )}
      </div>
    </section>
  )
}

export function MerchantCta({ s }: { s: Settings }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative isolate overflow-hidden rounded-3xl bg-brand-900 text-white">
        {s.merchant_image && <img src={mediaUrl(s.merchant_image)} alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950/95 via-brand-900/85 to-brand-900/40" />
        <div className="max-w-xl p-8 sm:p-12 lg:p-16">
          <p className="text-xs font-bold tracking-[0.2em] text-accent-400 uppercase">For vendors & online stores</p>
          <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{s.merchant_title}</h2>
          <p className="mt-4 text-slate-200">{s.merchant_body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/merchant/login" search={{ tab: 'apply' }} className="btn-accent !px-6 !py-3">
              Apply to become a merchant
            </Link>
            <Link to="/merchant/login" className="btn border border-white/30 !px-6 !py-3 text-white hover:bg-white/10">
              Merchant login
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Gallery({ s }: { s: Settings }) {
  const images = jsonSetting<string[]>(s, 'gallery_json', []).filter(Boolean)
  if (!images.length) return null
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow="Gallery" title={s.gallery_title || 'Gallery'} center />
        <div className="mt-10 grid auto-rows-[160px] grid-cols-2 gap-3 sm:auto-rows-[200px] md:grid-cols-4">
          {images.map((src, i) => (
            <div key={i} className={`overflow-hidden rounded-2xl bg-slate-100 ${i % 5 === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}>
              <img src={mediaUrl(src)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FaqList({ s }: { s: Settings }) {
  const faqs = jsonSetting<Faq[]>(s, 'faq_json', [])
  if (!faqs.length) return null
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <SectionTitle eyebrow="FAQ" title="Questions people ask" center />
      <div className="mt-10 space-y-3">
        {faqs.map((f, i) => (
          <details key={i} className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 open:ring-brand-200">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-brand-900">
              {f.q}
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function CtaBanner({ s }: { s: Settings }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-accent-500 to-accent-600 p-8 text-white shadow-xl sm:p-12 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{s.cta_title}</h2>
          <p className="mt-2 text-white/90">{s.cta_body}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`tel:${s.phone}`} className="btn bg-white !px-6 !py-3 text-accent-600 hover:bg-orange-50">
            📞 {s.phone}
          </a>
          <Link to="/contact" className="btn border border-white/50 !px-6 !py-3 text-white hover:bg-white/10">
            Contact us
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Banner at the top of inner pages (About, Services, Contact). */
export function PageHero({ title, subtitle, image }: { title: string; subtitle?: string; image?: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-950 text-white">
      {image && <img src={mediaUrl(image)} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950/95 to-brand-900/70" />
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-lg text-slate-200">{subtitle}</p>}
      </div>
    </section>
  )
}

export function ContactBlock({ s }: { s: Settings }) {
  const wa = (s.whatsapp || '').replace(/[^0-9]/g, '')
  const mapQ = s.map_query || s.address
  const socials = SOCIALS.filter((x) => s[x.key]).map((x) => ({ key: x.key as SocialKey, href: s[x.key] }))
  const cards = [
    { icon: '📞', label: 'Call us', value: s.phone, href: `tel:${s.phone}` },
    { icon: '💬', label: 'WhatsApp', value: s.whatsapp, href: wa ? `https://wa.me/${wa}` : undefined },
    { icon: '✉️', label: 'Email', value: s.email, href: `mailto:${s.email}` },
    { icon: '📍', label: 'Visit us', value: s.address },
    { icon: '🕘', label: 'Opening hours', value: s.office_hours },
  ].filter((c) => c.value)
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-3">
        {cards.map((c) => {
          const inner = (
            <>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-2xl">{c.icon}</span>
              <span>
                <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">{c.label}</span>
                <span className="block font-semibold text-brand-900">{c.value}</span>
              </span>
            </>
          )
          return c.href ? (
            <a key={c.label} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="card flex items-center gap-4 p-4 transition hover:shadow-md">
              {inner}
            </a>
          ) : (
            <div key={c.label} className="card flex items-center gap-4 p-4">
              {inner}
            </div>
          )
        })}
        {socials.length > 0 && (
          <div className="card p-4">
            <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">Follow us</span>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {socials.map((l) => (
                <a key={l.key} href={l.href} target="_blank" rel="noreferrer" title={SOCIAL_LABELS[l.key]} aria-label={SOCIAL_LABELS[l.key]} className="block h-10 w-10 overflow-hidden rounded-[10px] shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5">
                  <SocialLogo network={l.key} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      {mapQ && (
        <iframe
          title="Map"
          src={`https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed`}
          className="min-h-[360px] w-full rounded-2xl border-0 shadow-sm ring-1 ring-slate-200"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </section>
  )
}
