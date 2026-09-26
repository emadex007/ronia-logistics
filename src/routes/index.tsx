import { createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '~/components/SiteLayout'
import { useSiteSettings } from '~/components/useSite'
import { AboutBlock, CtaBanner, FaqList, Gallery, Hero, MerchantCta, ServicesGrid, StatsBar, Steps } from '~/components/Sections'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const s = useSiteSettings()
  return (
    <SiteLayout settings={s}>
      <Hero s={s} />
      <StatsBar s={s} />
      <ServicesGrid s={s} limit={6} />
      <Steps s={s} />
      <AboutBlock s={s} />
      <MerchantCta s={s} />
      <Gallery s={s} />
      <FaqList s={s} />
      <CtaBanner s={s} />
    </SiteLayout>
  )
}
