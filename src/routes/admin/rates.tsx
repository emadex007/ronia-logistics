import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { deleteRate, listRates, saveBookingSettings, saveRate } from '~/fns/booking'
import { Alert, PageHeader } from '~/components/ui'
import { SERVICE_TYPES, money, serviceLabel } from '~/lib/format'

export const Route = createFileRoute('/admin/rates')({
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('finance')) throw redirect({ to: '/admin' })
  },
  loader: () => listRates(),
  head: () => ({ meta: [{ title: 'Prices & online booking — Ronia Logistics' }] }),
  component: RatesPage,
})

type Draft = {
  id?: number
  origin: string
  destination: string
  service_type: string
  base_fee: string
  included_kg: string
  extra_per_kg: string
  eta: string
  active: boolean
}
const EMPTY: Draft = { origin: 'Abuja', destination: '', service_type: 'standard', base_fee: '', included_kg: '2', extra_per_kg: '0', eta: '', active: true }
const naira = (kobo: number) => String(kobo / 100)

function RatesPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [enabled, setEnabled] = useState(data.enabled)
  const [note, setNote] = useState(data.note)
  const [testKg, setTestKg] = useState('5')

  const up = (k: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => (d ? { ...d, [k]: e.target.value } : d))

  async function save() {
    if (!draft) return
    setBusy(true)
    const res = await saveRate({
      data: {
        id: draft.id,
        origin: draft.origin,
        destination: draft.destination,
        service_type: draft.service_type,
        base_fee: Math.round(Number(draft.base_fee) * 100),
        included_kg: Number(draft.included_kg) || 0,
        extra_per_kg: Math.round(Number(draft.extra_per_kg) * 100),
        eta: draft.eta,
        active: draft.active ? 1 : 0,
      },
    })
    setBusy(false)
    setMsg(res.ok ? { tone: 'success', text: 'Price saved. The booking page uses it straight away.' } : { tone: 'error', text: res.error })
    if (res.ok) {
      setDraft(null)
      router.invalidate()
    }
  }

  const sample = (r: { base_fee: number; included_kg: number; extra_per_kg: number }) =>
    r.base_fee + Math.max(0, Math.ceil((Number(testKg) || 0) - r.included_kg)) * r.extra_per_kg

  return (
    <>
      <PageHeader
        title="Prices & online booking"
        subtitle="Customers see these prices on the “Book a delivery” page. Staff can also pull them into new shipments."
        actions={
          <>
            <a href="/book" target="_blank" rel="noreferrer" className="btn-ghost">
              View booking page ↗
            </a>
            <button className="btn-accent" onClick={() => setDraft({ ...EMPTY })}>
              ＋ Add price
            </button>
          </>
        }
      />
      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      <div className="card mb-6 space-y-3 p-5">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent-500)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Allow customers to book and pay online
        </label>
        <label className="block">
          <span className="label">Note shown beside the price</span>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const res = await saveBookingSettings({ data: { enabled, note } })
            setBusy(false)
            setMsg(res.ok ? { tone: 'success', text: 'Booking settings saved.' } : { tone: 'error', text: 'Could not save.' })
          }}
        >
          Save booking settings
        </button>
      </div>

      {draft && (
        <div className="card mb-6 space-y-4 border-2 border-accent-400/60 p-5">
          <h2 className="font-display font-bold text-brand-900">{draft.id ? 'Edit price' : 'New price'}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="label">From</span>
              <input className="input" value={draft.origin} onChange={up('origin')} />
            </label>
            <label className="block">
              <span className="label">To (city) *</span>
              <input className="input" value={draft.destination} onChange={up('destination')} placeholder="e.g. Lagos" />
            </label>
            <label className="block">
              <span className="label">Service</span>
              <select className="input" value={draft.service_type} onChange={up('service_type')}>
                {SERVICE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Delivery time shown</span>
              <input className="input" value={draft.eta} onChange={up('eta')} placeholder="e.g. 2–3 working days" />
            </label>
            <label className="block">
              <span className="label">Price (₦) *</span>
              <input className="input" type="number" min={0} step="0.01" value={draft.base_fee} onChange={up('base_fee')} />
            </label>
            <label className="block">
              <span className="label">Covers up to (kg)</span>
              <input className="input" type="number" min={0} step="0.1" value={draft.included_kg} onChange={up('included_kg')} />
            </label>
            <label className="block">
              <span className="label">Each extra kg (₦)</span>
              <input className="input" type="number" min={0} step="0.01" value={draft.extra_per_kg} onChange={up('extra_per_kg')} />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Show on booking page
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Example: ₦5,000 covering 2 kg plus ₦500 per extra kg → a 5 kg package costs ₦5,000 + 3 × ₦500 = ₦6,500.
          </p>
          <div className="flex gap-2">
            <button className="btn-accent" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save price'}
            </button>
            <button className="btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-end gap-2 border-b border-slate-100 px-5 py-3 text-sm">
          <span className="text-slate-500">Show price for a</span>
          <input className="input !w-20 !py-1" type="number" min={0} step="0.5" value={testKg} onChange={(e) => setTestKg(e.target.value)} />
          <span className="text-slate-500">kg package</span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-5 py-3">Route</th>
              <th className="px-5 py-3">Service</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Extra kg</th>
              <th className="px-5 py-3">{testKg || 0} kg costs</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.rates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                  No prices yet. Click “Add price”.
                </td>
              </tr>
            )}
            {data.rates.map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 ${r.active ? '' : 'opacity-50'}`}>
                <td className="px-5 py-3 font-medium">
                  {r.origin} → {r.destination}
                  {r.eta && <span className="block text-xs font-normal text-slate-500">{r.eta}</span>}
                </td>
                <td className="px-5 py-3">{serviceLabel(r.service_type)}</td>
                <td className="px-5 py-3">
                  {money(r.base_fee)} <span className="text-xs text-slate-500">up to {r.included_kg} kg</span>
                </td>
                <td className="px-5 py-3">{r.extra_per_kg ? money(r.extra_per_kg) : '—'}</td>
                <td className="px-5 py-3 font-semibold">{money(sample(r))}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button
                    className="mr-3 text-xs font-semibold text-brand-500 hover:underline"
                    onClick={() =>
                      setDraft({
                        id: r.id,
                        origin: r.origin,
                        destination: r.destination,
                        service_type: r.service_type,
                        base_fee: naira(r.base_fee),
                        included_kg: String(r.included_kg),
                        extra_per_kg: naira(r.extra_per_kg),
                        eta: r.eta ?? '',
                        active: !!r.active,
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs font-semibold text-rose-700 hover:underline"
                    onClick={async () => {
                      if (!window.confirm(`Delete the price for ${r.origin} → ${r.destination}?`)) return
                      await deleteRate({ data: { id: r.id } })
                      router.invalidate()
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
