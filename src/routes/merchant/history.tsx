import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getPortalHistory } from '~/fns/portal'
import { PageHeader, StatCard } from '~/components/ui'
import { MovementsTable } from '~/components/MerchantBits'
import { money } from '~/lib/format'

type Search = { from?: string; to?: string; product?: number }

export const Route = createFileRoute('/merchant/history')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    from: typeof s.from === 'string' && s.from ? s.from : undefined,
    to: typeof s.to === 'string' && s.to ? s.to : undefined,
    product: Number(s.product) > 0 ? Number(s.product) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getPortalHistory({ data: deps }),
  component: History,
})

function History() {
  const { movements, totals, products } = Route.useLoaderData()
  const search = Route.useSearch()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate({ from: '/merchant/history' })
  const qs = new URLSearchParams({ ...(search.from ? { from: search.from } : {}), ...(search.to ? { to: search.to } : {}) }).toString()

  return (
    <>
      <PageHeader
        title="Stock history"
        subtitle="Every item received, sold, sent out or returned."
        actions={
          <a href={`/statement/${user.merchant_id}${qs ? `?${qs}` : ''}`} target="_blank" rel="noreferrer" className="btn-ghost">
            🖨 Print this period
          </a>
        }
      />

      <form
        className="card mb-4 grid gap-2 p-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
          navigate({ search: { from: f.from || undefined, to: f.to || undefined, product: f.product ? Number(f.product) : undefined } })
        }}
      >
        <input type="date" name="from" defaultValue={search.from} className="input" aria-label="From" />
        <input type="date" name="to" defaultValue={search.to} className="input" aria-label="To" />
        <select name="product" defaultValue={search.product ?? ''} className="input">
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="btn-primary">Filter</button>
      </form>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Received" value={totals.received} />
        <StatCard label="Sold" value={totals.sold} hint={money(totals.sold_value)} accent />
        <StatCard label="Sent out" value={totals.dispatched} />
        <StatCard label="Returned" value={totals.returned} />
      </div>

      <div className="card overflow-hidden">
        <MovementsTable rows={movements} showStaff={false} />
      </div>
    </>
  )
}
