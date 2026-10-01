import { useState, type ReactNode } from 'react'
import { Link, createFileRoute, notFound, useRouter, redirect } from '@tanstack/react-router'
import { getShipment, markShipmentPaid, updateShipmentStatus } from '~/fns/shipments'
import { assignRider, listRiders } from '~/fns/rider'
import { Alert, Field, PageHeader, PaymentBadge, StatusBadge, Timeline } from '~/components/ui'
import { STATUSES, dateOnly, dateTime, money, serviceLabel } from '~/lib/format'
import type { ShipmentStatus } from '~/lib/types'

export const Route = createFileRoute('/admin/shipments/$id')({
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('shipments')) throw redirect({ to: '/admin' })
  },
  validateSearch: (s: Record<string, unknown>): { created?: number } => (s.created ? { created: 1 } : {}),
  loader: async ({ params }) => {
    const [res, riders] = await Promise.all([getShipment({ data: { id: Number(params.id) } }), listRiders()])
    if (!res) throw notFound()
    return { ...res, riders }
  },
  component: ShipmentDetail,
})

/** Suggest the natural next status */
const NEXT: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  pending: 'received',
  received: 'in_transit',
  in_transit: 'arrived_hub',
  arrived_hub: 'out_for_delivery',
  out_for_delivery: 'delivered',
}

