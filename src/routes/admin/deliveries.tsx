import { useEffect, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { claimJob, completeDelivery, getMyJobs, reportFailedAttempt, riderSetStatus, type RiderJob } from '~/fns/rider'
import { Alert, StatusBadge } from '~/components/ui'
import { money } from '~/lib/format'

export const Route = createFileRoute('/admin/deliveries')({
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('shipments')) throw redirect({ to: '/admin' })
  },
  loader: () => getMyJobs(),
  head: () => ({ meta: [{ title: 'My deliveries — Ronia Logistics' }] }),
  component: DeliveriesPage,
})

const waLink = (phone: string) => {
  let d = phone.replace(/[^0-9]/g, '')
  if (d.startsWith('0')) d = '234' + d.slice(1)
  return `https://wa.me/${d}`
}
const mapLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
const due = (j: RiderJob) => (j.payment_status !== 'paid' ? j.shipping_fee : 0) + j.cod_amount

function DeliveriesPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [delivering, setDelivering] = useState<RiderJob | null>(null)

  useEffect(() => {
    const t = setInterval(() => router.invalidate(), 60000)
    return () => clearInterval(t)
  }, [router])

  const act = async (id: number, fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setBusy(id)
    const res = await fn().catch((e) => ({ ok: false, error: String(e?.message ?? e) }))
    setBusy(null)
    setMsg(res.ok ? { tone: 'success', text: ok } : { tone: 'error', text: res.error ?? 'Something went wrong.' })
    if (res.ok) router.invalidate()
  }

  const toCollect = data.open.reduce((sum, j) => sum + due(j), 0)

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-brand-900">My deliveries</h1>
        <p className="text-sm text-slate-500">
          {data.open.length} to do · {data.done.length} delivered today{toCollect > 0 ? ` · ${money(toCollect)} to collect` : ''}
        </p>
      </div>

      <form
        className="card mb-4 flex gap-2 p-3"
        onSubmit={async (e: FormEvent) => {
          e.preventDefault()
          if (!code.trim()) return
          await act(0, () => claimJob({ data: { code } }), `${code.toUpperCase()} added to your list.`)
          setCode('')
        }}
      >
        <input
          className="input font-mono uppercase"
          placeholder="Tracking number on the label"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
        />
        <button className="btn btn-primary shrink-0" disabled={busy === 0}>
          Add
        </button>
      </form>

      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      {data.open.length === 0 && (
        <div className="card p-8 text-center text-slate-500">
          <p className="text-4xl">🛵</p>
          <p className="mt-2">No deliveries assigned to you right now.</p>
          <p className="text-sm">Type a tracking number above to add a package you are carrying.</p>
        </div>
      )}

      <div className="space-y-4">
        {data.open.map((j) => {
          const isPickup = j.pickup_requested === 1 && j.status === 'pending'
          const who = isPickup
            ? { label: 'Pick up from', name: j.sender_name, phone: j.sender_phone, address: j.sender_address || '' }
            : { label: 'Deliver to', name: j.receiver_name, phone: j.receiver_phone, address: `${j.receiver_address}, ${j.destination_city}` }
          return (
            <div key={j.id} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <span className="font-mono font-bold tracking-wide text-brand-900">{j.tracking_code}</span>
                <StatusBadge status={j.status} />
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{who.label}</p>
                  <p className="text-lg font-semibold text-slate-900">{who.name}</p>
                  {who.address && <p className="text-sm text-slate-600">{who.address}</p>}
                  {j.description && (
                    <p className="mt-1 text-xs text-slate-500">
                      📦 {j.quantity} × {j.description}
                    </p>
                  )}
                  {j.last_note?.startsWith('Delivery attempt failed') && <p className="mt-1 text-xs font-medium text-rose-700">⚠ {j.last_note}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
                  <a href={`tel:${who.phone}`} className="rounded-xl bg-slate-100 py-2.5 text-center hover:bg-slate-200">
                    📞 Call
                  </a>
                  <a href={waLink(who.phone)} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-50 py-2.5 text-center text-emerald-800 hover:bg-emerald-100">
                    WhatsApp
                  </a>
                  <a
                    href={mapLink(who.address || j.destination_city)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-sky-50 py-2.5 text-center text-sky-800 hover:bg-sky-100"
                  >
                    🗺 Map
                  </a>
                </div>

                {due(j) > 0 && !isPickup && (
                  <div className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">
                    Collect <b>{money(due(j))}</b>
                    {j.payment_status !== 'paid' && j.shipping_fee > 0 && j.cod_amount > 0 && (
                      <span className="text-xs">
                        {' '}
                        ({money(j.shipping_fee)} delivery + {money(j.cod_amount)} goods)
                      </span>
                    )}
                  </div>
                )}

                {isPickup ? (
                  <button
                    className="btn btn-accent w-full !py-3 text-base"
                    disabled={busy === j.id}
                    onClick={() => act(j.id, () => riderSetStatus({ data: { id: j.id, status: 'received' } }), 'Marked as picked up.')}
                  >
                    ✅ Picked up
                  </button>
                ) : (
                  <div className="grid gap-2">
                    {j.status !== 'out_for_delivery' && (
                      <button
                        className="btn btn-ghost w-full"
                        disabled={busy === j.id}
                        onClick={() => act(j.id, () => riderSetStatus({ data: { id: j.id, status: 'out_for_delivery' } }), 'Customer told you are on the way.')}
                      >
                        🛵 On my way
                      </button>
                    )}
                    <button className="btn btn-accent w-full !py-3 text-base" onClick={() => setDelivering(j)}>
                      ✅ Delivered
                    </button>
                    <button
                      className="text-sm font-medium text-rose-700 hover:underline"
                      disabled={busy === j.id}
                      onClick={() => {
                        const reason = window.prompt('Why could it not be delivered?', 'Receiver not answering calls')
                        if (reason !== null) act(j.id, () => reportFailedAttempt({ data: { id: j.id, reason } }), 'Failed attempt recorded.')
                      }}
                    >
                      Couldn't deliver
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {data.done.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 font-display font-bold text-brand-900">Delivered today</h2>
          <div className="card divide-y divide-slate-100">
            {data.done.map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-mono font-semibold">{j.tracking_code}</p>
                  <p className="text-xs text-slate-500">
                    {j.receiver_name}
                    {j.signed_by ? ` · signed by ${j.signed_by}` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {j.delivered_at ? new Date(j.delivered_at).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {delivering && (
        <DeliverSheet
          job={delivering}
          onClose={() => setDelivering(null)}
          onDone={() => {
            setDelivering(null)
            setMsg({ tone: 'success', text: 'Delivered! The customer has been notified.' })
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

/** Shrink a phone photo to max 1600px JPEG so it uploads quickly on mobile data. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.8))
  } catch {
    return file
  }
}

function DeliverSheet({ job, onClose, onDone }: { job: RiderJob; onClose: () => void; onDone: () => void }) {
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [receivedBy, setReceivedBy] = useState(job.receiver_name)
  const [payment, setPayment] = useState(job.payment_status === 'paid' || job.shipping_fee === 0 ? 'none' : 'cash')
  const [cod, setCod] = useState(job.cod_amount > 0)
  const [note, setNote] = useState('')
  const [signed, setSigned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = c.offsetHeight * ratio
    const ctx = c.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0b2545'
  }, [])

  const point = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const clearSig = () => {
    const c = canvas.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setSigned(false)
  }

  async function submit() {
    if (!photo) return setError('Take a photo of the package at the door first.')
    if (!receivedBy.trim()) return setError('Enter who received it.')
    setBusy(true)
    setError('')
    const fd = new FormData()
    fd.set('id', String(job.id))
    fd.set('received_by', receivedBy)
    fd.set('payment', payment)
    fd.set('cod_collected', cod ? '1' : '0')
    fd.set('note', note)
    fd.set('photo', new File([photo], 'photo.jpg', { type: photo.type || 'image/jpeg' }))
    if (signed && canvas.current) {
      const sig = await new Promise<Blob | null>((res) => canvas.current!.toBlob(res, 'image/png'))
      if (sig) fd.set('signature', new File([sig], 'signature.png', { type: 'image/png' }))
    }
    const res = await completeDelivery({ data: fd }).catch((e) => ({ ok: false as const, error: String(e?.message ?? e) }))
    setBusy(false)
    if (!res.ok) return setError(res.error)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-brand-900">Confirm delivery</p>
            <p className="font-mono text-xs text-slate-500">{job.tracking_code}</p>
          </div>
          <button className="rounded px-2 text-2xl text-slate-400" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="label">1. Photo of the package delivered *</p>
            <label className="grid min-h-36 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
              {preview ? <img src={preview} alt="" className="max-h-64 w-full object-contain" /> : <span className="p-6">📷 Tap to take a photo</span>}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const small = await compress(f)
                  setPhoto(small)
                  setPreview(URL.createObjectURL(small))
                }}
              />
            </label>
            <p className="mt-1 text-xs text-slate-400">Photograph the package at the door — not people's faces.</p>
          </div>

          <label className="block">
            <span className="label">2. Received by *</span>
            <input className="input" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="label">3. Signature (receiver signs with finger)</span>
              {signed && (
                <button type="button" className="text-xs font-semibold text-slate-500" onClick={clearSig}>
                  Clear
                </button>
              )}
            </div>
            <canvas
              ref={canvas}
              className="h-36 w-full touch-none rounded-xl border border-slate-300 bg-white"
              onPointerDown={(e) => {
                drawing.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                const ctx = e.currentTarget.getContext('2d')!
                const p = point(e)
                ctx.beginPath()
                ctx.moveTo(p.x, p.y)
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return
                const ctx = e.currentTarget.getContext('2d')!
                const p = point(e)
                ctx.lineTo(p.x, p.y)
                ctx.stroke()
                setSigned(true)
              }}
              onPointerUp={() => (drawing.current = false)}
              onPointerLeave={() => (drawing.current = false)}
            />
          </div>

          {job.payment_status !== 'paid' && job.shipping_fee > 0 && (
            <label className="block">
              <span className="label">Delivery fee {money(job.shipping_fee)} — collected?</span>
              <select className="input" value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option value="cash">Yes — cash</option>
                <option value="transfer">Yes — transfer</option>
                <option value="pos">Yes — POS</option>
                <option value="none">No, not collected</option>
              </select>
            </label>
          )}
          {job.cod_amount > 0 && (
            <label className="flex items-center gap-3 rounded-xl bg-orange-50 p-3 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={cod} onChange={(e) => setCod(e.target.checked)} />I collected {money(job.cod_amount)} for the goods
            </label>
          )}

          <label className="block">
            <span className="label">Note (optional)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Left with security at the gate" />
          </label>

          {error && <Alert>{error}</Alert>}
          <button className="btn btn-accent w-full !py-3 text-base" disabled={busy} onClick={submit}>
            {busy ? 'Uploading…' : '✅ Confirm delivered'}
          </button>
        </div>
      </div>
    </div>
  )
}
