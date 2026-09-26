import { useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { addTransaction, deleteTransaction, getFinance } from '~/fns/finance'
import { Alert, Field, PageHeader, StatCard } from '~/components/ui'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAY_METHODS, dateOnly, methodLabel, money, monthRange, toKobo } from '~/lib/format'

type Search = { month?: string; from?: string; to?: string; type?: 'income' | 'expense'; category?: string; staff?: number }

const thisMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date()).slice(0, 7)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())

function resolveRange(s: Search) {
  if (s.from && s.to) return { from: s.from, to: s.to }
  return monthRange(s.month ?? thisMonth())
}

export const Route = createFileRoute('/admin/finance')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    month: typeof s.month === 'string' && /^\d{4}-\d{2}$/.test(s.month) ? s.month : undefined,
    from: typeof s.from === 'string' && s.from ? s.from : undefined,
    to: typeof s.to === 'string' && s.to ? s.to : undefined,
    type: s.type === 'income' || s.type === 'expense' ? s.type : undefined,
    category: typeof s.category === 'string' && s.category ? s.category : undefined,
    staff: Number(s.staff) > 0 ? Number(s.staff) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getFinance({ data: { ...resolveRange(deps), type: deps.type, category: deps.category, staff: deps.staff } }),
  head: () => ({ meta: [{ title: 'Income & expenses — Ronia Logistics' }] }),
  component: FinancePage,
})

