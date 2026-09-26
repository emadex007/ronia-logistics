import { useEffect, useState } from 'react'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { getMe } from '~/fns/auth'
import { getShipment } from '~/fns/shipments'
import { getSiteContent } from '~/fns/public'
import { Logo } from '~/components/ui'
import { dateOnly, dateTime, money, serviceLabel, statusLabel } from '~/lib/format'

export const Route = createFileRoute('/print/$id')({
  validateSearch: (s: Record<string, unknown>): { type: 'receipt' | 'label' } => ({ type: s.type === 'label' ? 'label' : 'receipt' }),
  beforeLoad: async () => {
    const me = await getMe()
    if (!me || me.role === 'merchant' || me.role === 'customer') throw redirect({ to: '/staff/login' })
  },
  loader: async ({ params }) => {
    const [res, site] = await Promise.all([getShipment({ data: { id: Number(params.id) } }), getSiteContent()])
    if (!res) throw notFound()
    return { ...res, settings: site.settings }
  },
  head: () => ({ meta: [{ title: 'Print — Ronia Logistics' }] }),
  component: PrintPage,
})

function useTrackUrl(code: string) {
  const [url, setUrl] = useState('')
  useEffect(() => setUrl(`${window.location.origin}/track?code=${encodeURIComponent(code)}`), [code])
  return url
}

function PrintPage() {
  const { type } = Route.useSearch()
  const { shipment: s, settings } = Route.useLoaderData()
  const trackUrl = useTrackUrl(s.tracking_code)
  const qr = trackUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(trackUrl)}` : ''

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-2xl items-center justify-between px-4">
        <a href={`/admin/shipments/${s.id}`} className="btn-ghost">
          ← Back
        </a>
        <div className="flex gap-2">
          <a href={`/print/${s.id}?type=${type === 'receipt' ? 'label' : 'receipt'}`} className="btn-ghost">
            Switch to {type === 'receipt' ? 'label' : 'receipt'}
          </a>
          <button className="btn-primary" onClick={() => window.print()}>
            🖨 Print
          </button>
        </div>
      </div>

      {type === 'receipt' ? (
        <div className="mx-auto max-w-2xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
          <div className="flex items-start justify-between gap-6 border-b-2 border-brand-900 pb-5">
            <div>
              <Logo name={settings.company_name} />
              <p className="mt-2 text-xs text-slate-600">{settings.address}</p>
              <p className="text-xs text-slate-600">
                {settings.phone} · {settings.email}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-extrabold text-brand-900">RECEIPT</p>
              <p className="mt-1 text-xs text-slate-500">Date: {dateTime(s.created_at)}</p>
              <p className="text-xs text-slate-500">Served by: {s.created_by_name ?? '—'}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-6 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Tracking number</p>
              <p className="font-mono text-2xl font-bold tracking-widest text-brand-900">{s.tracking_code}</p>
              <p className="mt-1 text-xs text-slate-500">Track online: {trackUrl || '/track'}</p>
            </div>
            {qr && <img src={qr} alt="QR code" className="h-24 w-24" />}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Sender</p>
              <p className="mt-1 font-semibold">{s.sender_name}</p>
              <p>{s.sender_phone}</p>
              {s.sender_address && <p className="text-slate-600">{s.sender_address}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Receiver</p>
              <p className="mt-1 font-semibold">{s.receiver_name}</p>
              <p>{s.receiver_phone}</p>
              <p className="text-slate-600">{s.receiver_address}</p>
              <p className="text-slate-600">
                {s.destination_city}, {s.destination_country}
              </p>
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <tbody className="divide-y divide-slate-200 border-y border-slate-200">
              <R label="Service" value={serviceLabel(s.service_type)} />
              <R label="Route" value={`${s.origin_city} → ${s.destination_city}`} />
              <R label="Contents" value={s.description ?? '—'} />
              <R label="Quantity / weight" value={`${s.quantity}${s.weight_kg ? ` · ${s.weight_kg} kg` : ''}`} />
              <R label="Declared value" value={money(s.declared_value)} />
              <R label="Estimated delivery" value={dateOnly(s.estimated_delivery)} />
              {s.cod_amount > 0 && <R label="To collect on delivery" value={money(s.cod_amount)} />}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-900 px-5 py-4 text-white">
            <div>
              <p className="text-xs tracking-wide text-slate-300 uppercase">Shipping fee</p>
              <p className="text-xs text-slate-300">
                {s.payment_status === 'paid' ? `PAID${s.payment_method ? ` · ${s.payment_method.toUpperCase()}` : ''}` : s.payment_status === 'cod' ? 'PAY ON DELIVERY' : 'NOT YET PAID'}
              </p>
            </div>
            <p className="font-display text-2xl font-bold">{money(s.shipping_fee)}</p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-10 text-xs text-slate-500">
            <div className="border-t border-slate-400 pt-1">Customer signature</div>
            <div className="border-t border-slate-400 pt-1">Staff signature</div>
          </div>
          <p className="mt-8 text-center text-xs text-slate-500">{settings.receipt_footer}</p>
        </div>
      ) : (
        <div className="mx-auto w-[100mm] border-2 border-black bg-white p-4 text-black print:m-0">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <span className="font-display text-lg font-extrabold">{settings.company_name}</span>
            <span className="text-xs font-bold uppercase">{serviceLabel(s.service_type)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-b-2 border-black py-3">
            <div>
              <p className="text-[10px] font-bold uppercase">Tracking no.</p>
              <p className="font-mono text-xl font-extrabold tracking-wider">{s.tracking_code}</p>
            </div>
            {qr && <img src={qr} alt="QR" className="h-20 w-20" />}
          </div>
          <div className="border-b-2 border-black py-3">
            <p className="text-[10px] font-bold uppercase">Deliver to</p>
            <p className="text-lg leading-tight font-extrabold">{s.receiver_name}</p>
            <p className="text-base font-bold">{s.receiver_phone}</p>
            <p className="text-sm">{s.receiver_address}</p>
            <p className="text-xl font-extrabold uppercase">
              {s.destination_city}
              {s.destination_country !== 'Nigeria' ? `, ${s.destination_country}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 py-2 text-xs">
            <div>
              <p className="font-bold uppercase">From</p>
              <p>{s.sender_name}</p>
              <p>{s.sender_phone}</p>
              <p>{s.origin_city}</p>
            </div>
            <div className="text-right">
              <p>
                Qty: <b>{s.quantity}</b>
                {s.weight_kg ? ` · ${s.weight_kg}kg` : ''}
              </p>
              <p>{dateOnly(s.created_at)}</p>
              <p className="mt-1 text-sm font-extrabold">
                {s.payment_status === 'cod' ? `COLLECT ${money(s.cod_amount + (s.payment_status === 'cod' ? s.shipping_fee : 0))}` : s.payment_status === 'paid' ? 'PAID' : 'UNPAID'}
              </p>
              <p className="text-[10px]">{statusLabel(s.status)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function R({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-slate-500">{label}</td>
      <td className="py-2 text-right font-medium">{value}</td>
    </tr>
  )
}
