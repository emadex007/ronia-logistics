import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { chatPoll, chatSend, chatStart, type ChatMessage } from '~/fns/messages'
import type { Settings } from '~/lib/types'

const KEY = 'ronia_chat_token'
const store = {
  get: () => {
    try {
      return localStorage.getItem(KEY) || ''
    } catch {
      return ''
    }
  },
  set: (v: string) => {
    try {
      if (v) localStorage.setItem(KEY, v)
      else localStorage.removeItem(KEY)
    } catch {
      /* private mode: keep the chat in memory only */
    }
  },
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })

export function ChatWidget({ settings, raised }: { settings: Settings; raised: boolean }) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [unseen, setUnseen] = useState(0)
  const [text, setText] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', body: '', website: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lastCount = useRef(-1) // staff replies already seen; -1 = not loaded yet
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => setToken(store.get()), [])

  async function refresh(t = token) {
    if (!t) return
    const res = await chatPoll({ data: { token: t } }).catch(() => undefined)
    if (res === null) {
      // conversation no longer exists
      store.set('')
      setToken('')
      setMessages([])
      return
    }
    if (!res) return
    setMessages(res.messages)
    const staffCount = res.messages.filter((m) => m.sender === 'staff').length
    if (open || lastCount.current < 0) lastCount.current = staffCount
    else setUnseen(Math.max(0, staffCount - lastCount.current))
  }

  // Poll every 5s while open, every 30s in the background (so the bubble can show a reply badge)
  useEffect(() => {
    if (!token) return
    refresh()
    const id = setInterval(refresh, open ? 5000 : 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, open])

  useEffect(() => {
    if (open) {
      setUnseen(0)
      if (token) lastCount.current = messages.filter((m) => m.sender === 'staff').length
    }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [open, messages])

  async function start(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await chatStart({ data: { ...form, page: location.pathname } }).catch(() => ({ ok: false as const, error: 'Network error — please try again.' }))
    setBusy(false)
    if (!res.ok) return setError(res.error)
    store.set(res.token)
    setToken(res.token)
    setForm({ name: '', phone: '', email: '', body: '', website: '' })
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy(true)
    setError('')
    const res = await chatSend({ data: { token, body } }).catch(() => ({ ok: false as const, error: 'Network error — please try again.' }))
    setBusy(false)
    if (!res.ok) {
      if (res.error === 'expired') {
        store.set('')
        setToken('')
        return
      }
      return setError(res.error)
    }
    setText('')
    refresh()
  }

  const title = settings.chat_title || 'Chat with us'
  const greeting = settings.chat_greeting || 'Hello! How can we help you today?'
  const bottom = raised ? 'bottom-24' : 'bottom-5'

  return (
    <>
      {open && (
        <div className={`no-print fixed right-3 left-3 z-50 flex max-h-[min(560px,calc(100vh-7rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 sm:left-auto sm:w-[370px] ${raised ? 'bottom-[10.5rem]' : 'bottom-24'}`}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" style={{ background: 'var(--color-brand-900, #0b2545)' }}>
            <div>
              <p className="font-display font-bold">{title}</p>
              <p className="text-xs opacity-80">We usually reply within a few minutes during office hours</p>
            </div>
            <button aria-label="Close chat" className="rounded-lg px-2 py-1 text-xl leading-none hover:bg-white/15" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4 text-sm">
            <Bubble mine={false} who={settings.company_name || 'Ronia Logistics'}>
              {greeting}
            </Bubble>
            {messages.map((m) => (
              <Bubble key={m.id} mine={m.sender === 'visitor'} who={m.sender === 'staff' ? m.staff_name || 'Support' : undefined} at={m.created_at}>
                {m.body}
              </Bubble>
            ))}
            {token && messages.length > 0 && messages[messages.length - 1].sender === 'visitor' && (
              <p className="pt-1 text-center text-xs text-slate-400">Message sent — a staff member will reply here.</p>
            )}
          </div>

          {error && <p className="bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}

          {token ? (
            <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
              <input className="input flex-1" placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
              <button className="btn btn-accent px-4" disabled={busy || !text.trim()}>
                Send
              </button>
            </form>
          ) : (
            <form onSubmit={start} className="space-y-2 border-t border-slate-200 p-3">
              <input
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                aria-hidden
              />
              <input className="input" placeholder="Your name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <textarea
                className="input"
                rows={2}
                placeholder="How can we help? *"
                required
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <button className="btn btn-accent w-full" disabled={busy}>
                {busy ? 'Starting…' : 'Start chat'}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        className={`no-print fixed right-5 ${bottom} z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg transition hover:scale-105`}
        style={{ background: 'var(--btn-a-bg, #f97316)', color: 'var(--btn-a-text, #fff)' }}
      >
        {open ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
            <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth={3} />
          </svg>
        )}
        {unseen > 0 && !open && (
          <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold">{unseen}</span>
        )}
      </button>
    </>
  )
}

function Bubble({ mine, who, at, children }: { mine: boolean; who?: string; at?: string; children: ReactNode }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap ${mine ? 'rounded-br-sm bg-brand-900 text-white' : 'rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200'}`}>
        {who && !mine && <p className="mb-0.5 text-[11px] font-semibold text-accent-500">{who}</p>}
        {children}
        {at && <p className={`mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-slate-400'}`}>{time(at)}</p>}
      </div>
    </div>
  )
}
