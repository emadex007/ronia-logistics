import { createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '~/components/SiteLayout'
import { useSiteSettings } from '~/components/useSite'
import { AboutBlock, CtaBanner, Gallery, PageHero, StatsBar } from '~/components/Sections'

export const Route = createFileRoute('/about')({
  head: () => ({ meta: [{ title: 'About us — Ronia Logistics' }] }),
  component: AboutPage,
})

function AboutPage() {
  const s = useSiteSettings()
  return (
    <SiteLayout settings={s}>
      <PageHero title={s.about_title || 'About us'} subtitle={s.tagline} image={s.about_image} />
      <AboutBlock s={s} full />
      <StatsBar s={s} overlap={false} />
      <div className="pt-20">
        <Gallery s={s} />
      </div>
      <div className="pt-20">
        <CtaBanner s={s} />
      </div>
    </SiteLayout>
  )
}
