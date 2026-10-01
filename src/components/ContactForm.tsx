import { useState } from 'react'
import { sendContactForm } from '~/fns/messages'

const EMPTY = { name: '', phone: '', email: '', subject: '', message: '', website: '' }

export function ContactForm({ title }: { title?: string }) {
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const up = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  if (done)
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl">✅</p>
        <p className="mt-3 font-display text-xl font-bold text-brand-900">Message sent — thank you!</p>
        <p className="mt-1 text-sm text-slate-500">Our team will get back to you by phone or email shortly.</p>
        <button className="btn btn-ghost mt-5" onClick={() => (setF(EMPTY), setDone(false))}>
          Send another message
        </button>
      </div>
    )

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        const res = await sendContactForm({ data: { ...f, page: location.pathname } }).catch(() => ({
          ok: false as const,
          error: 'Network error — please try again.',
        }))
        setBusy(false)
        if (!res.ok) return setError(res.error)
        setDone(true)
      }}
    >
      <p className="font-display text-xl font-bold text-brand-900">{title || 'Send us a message'}</p>
      <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={up('website')} aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Your name *</span>
          <input className="input" required value={f.name} onChange={up('name')} maxLength={120} />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input className="input" type="tel" value={f.phone} onChange={up('phone')} maxLength={40} />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" value={f.email} onChange={up('email')} maxLength={160} />
        </label>
        <label className="block">
          <span className="label">Subject</span>
          <input className="input" value={f.subject} onChange={up('subject')} maxLength={160} placeholder="e.g. Delivery to Lagos" />
        </label>
      </div>
      <label className="block">
        <span className="label">Message *</span>
        <textarea className="input" rows={5} required value={f.message} onChange={up('message')} maxLength={4000} />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn btn-accent w-full sm:w-auto" disabled={busy}>
        {busy ? 'Sending…' : 'Send message'}
      </button>
      <p className="text-xs text-slate-500">Add a phone number or email so we can reply.</p>
    </form>
  )
}
