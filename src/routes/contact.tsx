import { createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '~/components/SiteLayout'
import { useSiteSettings } from '~/components/useSite'
import { ContactBlock, FaqList, PageHero, TrackBox } from '~/components/Sections'

export const Route = createFileRoute('/contact')({
  head: () => ({ meta: [{ title: 'Contact us — Ronia Logistics' }] }),
  component: ContactPage,
})

function ContactPage() {
  const s = useSiteSettings()
  return (
    <SiteLayout settings={s}>
      <PageHero title="Contact us" subtitle={s.cta_body || 'Call, WhatsApp or visit our office — we are happy to help.'} image={s.hero_image} />
      <ContactBlock s={s} />
      <section className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="card p-6">
          <p className="font-display text-lg font-bold text-brand-900">Already sent a package?</p>
          <p className="mb-4 text-sm text-slate-500">Track it here with the number on your receipt.</p>
          <TrackBox compact />
        </div>
      </section>
      <FaqList s={s} />
    </SiteLayout>
  )
}
