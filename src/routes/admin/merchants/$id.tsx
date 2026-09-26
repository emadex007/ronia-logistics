import { useState } from 'react'
import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { createMerchantLogin, getMerchant, recordStockMovement, saveMerchant, saveProduct, setMerchantLogin } from '~/fns/merchants'
import { Alert, Field, PageHeader, StatCard, StatusBadge } from '~/components/ui'
import { MerchantFields, MovementsTable } from '~/components/MerchantBits'
import { MOVEMENT_TYPES, dateTime, fromKobo, money, toKobo } from '~/lib/format'
import type { MovementType, Product } from '~/lib/types'

export const Route = createFileRoute('/admin/merchants/$id')({
  loader: async ({ params }) => {
    const res = await getMerchant({ data: { id: Number(params.id) } })
    if (!res) throw notFound()
    return res
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.merchant.business_name ?? 'Merchant'} — Ronia Logistics` }] }),
  component: MerchantDetail,
})

type Msg = { tone: 'error' | 'success'; text: string } | null

function MerchantDetail() {
  const { merchant: m, products, movements, month, logins, shipments } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const canManage = user.role === 'admin' || user.role === 'manager'
  const [msg, setMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<'none' | 'product' | 'edit' | 'login'>('none')
  const [editing, setEditing] = useState<Product | null>(null)
  const [moveProduct, setMoveProduct] = useState<number | ''>(products[0]?.id ?? '')
  const [moveType, setMoveType] = useState<MovementType>('received')

  const units = products.reduce((s, p) => s + p.quantity, 0)
  const value = products.reduce((s, p) => s + p.quantity * p.unit_price, 0)
  const low = products.filter((p) => p.quantity <= p.low_stock_threshold).length
  const selected = products.find((p) => p.id === moveProduct)

  const done = async (res: { ok: boolean; error?: string }, success: string) => {
    setBusy(false)
    setMsg(res.ok ? { tone: 'success', text: success } : { tone: 'error', text: res.error ?? 'Something went wrong.' })
    if (res.ok) await router.invalidate()
    return res.ok
  }

  return (
    <>
      <PageHeader
        title={m.business_name}
        subtitle={[m.contact_name, m.phone, m.email].filter(Boolean).join(' · ') || 'Merchant'}
        actions={
          <>
            <a href={`/statement/${m.id}`} target="_blank" rel="noreferrer" className="btn-ghost">
              🖨 Stock statement
            </a>
            {canManage && (
              <button className="btn-ghost" onClick={() => setPanel(panel === 'edit' ? 'none' : 'edit')}>
                ✎ Edit details
              </button>
            )}
          </>
        }
      />

      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      {!m.is_active && (
        <div className="mb-4">
          <Alert tone="info">This merchant is inactive. Their portal login is disabled.</Alert>
        </div>
      )}

      {panel === 'edit' && canManage && (
        <form
          className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
            setBusy(true)
            const ok = await done(await saveMerchant({ data: { ...(f as never as { business_name: string }), id: m.id } }), 'Merchant details saved.')
            if (ok) setPanel('none')
          }}
        >
          <MerchantFields m={m} />
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <button className="btn-primary" disabled={busy}>
              Save changes
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={async () => {
                if (!confirm(m.is_active ? 'Mark this merchant inactive and disable their portal login?' : 'Re-activate this merchant?')) return
                setBusy(true)
                await done(await saveMerchant({ data: { ...m, id: m.id, is_active: !m.is_active } }), m.is_active ? 'Merchant marked inactive.' : 'Merchant re-activated.')
                setPanel('none')
              }}
            >
              {m.is_active ? 'Mark inactive' : 'Re-activate'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Units in warehouse" value={units.toLocaleString()} hint={`${products.length} product(s)`} accent />
        <StatCard label="Stock value" value={money(value)} hint="At merchant's selling price" />
        <StatCard label="Sold this month" value={month.sold} hint={money(month.sold_value)} />
        <StatCard label="Low stock" value={low} hint={low ? 'Tell the merchant to restock' : 'All good'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Products */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-display font-bold text-brand-900">Products in the warehouse</h2>
            <button
              className="btn-accent !px-3 !py-1.5"
              onClick={() => {
                setEditing(null)
                setPanel(panel === 'product' ? 'none' : 'product')
              }}
            >
              ＋ Add product
            </button>
          </div>

          {panel === 'product' && (
            <form
              key={editing?.id ?? 'new'}
              className="grid gap-3 border-b border-slate-100 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={async (e) => {
                e.preventDefault()
                const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
                setBusy(true)
                const ok = await done(
                  await saveProduct({
                    data: {
                      id: editing?.id,
                      merchant_id: m.id,
                      name: f.name,
                      sku: f.sku,
                      description: f.description,
                      unit_price: toKobo(f.unit_price),
                      low_stock_threshold: Number(f.low_stock_threshold || 5),
                      shelf_location: f.shelf_location,
                      opening_quantity: Number(f.opening_quantity || 0),
                    },
                  }),
                  editing ? 'Product updated.' : 'Product added.',
                )
                if (ok) {
                  setPanel('none')
                  setEditing(null)
                }
              }}
            >
              <Field label="Product name *">
                <input name="name" required defaultValue={editing?.name} className="input" />
              </Field>
              <Field label="SKU / code">
                <input name="sku" defaultValue={editing?.sku ?? ''} className="input" />
              </Field>
              <Field label="Selling price (₦)">
                <input name="unit_price" type="number" min={0} step="0.01" defaultValue={editing ? fromKobo(editing.unit_price) : ''} className="input" />
              </Field>
              <Field label="Shelf / location">
                <input name="shelf_location" defaultValue={editing?.shelf_location ?? ''} className="input" placeholder="e.g. Rack B2" />
              </Field>
              <Field label="Low-stock alert at">
                <input name="low_stock_threshold" type="number" min={0} defaultValue={editing?.low_stock_threshold ?? 5} className="input" />
              </Field>
              {!editing && (
                <Field label="Opening quantity">
                  <input name="opening_quantity" type="number" min={0} defaultValue={0} className="input" />
                </Field>
              )}
              <Field label="Description" className="sm:col-span-2 lg:col-span-3">
                <input name="description" defaultValue={editing?.description ?? ''} className="input" />
              </Field>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <button className="btn-primary" disabled={busy}>
                  {editing ? 'Save product' : 'Add product'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setPanel('none')}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Shelf</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">In stock</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No products yet. Add the items this merchant keeps with you.
                    </td>
                  </tr>
                )}
                {products.map((p) => {
                  const isLow = p.quantity <= p.low_stock_threshold
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2">
                        <p className="font-medium">{p.name}</p>
                        {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{p.shelf_location ?? '—'}</td>
                      <td className="px-4 py-2 text-right">{money(p.unit_price)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`font-display text-base font-bold ${isLow ? 'text-rose-700' : 'text-brand-900'}`}>{p.quantity}</span>
                        {isLow && <p className="text-[11px] text-rose-600">Low stock</p>}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button className="text-xs font-semibold text-brand-500 hover:underline" onClick={() => setMoveProduct(p.id)}>
                          Stock in/out
                        </button>
                        <span className="px-1 text-slate-300">|</span>
                        <button
                          className="text-xs font-semibold text-slate-500 hover:underline"
                          onClick={() => {
                            setEditing(p)
                            setPanel('product')
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock movement */}
        <div className="space-y-6">
          <form
            className="card space-y-3 p-5"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = e.currentTarget
              const f = Object.fromEntries(new FormData(form)) as Record<string, string>
              if (!moveProduct) return setMsg({ tone: 'error', text: 'Add a product first.' })
              setBusy(true)
              const ok = await done(
                await recordStockMovement({
                  data: {
                    product_id: Number(moveProduct),
                    merchant_id: m.id,
                    type: moveType,
                    quantity: Number(f.quantity),
                    unit_price: f.unit_price ? toKobo(f.unit_price) : undefined,
                    reference: f.reference,
                    note: f.note,
                    tracking_code: f.tracking_code,
                  },
                }),
                'Stock updated.',
              )
              if (ok) form.reset()
            }}
          >
            <h2 className="font-display font-bold text-brand-900">Record stock in / out</h2>
            <Field label="Product">
              <select className="input" value={moveProduct} onChange={(e) => setMoveProduct(Number(e.target.value))}>
                {products.length === 0 && <option value="">No products yet</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.quantity} in stock)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What happened">
              <select className="input" value={moveType} onChange={(e) => setMoveType(e.target.value as MovementType)}>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={moveType === 'adjustment' ? 'Qty (+/−)' : 'Quantity'}>
                <input name="quantity" type="number" required min={moveType === 'adjustment' ? undefined : 1} className="input" />
              </Field>
              {moveType === 'sold' && (
                <Field label="Sold at (₦ each)">
                  <input
                    name="unit_price"
                    type="number"
                    min={0}
                    step="0.01"
                    key={moveProduct}
                    defaultValue={selected ? fromKobo(selected.unit_price) : ''}
                    className="input"
                  />
                </Field>
              )}
            </div>
            {(moveType === 'sold' || moveType === 'dispatched') && (
              <Field label="Shipment tracking no. (optional)">
                <input name="tracking_code" className="input font-mono uppercase" placeholder="RL-…" />
              </Field>
            )}
            <Field label="Reference (invoice, waybill…)">
              <input name="reference" className="input" />
            </Field>
            <Field label="Note">
              <input name="note" className="input" />
            </Field>
            <button className="btn-primary w-full" disabled={busy || !products.length}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </form>

          {/* Portal login */}
          <div className="card space-y-3 p-5 text-sm">
            <h2 className="font-display font-bold text-brand-900">Merchant portal login</h2>
            {logins.length === 0 && <p className="text-slate-500">No login yet. Create one so the merchant can see their stock and sales online.</p>}
            {logins.map((l) => (
              <div key={l.id} className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold">{l.full_name}</p>
                <p className="text-xs text-slate-500">{l.email}</p>
                <p className="text-xs text-slate-400">Last login: {dateTime(l.last_login_at)}</p>
                {canManage && (
                  <div className="mt-2 flex gap-2">
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs"
                      disabled={busy}
                      onClick={async () => {
                        const pw = prompt('New password (min. 8 characters):')
                        if (!pw) return
                        setBusy(true)
                        await done(await setMerchantLogin({ data: { user_id: l.id, password: pw } }), 'Password changed.')
                      }}
                    >
                      Reset password
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        await done(await setMerchantLogin({ data: { user_id: l.id, is_active: !l.is_active } }), l.is_active ? 'Login disabled.' : 'Login enabled.')
                      }}
                    >
                      {l.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {canManage && panel !== 'login' && (
              <button className="btn-ghost w-full" onClick={() => setPanel('login')}>
                ＋ Create portal login
              </button>
            )}
            {canManage && panel === 'login' && (
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
                  setBusy(true)
                  const ok = await done(
                    await createMerchantLogin({ data: { merchant_id: m.id, full_name: f.full_name, email: f.email, password: f.password } }),
                    `Login created. Share the email and password with ${m.business_name}; they sign in at /login.`,
                  )
                  if (ok) setPanel('none')
                }}
              >
                <input name="full_name" placeholder="Name" defaultValue={m.contact_name ?? ''} className="input" />
                <input name="email" type="email" required placeholder="Email" defaultValue={m.email ?? ''} className="input" />
                <input name="password" type="text" required minLength={8} placeholder="Temporary password" className="input" />
                <button className="btn-primary w-full" disabled={busy}>
                  Create login
                </button>
              </form>
            )}
          </div>

          {canManage && (m.bank_name || m.account_number) && (
            <div className="card space-y-1 p-5 text-sm">
              <h2 className="font-display font-bold text-brand-900">Payout account</h2>
              <p>{m.account_name}</p>
              <p className="font-mono">{m.account_number}</p>
              <p className="text-slate-500">{m.bank_name}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-display font-bold text-brand-900">Recent stock movements</h2>
          <a href={`/statement/${m.id}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-500 hover:underline">
            Full statement ↗
          </a>
        </div>
        <MovementsTable rows={movements} />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display font-bold text-brand-900">Deliveries for this merchant</h2>
          <p className="text-xs text-slate-500">Shipments created with this merchant selected.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {shipments.length === 0 && <p className="p-5 text-sm text-slate-500">None yet.</p>}
          {shipments.map((s) => (
            <Link
              key={s.id}
              to="/admin/shipments/$id"
              params={{ id: String(s.id) }}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-slate-50"
            >
              <span className="font-mono font-semibold text-brand-900">{s.tracking_code}</span>
              <span className="text-slate-600">
                {s.receiver_name} → {s.destination_city}
              </span>
              {s.cod_amount > 0 && <span className="text-xs text-violet-700">Collect {money(s.cod_amount)}</span>}
              <span className="ml-auto">
                <StatusBadge status={s.status} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
