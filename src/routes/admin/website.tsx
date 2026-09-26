import { useMemo, useRef, useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { exportSite, getSiteSettings, importSite, saveSiteSettings } from '~/fns/site'
import { Alert, PageHeader } from '~/components/ui'
import { ColorField, ListEditor, MediaField, RangeField, Section, TextField } from '~/components/SiteEditorFields'
import { SOCIALS, mediaUrl, type Faq, type Service, type Stat, type Step } from '~/lib/site'
import type { Settings } from '~/lib/types'

export const Route = createFileRoute('/admin/website')({
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('website')) throw redirect({ to: '/admin' })
  },
  loader: () => getSiteSettings(),
  head: () => ({ meta: [{ title: 'Website editor — Ronia Logistics' }] }),
  component: WebsiteEditor,
})

const TABS = [
  { id: 'brand', label: 'Brand & colours' },
  { id: 'layout', label: 'Layout & buttons' },
  { id: 'hero', label: 'Home: top banner' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About & merchants' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'faq', label: 'Steps & FAQ' },
  { id: 'contact', label: 'Contact & social' },
  { id: 'footer', label: 'Footer' },
  { id: 'receipts', label: 'Receipts' },
] as const
type Tab = (typeof TABS)[number]['id']

function parse<T>(v: string | undefined, fallback: T): T {
  try {
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function WebsiteEditor() {
  const saved = Route.useLoaderData()
  const router = useRouter()
  const [values, setValues] = useState<Settings>(saved)
  const [tab, setTab] = useState<Tab>('brand')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const changed = useMemo(() => Object.keys(values).filter((k) => values[k] !== saved[k]), [values, saved])
  const set = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }))
  const v = (k: string) => values[k] ?? ''
  const list = <T,>(k: string, fallback: T[] = []) => parse<T[]>(values[k], fallback)
  const setList = (k: string) => (items: unknown[]) => setValues((s) => ({ ...s, [k]: JSON.stringify(items) }))

  const importInput = useRef<HTMLInputElement>(null)

  const doExport = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const data = await exportSite()
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `website-${location.hostname.replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      setMsg({
        tone: 'success',
        text: `Exported ${Object.keys(data.settings).length} settings and ${Object.keys(data.media).length} uploaded file(s).${data.skipped.length ? ` Not included: ${data.skipped.join(', ')}.` : ''}`,
      })
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : 'Export failed.' })
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (file: File) => {
    if (!confirm('Replace this website’s pictures, text, colours and settings with the ones in this file?')) return
    setBusy(true)
    setMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await importSite({ data: fd })
      if (!res.ok) return setMsg({ tone: 'error', text: res.error })
      await router.invalidate()
      setMsg({
        tone: 'success',
        text: `Imported ${res.settings} settings and ${res.media} photo/video file(s).${res.skipped.length ? ` Re-upload these by hand: ${res.skipped.join(', ')}.` : ''}`,
      })
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : 'Import failed.' })
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setMsg(null)
    const res = await saveSiteSettings({ data: { values: Object.fromEntries(changed.map((k) => [k, values[k]])) } })
    setBusy(false)
    if (!res.ok) return setMsg({ tone: 'error', text: res.error })
    setMsg({ tone: 'success', text: 'Saved! The website has been updated.' })
    await router.invalidate()
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Website editor"
        subtitle="Change the logo, colours, pictures, videos and all the text on the public website."
        actions={
          <>
            <button type="button" className="btn-ghost" disabled={busy} onClick={doExport} title="Download everything in the Website editor, including uploaded photos">
              ⬇ Export
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => importInput.current?.click()} title="Load an export file from another copy of the site">
              ⬆ Import
            </button>
            <input
              ref={importInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) doImport(f)
              }}
            />
            <a href="/" target="_blank" rel="noreferrer" className="btn-ghost">
              View website ↗
            </a>
          </>
        }
      />

      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-xs ring-1 ring-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-brand-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {tab === 'brand' && (
          <>
            <Section title="Company" hint="Shown in the header, footer, receipts and browser tab.">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Company name" value={v('company_name')} onChange={set('company_name')} />
                <TextField label="Tagline" value={v('tagline')} onChange={set('tagline')} />
              </div>
              <TextField
                label="Google description (SEO)"
                value={v('seo_description')}
                onChange={set('seo_description')}
                multiline
                rows={2}
                hint="The short text Google shows under your site name. About 150 characters."
              />
            </Section>
            <Section title="Logo & site icon">
              <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                <MediaField label="Logo" value={v('logo_key')} onChange={set('logo_key')} aspect="aspect-[3/1]" hint="PNG with a transparent background works best. Leave empty to use the built-in logo." />
                <MediaField
                  label="Site icon (favicon)"
                  value={v('favicon_key')}
                  onChange={set('favicon_key')}
                  kind="icon"
                  hint="Square PNG, 512×512. Appears in the browser tab. Browsers keep the old icon for a while — press Ctrl+Shift+R or open a private window to see the new one."
                />
              </div>
            </Section>
            <Section title="Logo & text size">
              <div className="grid gap-6 md:grid-cols-2">
                <RangeField label="Logo height" value={v('logo_height')} onChange={set('logo_height')} min={24} max={120} hint="Header and footer. Dashboards use a smaller version." />
                <RangeField label="Company name text size" value={v('logo_name_size')} onChange={set('logo_name_size')} min={12} max={40} />
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-accent-500)]"
                    checked={v('logo_show_name') !== '0'}
                    onChange={(e) => set('logo_show_name')(e.target.checked ? '1' : '0')}
                  />
                  Show the company name next to the uploaded logo
                  <span className="text-xs text-slate-400">(turn off if the name is already in the logo)</span>
                </label>
                <RangeField label="Text size for the whole website" value={v('base_font_size')} onChange={set('base_font_size')} min={14} max={20} hint="16px is standard. Everything — headings, buttons, text — grows or shrinks together." />
              </div>
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: v('header_bg') }}>
                {v('logo_key') ? (
                  <img src={mediaUrl(v('logo_key'))} alt="" style={{ height: `${Number(v('logo_height')) || 44}px` }} className="w-auto object-contain" />
                ) : null}
                {(!v('logo_key') || v('logo_show_name') !== '0') && (
                  <span className="font-display font-bold" style={{ color: v('header_text'), fontSize: `${Number(v('logo_name_size')) || 20}px` }}>
                    {v('company_name')}
                  </span>
                )}
                <span className="ml-auto text-xs opacity-60" style={{ color: v('header_text') }}>
                  Preview on your header colour
                </span>
              </div>
            </Section>
            <Section title="Colours" hint="Every button, heading and background on the website, dashboards and receipts follows these two colours.">
              <div className="grid gap-4 md:grid-cols-2">
                <ColorField label="Main colour (dark)" value={v('primary_color')} onChange={set('primary_color')} />
                <ColorField label="Highlight colour (buttons)" value={v('accent_color')} onChange={set('accent_color')} />
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl p-4" style={{ background: v('primary_color') }}>
                <span className="font-display text-lg font-bold text-white">Preview</span>
                <span className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: v('accent_color') }}>
                  Track now →
                </span>
              </div>
            </Section>
          </>
        )}

        {tab === 'layout' && (
          <>
            <Section title="Header (top menu bar)">
              <div className="grid gap-4 md:grid-cols-3">
                <ColorField label="Background" value={v('header_bg')} onChange={set('header_bg')} />
                <ColorField label="Text & links" value={v('header_text')} onChange={set('header_text')} />
                <RangeField label="Height" value={v('header_height')} onChange={set('header_height')} min={56} max={120} />
              </div>
              <div
                className="flex items-center justify-between rounded-xl px-5 text-sm"
                style={{ background: v('header_bg'), color: v('header_text'), minHeight: `${Number(v('header_height')) || 76}px` }}
              >
                <span className="font-display font-bold">{v('company_name')}</span>
                <span className="flex items-center gap-4 opacity-90">
                  <span>Home</span>
                  <span>Services</span>
                  <span>Track</span>
                  <span className="px-3 py-1.5 font-semibold" style={{ background: v('btn_accent_bg'), color: v('btn_accent_text'), borderRadius: `${v('btn_radius')}px` }}>
                    Merchant login
                  </span>
                </span>
              </div>
            </Section>

            <Section title="Page size">
              <div className="grid gap-6 md:grid-cols-2">
                <RangeField
                  label="Website width"
                  value={v('site_width')}
                  onChange={set('site_width')}
                  min={960}
                  max={1600}
                  step={20}
                  hint="How wide the content can get on big screens. 1200px is standard; 1400px+ feels wider."
                />
                <label className="block">
                  <span className="label">Top banner height (home page)</span>
                  <select className="input" value={v('hero_height')} onChange={(e) => set('hero_height')(e.target.value)}>
                    <option value="0">Fit the content</option>
                    <option value="60">Medium (60% of screen)</option>
                    <option value="75">Tall (75% of screen)</option>
                    <option value="85">Very tall (85% of screen)</option>
                    <option value="100">Full screen</option>
                  </select>
                </label>
              </div>
            </Section>

            <Section title="Buttons" hint="Colours for every button on the website and dashboards. 'Hover' is the colour when the mouse is over the button.">
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Main buttons (dark)</p>
              <div className="grid gap-4 md:grid-cols-3">
                <ColorField label="Background" value={v('btn_primary_bg')} onChange={set('btn_primary_bg')} />
                <ColorField label="Text" value={v('btn_primary_text')} onChange={set('btn_primary_text')} />
                <ColorField label="Hover background" value={v('btn_primary_hover')} onChange={set('btn_primary_hover')} />
              </div>
              <p className="pt-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Highlight buttons (e.g. "Track now", "Apply")</p>
              <div className="grid gap-4 md:grid-cols-3">
                <ColorField label="Background" value={v('btn_accent_bg')} onChange={set('btn_accent_bg')} />
                <ColorField label="Text" value={v('btn_accent_text')} onChange={set('btn_accent_text')} />
                <ColorField label="Hover background" value={v('btn_accent_hover')} onChange={set('btn_accent_hover')} />
              </div>
              <RangeField label="Corner roundness" value={v('btn_radius')} onChange={set('btn_radius')} min={0} max={30} hint="0 = square corners, 30 = pill-shaped." />
              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                {(['primary', 'accent'] as const).map((kind) => (
                  <div key={kind} className="flex flex-wrap items-center gap-3">
                    {(['normal', 'hover'] as const).map((state) => (
                      <span key={state} className="text-center">
                        <span
                          className="inline-block px-4 py-2 font-semibold"
                          style={{
                            background: v(state === 'hover' ? `btn_${kind}_hover` : `btn_${kind}_bg`),
                            color: v(`btn_${kind}_text`),
                            borderRadius: `${v('btn_radius')}px`,
                          }}
                        >
                          {kind === 'primary' ? 'Sign in' : 'Track now →'}
                        </span>
                        <span className="mt-1 block text-[11px] text-slate-400">{state}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === 'hero' && (
          <>
            <Section title="Top banner (hero)" hint="The first thing visitors see on the home page.">
              <TextField label="Small label above the heading" value={v('hero_badge')} onChange={set('hero_badge')} />
              <TextField label="Main heading" value={v('hero_title')} onChange={set('hero_title')} />
              <TextField label="Text under the heading" value={v('hero_subtitle')} onChange={set('hero_subtitle')} multiline rows={2} />
              <TextField label="Button text" value={v('hero_cta_label')} onChange={set('hero_cta_label')} />
            </Section>
            <Section title="Background picture or video">
              <div className="flex gap-2">
                {(['image', 'video'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('hero_media_type')(t)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${v('hero_media_type') === t ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {t === 'image' ? '🖼 Picture' : '🎬 Video'}
                  </button>
                ))}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <MediaField
                  label={v('hero_media_type') === 'video' ? 'Picture (shown while the video loads)' : 'Background picture'}
                  value={v('hero_image')}
                  onChange={set('hero_image')}
                  hint="Wide photo, at least 1920px across."
                />
                {v('hero_media_type') === 'video' && (
                  <MediaField
                    label="Background video"
                    value={v('hero_video')}
                    onChange={set('hero_video')}
                    kind="video"
                    hint="MP4, 10–30 seconds, no sound needed, under 60 MB. It plays silently on a loop."
                  />
                )}
              </div>
            </Section>
            <Section title="Numbers bar" hint="The white strip under the banner. Use real facts about the business.">
              <ListEditor<Stat>
                items={list<Stat>('stats_json')}
                onChange={setList('stats_json')}
                blank={{ value: '', label: '' }}
                addLabel="Add a number"
                columns={2}
                render={(it, up) => (
                  <>
                    <TextField label="Big text" value={it.value} onChange={(x) => up({ value: x })} placeholder="e.g. 5,000+" />
                    <TextField label="Small text" value={it.label} onChange={(x) => up({ label: x })} placeholder="e.g. Packages delivered" />
                  </>
                )}
              />
            </Section>
          </>
        )}

        {tab === 'services' && (
          <Section title="Services" hint="Shown on the home page (first 6) and the Services page.">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Section heading" value={v('services_title')} onChange={set('services_title')} />
              <TextField label="Section intro" value={v('services_subtitle')} onChange={set('services_subtitle')} />
            </div>
            <ListEditor<Service>
              items={list<Service>('services_json')}
              onChange={setList('services_json')}
              blank={{ title: '', description: '', image: '' }}
              addLabel="Add a service"
              columns={2}
              render={(it, up) => (
                <>
                  <MediaField label="Picture" value={it.image} onChange={(x) => up({ image: x })} aspect="aspect-[16/10]" />
                  <TextField label="Service name" value={it.title} onChange={(x) => up({ title: x })} />
                  <TextField label="Short description" value={it.description} onChange={(x) => up({ description: x })} multiline rows={2} />
                </>
              )}
            />
          </Section>
        )}

        {tab === 'about' && (
          <>
            <Section title="About us" hint="Home page (first paragraph) and the full About page.">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <TextField label="Heading" value={v('about_title')} onChange={set('about_title')} />
                  <TextField label="Text (leave an empty line between paragraphs)" value={v('about_body')} onChange={set('about_body')} multiline rows={8} />
                </div>
                <MediaField label="Picture" value={v('about_image')} onChange={set('about_image')} aspect="aspect-[4/3]" />
              </div>
              <span className="label">Key points (ticks)</span>
              <ListEditor<{ t: string }>
                items={list<string>('about_points_json').map((t) => ({ t }))}
                onChange={(items) => setList('about_points_json')(items.map((x) => x.t))}
                blank={{ t: '' }}
                addLabel="Add a point"
                columns={2}
                render={(it, up) => <TextField label="Point" value={it.t} onChange={(x) => up({ t: x })} />}
              />
            </Section>
            <Section title="Merchant banner" hint="The 'Vendors: store with us' banner inviting businesses to apply.">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <TextField label="Heading" value={v('merchant_title')} onChange={set('merchant_title')} />
                  <TextField label="Text" value={v('merchant_body')} onChange={set('merchant_body')} multiline rows={4} />
                </div>
                <MediaField label="Background picture" value={v('merchant_image')} onChange={set('merchant_image')} />
              </div>
            </Section>
          </>
        )}

        {tab === 'gallery' && (
          <Section title="Gallery" hint="Photos of your vans, riders, warehouse and team. The 1st and 6th photos are shown larger.">
            <TextField label="Heading" value={v('gallery_title')} onChange={set('gallery_title')} />
            <ListEditor<{ src: string }>
              items={list<string>('gallery_json').map((src) => ({ src }))}
              onChange={(items) => setList('gallery_json')(items.map((x) => x.src))}
              blank={{ src: '' }}
              addLabel="Add a photo"
              columns={3}
              render={(it, up) => <MediaField label="Photo" value={it.src} onChange={(x) => up({ src: x })} aspect="aspect-square" />}
            />
          </Section>
        )}

        {tab === 'faq' && (
          <>
            <Section title="How it works (steps)">
              <TextField label="Heading" value={v('steps_title')} onChange={set('steps_title')} />
              <ListEditor<Step>
                items={list<Step>('steps_json')}
                onChange={setList('steps_json')}
                blank={{ title: '', description: '' }}
                addLabel="Add a step"
                columns={2}
                render={(it, up) => (
                  <>
                    <TextField label="Step" value={it.title} onChange={(x) => up({ title: x })} />
                    <TextField label="Explanation" value={it.description} onChange={(x) => up({ description: x })} multiline rows={2} />
                  </>
                )}
              />
            </Section>
            <Section title="Frequently asked questions">
              <ListEditor<Faq>
                items={list<Faq>('faq_json')}
                onChange={setList('faq_json')}
                blank={{ q: '', a: '' }}
                addLabel="Add a question"
                render={(it, up) => (
                  <>
                    <TextField label="Question" value={it.q} onChange={(x) => up({ q: x })} />
                    <TextField label="Answer" value={it.a} onChange={(x) => up({ a: x })} multiline rows={2} />
                  </>
                )}
              />
            </Section>
            <Section title="Bottom call-to-action banner">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Heading" value={v('cta_title')} onChange={set('cta_title')} />
                <TextField label="Text" value={v('cta_body')} onChange={set('cta_body')} />
              </div>
            </Section>
          </>
        )}

        {tab === 'contact' && (
          <>
            <Section title="Contact details" hint="Used in the footer, Contact page, receipts and the WhatsApp button.">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Phone" value={v('phone')} onChange={set('phone')} />
                <TextField label="WhatsApp number" value={v('whatsapp')} onChange={set('whatsapp')} hint="With country code, e.g. +234 803 000 0000" />
                <TextField label="Email" value={v('email')} onChange={set('email')} />
                <TextField label="Opening hours" value={v('office_hours')} onChange={set('office_hours')} />
                <TextField label="Office address" value={v('address')} onChange={set('address')} />
                <TextField
                  label="Map location (optional)"
                  value={v('map_query')}
                  onChange={set('map_query')}
                  hint="Business name or exact address as Google Maps knows it. Leave empty to use the office address."
                />
              </div>
            </Section>
            <Section title="Social media" hint="Paste full links, e.g. https://instagram.com/ronialogistics. Empty ones are hidden.">
              <div className="grid gap-4 md:grid-cols-2">
                {SOCIALS.map((so) => (
                  <TextField key={so.key} label={so.label} value={v(so.key)} onChange={set(so.key)} placeholder="https://…" />
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === 'footer' && (
          <Section title="Footer (bottom of every page)">
            <div className="grid gap-4 md:grid-cols-3">
              <ColorField label="Background" value={v('footer_bg')} onChange={set('footer_bg')} />
              <ColorField label="Text & links" value={v('footer_text')} onChange={set('footer_text')} />
              <ColorField label="Column headings" value={v('footer_heading')} onChange={set('footer_heading')} />
            </div>
            <TextField
              label="About text under the logo"
              value={v('footer_about')}
              onChange={set('footer_about')}
              multiline
              rows={3}
              placeholder={v('tagline')}
              hint="Leave empty to use the tagline."
            />
            <TextField
              label="Copyright line"
              value={v('footer_copyright')}
              onChange={set('footer_copyright')}
              placeholder="© {year} {company}. All rights reserved."
              hint="{year} becomes the current year and {company} the company name. Leave empty for the default."
            />
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-accent-500)]"
                checked={v('footer_show_logo') !== '0'}
                onChange={(e) => set('footer_show_logo')(e.target.checked ? '1' : '0')}
              />
              Show the logo in the footer
            </label>
            <p className="text-xs text-slate-500">Contact details and social links in the footer come from the “Contact & social” tab.</p>
            <div className="rounded-xl p-5 text-sm" style={{ background: v('footer_bg'), color: v('footer_text') }}>
              <p className="font-semibold" style={{ color: v('footer_heading') }}>
                Company
              </p>
              <p className="mt-1 opacity-80">{v('footer_about') || v('tagline')}</p>
              <p className="mt-4 border-t border-current/10 pt-3 text-xs opacity-70">
                {(v('footer_copyright') || '© {year} {company}. All rights reserved.').replace('{year}', String(new Date().getFullYear())).replace('{company}', v('company_name'))}
              </p>
            </div>
          </Section>
        )}

        {tab === 'receipts' && (
          <Section title="Receipts & tracking numbers">
            <TextField label="Message at the bottom of receipts" value={v('receipt_footer')} onChange={set('receipt_footer')} multiline rows={2} />
            <TextField
              label="Tracking number prefix"
              value={v('tracking_prefix')}
              onChange={(x) => set('tracking_prefix')(x.toUpperCase())}
              hint="1–5 capital letters, e.g. RL gives RL-260926-7KP3Q. Only affects new shipments."
            />
          </Section>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-sm text-slate-500">{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}` : 'All changes saved'}</p>
          <div className="flex gap-2">
            {changed.length > 0 && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setValues(saved)}>
                Undo
              </button>
            )}
            <button type="button" className="btn-accent !px-6" disabled={busy || !changed.length} onClick={save}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