function ShipmentDetail() {
  const { shipment: s, events, riders } = Route.useLoaderData()
  const { created } = Route.useSearch()
  const router = useRouter()
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [payMethod, setPayMethod] = useState('cash')
  const closed = s.status === 'delivered' || s.status === 'cancelled'

  return (
    <>
      <PageHeader
        title={s.tracking_code}
        subtitle={`${s.origin_city} → ${s.destination_city}${s.destination_country !== 'Nigeria' ? `, ${s.destination_country}` : ''} · ${serviceLabel(s.service_type)}`}
        actions={
          <>
            <a href={`/print/${s.id}?type=receipt`} target="_blank" rel="noreferrer" className="btn-ghost">
              🧾 Print receipt
            </a>
            <a href={`/print/${s.id}?type=label`} target="_blank" rel="noreferrer" className="btn-ghost">
              🏷 Print label
            </a>
          </>
        }
      />

      {created && (
        <div className="mb-4">
          <Alert tone="success">
            Shipment created. Tracking number <b className="font-mono">{s.tracking_code}</b>. Print the receipt for the customer.
          </Alert>
        </div>
      )}
      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card grid gap-5 p-5 sm:grid-cols-2">
            <Party title="Sender" name={s.sender_name} phone={s.sender_phone} email={s.sender_email} address={s.sender_address} />
            <Party title="Receiver" name={s.receiver_name} phone={s.receiver_phone} email={s.receiver_email} address={s.receiver_address} />
          </div>

          <div className="card grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4">
            <Info label="Status" value={<StatusBadge status={s.status} />} />
            <Info label="Current location" value={s.current_location ?? '—'} />
            <Info label="Contents" value={s.description ?? '—'} />
            <Info label="Qty / weight" value={`${s.quantity}${s.weight_kg ? ` · ${s.weight_kg} kg` : ''}`} />
            <Info label="Declared value" value={money(s.declared_value)} />
            <Info label="Est. delivery" value={dateOnly(s.estimated_delivery)} />
            <Info label="Booked" value={dateTime(s.created_at)} />
            <Info label="Delivered" value={dateTime(s.delivered_at)} />
          </div>

          {s.status === 'delivered' && (s.proof_image_key || s.recipient_signature || s.signed_by) && (
            <div className="card p-5">
              <h2 className="mb-4 font-display font-bold text-brand-900">Proof of delivery</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {s.proof_image_key && (
                  <a href={`/media/${s.proof_image_key}`} target="_blank" rel="noreferrer">
                    <img src={`/media/${s.proof_image_key}`} alt="Package at delivery" className="max-h-72 w-full rounded-xl object-cover ring-1 ring-slate-200" />
                  </a>
                )}
                <div className="space-y-3 text-sm">
                  <Row label="Received by" value={s.signed_by} />
                  <Row label="Delivered by" value={s.delivered_by_name} />
                  <Row label="Time" value={dateTime(s.delivered_at)} />
                  {s.recipient_signature && (
                    <div>
                      <p className="mb-1 text-slate-500">Signature</p>
                      <img src={`/media/${s.recipient_signature}`} alt="Signature" className="h-24 w-full rounded-lg bg-white object-contain ring-1 ring-slate-200" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-5 font-display font-bold text-brand-900">Tracking history</h2>
            <Timeline events={events} showStaff />
          </div>
        </div>

        <div className="space-y-6">
          {!closed && (
            <form
              className="card space-y-3 p-5"
              onSubmit={async (e) => {
                e.preventDefault()
                const form = e.currentTarget
                const f = new FormData(form)
                setBusy(true)
                const res = await updateShipmentStatus({
                  data: { id: s.id, status: f.get('status') as ShipmentStatus, location: String(f.get('location') || ''), note: String(f.get('note') || '') },
                })
                setBusy(false)
                setMsg(res.ok ? { tone: 'success', text: 'Status updated. Customer notifications queued.' } : { tone: 'error', text: res.error })
                if (res.ok) {
                  form.reset()
                  router.invalidate()
                }
              }}
            >
              <h2 className="font-display font-bold text-brand-900">Update status</h2>
              <Field label="New status">
                <select name="status" className="input" defaultValue={NEXT[s.status] ?? s.status} key={s.status}>
                  {STATUSES.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Location">
                <input name="location" className="input" placeholder="e.g. Lagos hub, Ikeja" />
              </Field>
              <Field label="Note (visible to customer)">
                <textarea name="note" rows={2} className="input" />
              </Field>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? 'Saving…' : 'Save update'}
              </button>
            </form>
          )}

          {!closed && (
            <div className="card space-y-3 p-5 text-sm">
              <h2 className="font-display font-bold text-brand-900">Rider / driver</h2>
              <select
                className="input"
                value={s.assigned_rider ?? ''}
                disabled={busy}
                onChange={async (e) => {
                  setBusy(true)
                  const riderId = e.target.value ? Number(e.target.value) : null
                  const res = await assignRider({ data: { id: s.id, riderId } })
                  setBusy(false)
                  setMsg(
                    res.ok
                      ? { tone: 'success', text: res.riderName ? `Assigned to ${res.riderName}. It now shows in their “My deliveries”.` : 'Rider removed.' }
                      : { tone: 'error', text: res.error },
                  )
                  if (res.ok) router.invalidate()
                }}
              >
                <option value="">— Not assigned —</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name}
                    {r.role === 'rider' ? '' : ` (${r.role})`} · {r.open_jobs} open
                  </option>
                ))}
              </select>
              {s.pickup_requested === 1 && s.status === 'pending' && (
                <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-900">Customer asked for pickup from: {s.sender_address || 'their address'}</p>
              )}
            </div>
          )}

          <div className="card space-y-3 p-5 text-sm">
            <h2 className="font-display font-bold text-brand-900">Payment</h2>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Shipping fee</span>
              <span className="font-semibold">{money(s.shipping_fee)}</span>
            </div>
            {s.cod_amount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Collect on delivery</span>
                <span className="font-semibold">{money(s.cod_amount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Status</span>
              <PaymentBadge status={s.payment_status} />
            </div>
            {s.payment_method && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Method</span>
                <span className="capitalize">{s.payment_method}</span>
              </div>
            )}
            {s.payment_status !== 'paid' && (
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                  <option value="pos">POS</option>
                </select>
                <button
                  className="btn-accent shrink-0"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    const res = await markShipmentPaid({ data: { id: s.id, method: payMethod } })
                    setBusy(false)
                    setMsg(res.ok ? { tone: 'success', text: 'Payment recorded and added to income.' } : { tone: 'error', text: res.error })
                    if (res.ok) router.invalidate()
                  }}
                >
                  Mark paid
                </button>
              </div>
            )}
          </div>

          <div className="card space-y-2 p-5 text-sm">
            <h2 className="font-display font-bold text-brand-900">Handled by</h2>
            <Row label="Registered by" value={s.created_by_name} />
            <Row label="Received by" value={s.received_by_name} />
            <Row label="Dispatched by" value={s.dispatched_by_name} />
            <Row label="Delivered by" value={s.delivered_by_name} />
          </div>

          <Link to="/track" search={{ code: s.tracking_code }} target="_blank" className="block text-center text-sm font-semibold text-brand-500 hover:underline">
            View public tracking page ↗
          </Link>
        </div>
      </div>
    </>
  )
}

function Party({ title, name, phone, email, address }: { title: string; name: string; phone: string; email: string | null; address: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      <p className="mt-1 font-semibold text-slate-900">{name}</p>
      <p className="text-sm">
        <a href={`tel:${phone}`} className="text-brand-500 hover:underline">
          {phone}
        </a>
      </p>
      {email && <p className="text-sm text-slate-600">{email}</p>}
      {address && <p className="text-sm text-slate-600">{address}</p>}
    </div>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 font-medium text-slate-900">{value}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value ?? '—'}</span>
    </div>
  )
}