function FinancePage() {
  const d = Route.useLoaderData()
  const search = Route.useSearch()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate({ from: '/admin/finance' })
  const router = useRouter()
  const [showForm, setShowForm] = useState<'income' | 'expense' | null>(null)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const { from, to } = d.filters
  const net = d.totals.income - d.totals.expense
  const reportQs = new URLSearchParams({ from, to }).toString()
  const maxCat = Math.max(1, ...d.byCategory.map((c) => c.income + c.expense))

  return (
    <>
      <PageHeader
        title="Income & expenses"
        subtitle={`${dateOnly(from)} – ${dateOnly(to)}${d.isManager ? '' : ' · entries you recorded'}`}
        actions={
          <>
            <button className="btn-accent" onClick={() => setShowForm(showForm === 'income' ? null : 'income')}>
              ＋ Income
            </button>
            <button className="btn-primary" onClick={() => setShowForm(showForm === 'expense' ? null : 'expense')}>
              − Expense
            </button>
            {d.isManager && (
              <a href={`/report?${reportQs}`} target="_blank" rel="noreferrer" className="btn-ghost">
                🖨 Print report
              </a>
            )}
          </>
        }
      />

      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      {showForm && (
        <form
          key={showForm}
          className={`card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 ${showForm === 'income' ? 'border-emerald-200' : 'border-rose-200'}`}
          onSubmit={async (e) => {
            e.preventDefault()
            const form = e.currentTarget
            const f = Object.fromEntries(new FormData(form)) as Record<string, string>
            setBusy(true)
            const res = await addTransaction({
              data: {
                type: showForm,
                category: f.category === '__other' ? f.category_other : f.category,
                amount: toKobo(f.amount),
                description: f.description,
                method: f.method,
                reference: f.reference,
                txn_date: f.txn_date,
                handled_by: f.handled_by ? Number(f.handled_by) : undefined,
              },
            })
            setBusy(false)
            setMsg(res.ok ? { tone: 'success', text: `${showForm === 'income' ? 'Income' : 'Expense'} recorded.` } : { tone: 'error', text: res.error })
            if (res.ok) {
              form.reset()
              setShowForm(null)
              router.invalidate()
            }
          }}
        >
          <h2 className={`font-display font-bold sm:col-span-2 lg:col-span-4 ${showForm === 'income' ? 'text-emerald-800' : 'text-rose-800'}`}>
            Record {showForm === 'income' ? 'money received' : 'money spent'}
          </h2>
          <CategoryField type={showForm} />
          <Field label="Amount (₦) *">
            <input name="amount" type="number" min={0.01} step="0.01" required className="input" />
          </Field>
          <Field label="Paid by">
            <select name="method" className="input" defaultValue="cash">
              {PAY_METHODS.filter((m) => m.value !== 'paystack').map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input name="txn_date" type="date" defaultValue={today()} max={today()} className="input" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <input name="description" className="input" placeholder={showForm === 'expense' ? 'e.g. Fuel for Hilux bus, Abuja–Lagos trip' : 'e.g. Storage fee for September'} />
          </Field>
          <Field label="Receipt / reference no.">
            <input name="reference" className="input" />
          </Field>
          {d.isManager ? (
            <Field label="Handled by">
              <select name="handled_by" className="input" defaultValue={user.id}>
                {d.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Handled by">
              <input className="input" value={user.full_name} disabled />
            </Field>
          )}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Period + filters */}
      <form
        className="card mb-6 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
          const custom = f.from && f.to
          navigate({
            search: {
              month: custom ? undefined : f.month || undefined,
              from: custom ? f.from : undefined,
              to: custom ? f.to : undefined,
              type: (f.type || undefined) as Search['type'],
              category: f.category || undefined,
              staff: f.staff ? Number(f.staff) : undefined,
            },
          })
        }}
      >
        <label>
          <span className="label">Month</span>
          <input type="month" name="month" defaultValue={search.month ?? (search.from ? '' : thisMonth())} className="input" />
        </label>
        <label>
          <span className="label">Or from</span>
          <input type="date" name="from" defaultValue={search.from} className="input" />
        </label>
        <label>
          <span className="label">To</span>
          <input type="date" name="to" defaultValue={search.to} className="input" />
        </label>
        <label>
          <span className="label">Type</span>
          <select name="type" defaultValue={search.type ?? ''} className="input">
            <option value="">Income & expenses</option>
            <option value="income">Income only</option>
            <option value="expense">Expenses only</option>
          </select>
        </label>
        {d.isManager ? (
          <label>
            <span className="label">Staff</span>
            <select name="staff" defaultValue={search.staff ?? ''} className="input">
              <option value="">Everyone</option>
              {d.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
        <div className="flex items-end">
          <button className="btn-primary w-full">Show</button>
        </div>
        {search.category && (
          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-6">
            Category: <b>{search.category}</b>{' '}
            <button type="button" className="text-brand-500 hover:underline" onClick={() => navigate({ search: (s) => ({ ...s, category: undefined }) })}>
              clear
            </button>
          </p>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Money in" value={<span className="text-emerald-700">{money(d.totals.income)}</span>} />
        <StatCard label="Money out" value={<span className="text-rose-700">{money(d.totals.expense)}</span>} />
        <StatCard label={net >= 0 ? 'Profit' : 'Loss'} value={<span className={net >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{money(net)}</span>} accent />
        <StatCard label="Entries" value={d.totals.count} />
      </div>

      {d.isManager && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <h2 className="mb-4 font-display font-bold text-brand-900">By category</h2>
            {d.byCategory.length === 0 && <p className="text-sm text-slate-500">Nothing recorded in this period.</p>}
            <ul className="space-y-3">
              {d.byCategory.map((c) => {
                const isIncome = c.income >= c.expense
                const amt = c.income + c.expense
                return (
                  <li key={c.key}>
                    <button className="block w-full text-left" onClick={() => navigate({ search: (s) => ({ ...s, category: c.key }) })}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{c.key}</span>
                        <span className={isIncome ? 'text-emerald-700' : 'text-rose-700'}>
                          {isIncome ? '+' : '−'}
                          {money(amt)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${(amt / maxCat) * 100}%` }} />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="space-y-6">
            <Breakdown title="Who handled it" rows={d.byStaff} />
            <Breakdown title="Payment method" rows={d.byMethod.map((m) => ({ ...m, key: methodLabel(m.key) }))} />
          </div>
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Handled by</th>
              <th className="px-4 py-3 text-right">Amount</th>
              {user.role === 'admin' && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No entries for this period.
                </td>
              </tr>
            )}
            {d.rows.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-xs whitespace-nowrap text-slate-500">{dateOnly(t.txn_date)}</td>
                <td className="px-4 py-2">{t.category}</td>
                <td className="px-4 py-2 text-slate-600">
                  {t.description ?? '—'}
                  {(t.tracking_code || t.reference || t.business_name) && (
                    <div className="text-xs text-slate-400">{[t.tracking_code, t.reference, t.business_name].filter(Boolean).join(' · ')}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">{methodLabel(t.method)}</td>
                <td className="px-4 py-2 text-xs">{t.handled_by_name ?? 'Online / system'}</td>
                <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {t.type === 'income' ? '+' : '−'}
                  {money(t.amount)}
                </td>
                {user.role === 'admin' && (
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-xs text-slate-400 hover:text-rose-600"
                      disabled={busy}
                      onClick={async () => {
                        const reason = prompt('Why are you deleting this entry? (kept in the audit log)')
                        if (!reason) return
                        setBusy(true)
                        const res = await deleteTransaction({ data: { id: t.id, reason } })
                        setBusy(false)
                        setMsg(res.ok ? { tone: 'success', text: 'Entry deleted.' } : { tone: 'error', text: res.error })
                        if (res.ok) router.invalidate()
                      }}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CategoryField({ type }: { type: 'income' | 'expense' }) {
  const [other, setOther] = useState(false)
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return (
    <Field label="Category *">
      <select name="category" required className="input" onChange={(e) => setOther(e.target.value === '__other')} defaultValue={list[0]}>
        {list.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value="__other">Something else…</option>
      </select>
      {other && <input name="category_other" required className="input mt-2" placeholder="Type the category" />}
    </Field>
  )
}

function Breakdown({ title, rows }: { title: string; rows: { key: string; income: number; expense: number; count: number }[] }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 font-display font-bold text-brand-900">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-slate-500">—</p>}
      <ul className="divide-y divide-slate-100 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-2 py-2">
            <span>
              {r.key}
              <span className="ml-1 text-xs text-slate-400">({r.count})</span>
            </span>
            <span className="text-right text-xs">
              {r.income > 0 && <span className="block text-emerald-700">+{money(r.income)}</span>}
              {r.expense > 0 && <span className="block text-rose-700">−{money(r.expense)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
