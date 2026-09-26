import { createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '~/components/SiteLayout'
import { useSiteSettings } from '~/components/useSite'
import { CtaBanner, MerchantCta, PageHero, ServicesGrid, Steps } from '~/components/Sections'
import { jsonSetting, type Service } from '~/lib/site'

export const Route = createFileRoute('/services')({
  head: () => ({ meta: [{ title: 'Services — Ronia Logistics' }] }),
  component: ServicesPage,
})

function ServicesPage() {
  const s = useSiteSettings()
  const first = jsonSetting<Service[]>(s, 'services_json', [])[0]
  return (
    <SiteLayout settings={s}>
      <PageHero title={s.services_title || 'Our services'} subtitle={s.services_subtitle} image={first?.image || s.hero_image} />
      <ServicesGrid s={s} />
      <Steps s={s} />
      <div className="pt-20">
        <MerchantCta s={s} />
      </div>
      <CtaBanner s={s} />
    </SiteLayout>
  )
}
