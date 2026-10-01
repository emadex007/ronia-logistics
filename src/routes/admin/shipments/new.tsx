import { useRef, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { createShipment } from '~/fns/shipments'
import { quotePrice } from '~/fns/booking'
import { merchantOptions } from '~/fns/merchants'
import { Alert, Field, PageHeader } from '~/components/ui'
import { SERVICE_TYPES, toKobo } from '~/lib/format'

export const Route = createFileRoute('/admin/shipments/new')({
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('shipments')) throw redirect({ to: '/admin' })
  },
  loader: () => merchantOptions(),
  component: NewShipment,
})

function NewShipment() {
  const merchants = Route.useLoaderData()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState<'paid' | 'unpaid' | 'cod'>('paid')
  const [service, setService] = useState('standard')
  const formRef = useRef<HTMLFormElement>(null)
  const [quote, setQuote] = useState('')

  async function fillFromPriceList() {
    const form = formRef.current
    if (!form) return
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>
    if (!f.destination_city) return setQuote('Enter the destination city first.')
    const q = await quotePrice({
      data: { origin: f.origin_city || 'Abuja', destination: f.destination_city, service: f.service_type, weight: Number(f.weight_kg) || 0, quantity: Number(f.quantity) || 1 },
    }).catch(() => null)
    if (!q) return setQuote(`No price set for ${f.origin_city || 'Abuja'} → ${f.destination_city} (${f.service_type}). Enter it manually or add it under Prices.`)
    const input = form.elements.namedItem('shipping_fee') as HTMLInputElement
    input.value = String(q.fee / 100)
    setQuote(`Price list: ₦${(q.fee / 100).toLocaleString('en-NG')}${q.eta ? ` · ${q.eta}` : ''}`)
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setBusy(true)
    setError('')
    const res = await createShipment({
      data: {
        sender_name: f.sender_name,
        sender_phone: f.sender_phone,
        sender_email: f.sender_email,
        sender_address: f.sender_address,
        receiver_name: f.receiver_name,
        receiver_phone: f.receiver_phone,
        receiver_email: f.receiver_email,
        receiver_address: f.receiver_address,
        origin_city: f.origin_city,
        destination_city: f.destination_city,
        destination_country: f.destination_country,
        service_type: f.service_type,
        description: f.description,
        quantity: Number(f.quantity || 1),
        weight_kg: f.weight_kg ? Number(f.weight_kg) : null,
        declared_value: toKobo(f.declared_value),
        shipping_fee: toKobo(f.shipping_fee),
        cod_amount: payment === 'cod' ? toKobo(f.cod_amount) : 0,
        payment_status: payment,
        payment_method: f.payment_method,
        estimated_delivery: f.estimated_delivery,
        status: f.status === 'pending' ? 'pending' : 'received',
        merchant_id: f.merchant_id ? Number(f.merchant_id) : null,
      },
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    navigate({ to: '/admin/shipments/$id', params: { id: String(res.id) }, search: { created: 1 } })
  }

  return (
    <>
      <PageHeader title="New shipment" subtitle="Register a package. A tracking number and receipt are generated automatically." />
      <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
        {error && <Alert>{error}</Alert>}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card space-y-4 p-5">
            <h2 className="font-display font-bold text-brand-900">Sender</h2>
            <Field label="Full name *">
              <input name="sender_name" required className="input" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone *">
                <input name="sender_phone" type="tel" required className="input" />
              </Field>
              <Field label="Email">
                <input name="sender_email" type="email" className="input" />
              </Field>
            </div>
            <Field label="Address">
              <input name="sender_address" className="input" />
            </Field>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-display font-bold text-brand-900">Receiver</h2>
            <Field label="Full name *">
              <input name="receiver_name" required className="input" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone *">
                <input name="receiver_phone" type="tel" required className="input" />
              </Field>
              <Field label="Email">
                <input name="receiver_email" type="email" className="input" />
              </Field>
            </div>
            <Field label="Delivery address *">
              <input name="receiver_address" required className="input" />
            </Field>
          </section>
        </div>

        <section className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <h2 className="font-display font-bold text-brand-900 sm:col-span-2 lg:col-span-4">Route & package</h2>
          <Field label="Service">
            <select name="service_type" className="input" value={service} onChange={(e) => setService(e.target.value)}>
              {SERVICE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From (city)">
            <input name="origin_city" defaultValue="Abuja" className="input" />
          </Field>
          <Field label="To (city) *">
            <input name="destination_city" required className="input" placeholder={service === 'same_day' ? 'Abuja' : 'e.g. Lagos'} />
          </Field>
          <Field label="Country">
            <input name="destination_country" defaultValue="Nigeria" key={service} className="input" placeholder={service === 'international' ? 'e.g. United Kingdom' : ''} />
          </Field>
          <Field label="What's inside" className="sm:col-span-2">
            <input name="description" className="input" placeholder="e.g. 2 pairs of shoes, documents" />
          </Field>
          <Field label="Quantity">
            <input name="quantity" type="number" min={1} defaultValue={1} className="input" />
          </Field>
          <Field label="Weight (kg)">
            <input name="weight_kg" type="number" min={0} step="0.1" className="input" />
          </Field>
          <Field label="Declared value (₦)">
            <input name="declared_value" type="number" min={0} step="0.01" className="input" />
          </Field>
          <Field label="Estimated delivery">
            <input name="estimated_delivery" type="date" className="input" />
          </Field>
          <Field label="For merchant (optional)">
            <select name="merchant_id" className="input" defaultValue="">
              <option value="">— Walk-in customer —</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.business_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Package is…">
            <select name="status" className="input" defaultValue="received">
              <option value="received">Here at the office</option>
              <option value="pending">Awaiting pickup</option>
            </select>
          </Field>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <h2 className="font-display font-bold text-brand-900 sm:col-span-2 lg:col-span-4">Payment</h2>
          <Field label="Shipping fee (₦) *">
            <div className="flex gap-2">
              <input name="shipping_fee" type="number" min={0} step="0.01" required className="input" />
              <button type="button" className="btn-ghost shrink-0 !px-3 text-xs" onClick={fillFromPriceList} title="Fill in the price from your price list">
                Use price list
              </button>
            </div>
            {quote && <p className="mt-1 text-xs text-slate-500">{quote}</p>}
          </Field>
          <Field label="Payment status">
            <select className="input" value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
              <option value="paid">Paid now</option>
              <option value="unpaid">Not paid yet</option>
              <option value="cod">Receiver pays on delivery</option>
            </select>
          </Field>
          {payment === 'paid' && (
            <Field label="Paid by">
              <select name="payment_method" className="input">
                <option value="cash">Cash</option>
                <option value="transfer">Bank transfer</option>
                <option value="pos">POS</option>
              </select>
            </Field>
          )}
          {payment === 'cod' && (
            <Field label="Amount to collect (₦)" className="lg:col-span-2">
              <input name="cod_amount" type="number" min={0} step="0.01" className="input" placeholder="Goods value to collect from receiver" />
            </Field>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => history.back()}>
            Cancel
          </button>
          <button className="btn-accent !px-6" disabled={busy}>
            {busy ? 'Saving…' : 'Create shipment & get tracking number'}
          </button>
        </div>
      </form>
    </>
  )
}
