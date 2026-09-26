import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { getMe } from '~/fns/auth'
import { getFinance } from '~/fns/finance'
import { getSiteContent } from '~/fns/public'
import { Logo } from '~/components/ui'
import { dateOnly, dateTime, methodLabel, money, monthRange } from '~/lib/format'

type Search = { from?: string; to?: string }

const thisMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date()).slice(0, 7)

export const Route = createFileRoute('/report')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    from: typeof s.from === 'string' && s.from ? s.from : undefined,
    to: typeof s.to === 'string' && s.to ? s.to : undefined,
  }),
  beforeLoad: async () => {
    const me = await getMe()
    if (!me || (me.role !== 'admin' && me.role !== 'manager')) throw redirect({ to: '/login' })
    return { me }
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const range = deps.from && deps.to ? { from: deps.from, to: deps.to } : monthRange(thisMonth())
    const [fin, site] = await Promise.all([getFinance({ data: range }), getSiteContent()])
    return { ...fin, settings: site.settings }
  },
  head: () => ({ meta: [{ title: 'Income & expense report — Ronia Logistics' }] }),
  component: Report,
})

function Report() {
  const d = Route.useLoaderData()
  const { me } = Route.useRouteContext()
  const navigate = useNavigate({ from: '/report' })
  const { from, to } = d.filters
  const net = d.totals.income - d.totals.expense
  const incomeCats = d.byCategory.filter((c) => c.income > 0)
  const expenseCats = d.byCategory.filter((c) => c.expense > 0)

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <form
        className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-end gap-2 px-4"
        onSubmit={(e) => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
          navigate({ search: { from: f.from || undefined, to: f.to || undefined } })
        }}
      >
        <label>
          <span className="label">From</span>
          <input type="date" name="from" defaultValue={from} className="input" />
        </label>
        <label>
          <span className="label">To</span>
          <input type="date" name="to" defaultValue={to} className="input" />
        </label>
        <button className="btn-ghost">Apply</button>
        <button type="button" className="btn-primary ml-auto" onClick={() => window.print()}>
          🖨 Print
        </button>
      </form>

      <div className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-6 border-b-2 border-brand-900 pb-5">
          <div>
            <Logo name={d.settings.company_name} />
            <p className="mt-2 text-xs text-slate-600">{d.settings.address}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-extrabold text-brand-900">INCOME & EXPENSE REPORT</p>
            <p className="text-sm">
              {dateOnly(from)} – {dateOnly(to)}
            </p>
            <p className="text-xs text-slate-500">
              Printed {dateTime(new Date().toISOString())} by {me.full_name}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Box label="Total income" value={money(d.totals.income)} tone="text-emerald-700" />
          <Box label="Total expenses" value={money(d.totals.expense)} tone="text-rose-700" />
          <Box label={net >= 0 ? 'Net profit' : 'Net loss'} value={money(net)} tone={net >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Summary title="Income by category" rows={incomeCats.map((c) => [c.key, c.income])} total={d.totals.income} />
          <Summary title="Expenses by category" rows={expenseCats.map((c) => [c.key, c.expense])} total={d.totals.expense} />
        </div>

        <h2 className="mt-6 mb-2 font-display font-bold text-brand-900">By staff member</h2>
        <table className="w-full text-sm">
          <thead className="border-y border-slate-300 text-left text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="py-2">Staff</th>
              <th className="py-2 text-right">Entries</th>
              <th className="py-2 text-right">Received</th>
              <th className="py-2 text-right">Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.byStaff.map((s) => (
              <tr key={s.key}>
                <td className="py-1.5">{s.key}</td>
                <td className="py-1.5 text-right">{s.count}</td>
                <td className="py-1.5 text-right text-emerald-700">{money(s.income)}</td>
                <td className="py-1.5 text-right text-rose-700">{money(s.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-6 mb-2 font-display font-bold text-brand-900">All entries ({d.rows.length})</h2>
        <table className="w-full text-xs">
          <thead className="border-y border-slate-300 text-left tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Category</th>
              <th className="py-2">Description</th>
              <th className="py-2">Method</th>
              <th className="py-2">By</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.rows.map((t) => (
              <tr key={t.id}>
                <td className="py-1 whitespace-nowrap">{dateOnly(t.txn_date)}</td>
                <td className="py-1">{t.category}</td>
                <td className="py-1">{[t.description, t.tracking_code, t.reference].filter(Boolean).join(' · ') || '—'}</td>
                <td className="py-1">{methodLabel(t.method)}</td>
                <td className="py-1">{t.handled_by_name ?? 'Online'}</td>
                <td className={`py-1 text-right font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {t.type === 'income' ? '+' : '−'}
                  {money(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-12 grid grid-cols-2 gap-10 text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-1">Prepared by</div>
          <div className="border-t border-slate-400 pt-1">Approved by</div>
        </div>
      </div>
    </div>
  )
}

function Box({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`font-display text-lg font-bold ${tone}`}>{value}</p>
    </div>
  )
}

function Summary({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div>
      <h2 className="mb-2 font-display font-bold text-brand-900">{title}</h2>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td className="py-1.5 text-slate-500">None</td>
            </tr>
          )}
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="py-1.5">{k}</td>
              <td className="py-1.5 text-right">{money(v)}</td>
              <td className="w-12 py-1.5 text-right text-xs text-slate-400">{total ? Math.round((v / total) * 100) : 0}%</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 font-semibold">
            <td className="py-1.5">Total</td>
            <td className="py-1.5 text-right">{money(total)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
