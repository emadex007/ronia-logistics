import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getConversation, listConversations, replyConversation, setConversationStatus, type ChatMessage, type Conversation } from '~/fns/messages'
import { Alert, PageHeader } from '~/components/ui'
import { dateTime } from '~/lib/format'

type Search = { status?: 'open' | 'closed' | 'all'; id?: number }

export const Route = createFileRoute('/admin/inbox')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    status: s.status === 'closed' || s.status === 'all' ? s.status : undefined,
    id: s.id ? Number(s.id) : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('inbox')) throw redirect({ to: '/admin' })
  },
  head: () => ({ meta: [{ title: 'Messages — Ronia Logistics' }] }),
  component: InboxPage,
})

const waLink = (phone: string) => {
  let d = phone.replace(/[^0-9]/g, '')
  if (d.startsWith('0')) d = '234' + d.slice(1)
  return `https://wa.me/${d}`
}

function InboxPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const status = search.status ?? 'open'
  const [q, setQ] = useState('')
  const [list, setList] = useState<Conversation[] | null>(null)
  const [thread, setThread] = useState<{ conv: Conversation; messages: ChatMessage[] } | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  async function loadList() {
    setList(await listConversations({ data: { status, q } }))
  }
  async function loadThread(id = search.id) {
    if (!id) return setThread(null)
    const t = await getConversation({ data: { id } })
    setThread(t)
    window.dispatchEvent(new Event('ronia:inbox-read'))
  }

  useEffect(() => {
    loadList()
    const t = setInterval(loadList, 15000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q])

  useEffect(() => {
    setReply('')
    setError('')
    loadThread()
    if (!search.id) return
    const t = setInterval(() => loadThread(), 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.id])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [thread?.messages.length])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!thread || !reply.trim()) return
    setBusy(true)
    const res = await replyConversation({ data: { id: thread.conv.id, body: reply } })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setReply('')
    await Promise.all([loadThread(thread.conv.id), loadList()])
  }

  async function toggle() {
    if (!thread) return
    const next = thread.conv.status === 'open' ? 'closed' : 'open'
    await setConversationStatus({ data: { id: thread.conv.id, status: next } })
    await Promise.all([loadThread(thread.conv.id), loadList()])
  }

  const c = thread?.conv

  return (
    <>
      <PageHeader title="Messages" subtitle="Live chats and contact-form messages from the website." />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* List */}
        <div className={`card flex flex-col overflow-hidden ${search.id ? 'hidden lg:flex' : ''}`}>
          <div className="space-y-2 border-b border-slate-100 p-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              {(['open', 'closed', 'all'] as const).map((s) => (
                <button
                  key={s}
                  className={`flex-1 rounded-md px-2 py-1 font-medium capitalize ${status === s ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                  onClick={() => navigate({ search: { status: s === 'open' ? undefined : s } })}
                >
                  {s}
                </button>
              ))}
            </div>
            <input className="input" placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-[70vh] flex-1 overflow-y-auto">
            {list === null && <p className="p-4 text-sm text-slate-500">Loading…</p>}
            {list?.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No {status === 'all' ? '' : status} messages.</p>}
            {list?.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate({ search: { status: search.status, id: m.id } })}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${search.id === m.id ? 'bg-sky-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{m.source === 'chat' ? '💬' : '✉️'}</span>
                  <span className={`truncate ${m.unread_admin ? 'font-bold text-brand-900' : 'font-medium text-slate-700'}`}>{m.name}</span>
                  {m.unread_admin > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{m.unread_admin}</span>
                  )}
                </div>
                {m.subject && <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">{m.subject}</p>}
                <p className="mt-0.5 truncate text-xs text-slate-500">{m.last_body}</p>
                <p className="mt-1 text-[11px] text-slate-400">{dateTime(m.last_message_at)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className={`card flex min-h-[60vh] flex-col overflow-hidden ${search.id ? '' : 'hidden lg:flex'}`}>
          {!c ? (
            <div className="grid flex-1 place-items-center p-10 text-center text-sm text-slate-500">
              {search.id ? 'Loading…' : 'Choose a message on the left to read and reply.'}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
                <div>
                  <button className="mb-1 text-xs font-semibold text-sky-700 lg:hidden" onClick={() => navigate({ search: { status: search.status } })}>
                    ← All messages
                  </button>
                  <p className="font-display text-lg font-bold text-brand-900">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.source === 'chat' ? 'Website chat' : 'Contact form'} · started {dateTime(c.created_at)}
                    {c.page_url ? ` · from ${c.page_url}` : ''}
                  </p>
                  {c.subject && <p className="mt-1 text-sm font-semibold text-slate-700">Subject: {c.subject}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {c.phone && (
                      <>
                        <a href={`tel:${c.phone}`} className="rounded-full bg-slate-100 px-3 py-1 font-medium hover:bg-slate-200">
                          📞 {c.phone}
                        </a>
                        <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 hover:bg-emerald-100">
                          WhatsApp
                        </a>
                      </>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}?subject=${encodeURIComponent('Re: ' + (c.subject || 'Your message to Ronia Logistics'))}`}
                        className="rounded-full bg-slate-100 px-3 py-1 font-medium hover:bg-slate-200"
                      >
                        ✉️ {c.email}
                      </a>
                    )}
                  </div>
                </div>
                <button className="btn btn-ghost text-sm" onClick={toggle}>
                  {c.status === 'open' ? '✓ Mark as done' : '↺ Reopen'}
                </button>
              </div>

              <div ref={scroller} className="max-h-[55vh] flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 text-sm">
                {thread!.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === 'staff' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 whitespace-pre-wrap ${
                        m.sender === 'staff' ? 'rounded-br-sm bg-brand-900 text-white' : 'rounded-bl-sm bg-white ring-1 ring-slate-200'
                      }`}
                    >
                      {m.body}
                      <p className={`mt-1 text-[10px] ${m.sender === 'staff' ? 'text-white/60' : 'text-slate-400'}`}>
                        {m.sender === 'staff' ? `${m.staff_name ?? 'Staff'} · ` : ''}
                        {dateTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="px-4 pt-3">
                  <Alert>{error}</Alert>
                </div>
              )}
              {c.source === 'chat' ? (
                <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
                  <textarea
                    className="input flex-1"
                    rows={2}
                    placeholder="Type your reply — the customer sees it in the chat window…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        e.currentTarget.form?.requestSubmit()
                      }
                    }}
                  />
                  <button className="btn btn-accent self-end" disabled={busy || !reply.trim()}>
                    Send
                  </button>
                </form>
              ) : (
                <div className="border-t border-slate-100 p-4 text-xs text-slate-500">
                  This came from the contact form, so reply by phone, WhatsApp or email using the buttons above. Click <b>Mark as done</b> when it's handled.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
