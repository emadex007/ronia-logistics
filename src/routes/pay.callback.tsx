import { Link, createFileRoute } from '@tanstack/react-router'
import { verifyOnlinePayment } from '~/fns/payments'
import { getSiteContent } from '~/fns/public'
import { SiteLayout } from '~/components/SiteLayout'
import { money } from '~/lib/format'

export const Route = createFileRoute('/pay/callback')({
  validateSearch: (s: Record<string, unknown>) => ({
    reference: typeof s.reference === 'string' ? s.reference : typeof s.trxref === 'string' ? s.trxref : '',
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [site, result] = await Promise.all([
      getSiteContent(),
      deps.reference ? verifyOnlinePayment({ data: { reference: deps.reference } }) : Promise.resolve({ ok: false as const, error: 'Missing payment reference.', code: null }),
    ])
    return { site, result }
  },
  head: () => ({ meta: [{ title: 'Payment — Ronia Logistics' }] }),
  component: Callback,
})

function Callback() {
  const { site, result } = Route.useLoaderData()
  return (
    <SiteLayout settings={site.settings}>
      <section className="mx-auto max-w-lg px-4 py-20 text-center">
        {result.ok ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">✓</div>
            <h1 className="mt-5 font-display text-2xl font-bold text-brand-900">Payment received</h1>
            <p className="mt-2 text-slate-600">
              Thank you! {'amount' in result && result.amount ? `${money(result.amount)} ` : ''}has been paid for shipment{' '}
              <b className="font-mono">{result.code}</b>. A receipt has been sent to your email by Paystack.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-3xl">!</div>
            <h1 className="mt-5 font-display text-2xl font-bold text-brand-900">Payment not confirmed</h1>
            <p className="mt-2 text-slate-600">{result.error}</p>
            <p className="mt-1 text-sm text-slate-500">If money left your account, call {site.settings.phone} with your tracking number.</p>
          </>
        )}
        {result.code && (
          <Link to="/track" search={{ code: result.code }} className="btn-primary mt-8">
            Track this package
          </Link>
        )}
      </section>
    </SiteLayout>
  )
}
