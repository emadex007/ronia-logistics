// Website live chat + contact form, and the admin Messages inbox.
import { createServerFn } from '@tanstack/react-start'
import { all, first, run, nowIso, audit } from '~/server/db'
import { requirePerm } from '~/server/auth'

export type Conversation = {
  id: number
  source: 'chat' | 'form'
  name: string
  phone: string | null
  email: string | null
  subject: string | null
  status: 'open' | 'closed'
  unread_admin: number
  page_url: string | null
  last_message_at: string
  created_at: string
  last_body?: string | null
}
export type ChatMessage = { id: number; sender: 'visitor' | 'staff'; body: string; created_at: string; staff_name?: string | null }

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

function newToken() {
  const b = new Uint8Array(24)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

async function addVisitorMessage(convId: number, body: string) {
  const now = nowIso()
  await run('INSERT INTO conversation_messages (conversation_id, sender, body, created_at) VALUES (?, ?, ?, ?)', convId, 'visitor', body, now)
  await run(
    "UPDATE conversations SET unread_admin = unread_admin + 1, last_message_at = ?, status = 'open' WHERE id = ?",
    now,
    convId,
  )
}

/* ---------------- Public (website visitors) ---------------- */

type ContactInput = { name: string; phone?: string; email?: string; subject?: string; message: string; page?: string; website?: string }

export const sendContactForm = createServerFn({ method: 'POST' })
  .validator((d: ContactInput) => d)
  .handler(async ({ data }) => {
    if (data.website) return { ok: true as const } // honeypot: bots fill hidden fields
    const name = clip(data.name, 120)
    const phone = clip(data.phone, 40)
    const email = clip(data.email, 160)
    const message = clip(data.message, 4000)
    if (!name || !message) return { ok: false as const, error: 'Please enter your name and message.' }
    if (!phone && !email) return { ok: false as const, error: 'Please add a phone number or email so we can reply.' }
    const res = await run(
      'INSERT INTO conversations (source, name, phone, email, subject, page_url) VALUES (?, ?, ?, ?, ?, ?)',
      'form',
      name,
      phone || null,
      email || null,
      clip(data.subject, 160) || null,
      clip(data.page, 300) || null,
    )
    await addVisitorMessage(Number(res.meta.last_row_id), message)
    return { ok: true as const }
  })

export const chatStart = createServerFn({ method: 'POST' })
  .validator((d: { name: string; phone?: string; email?: string; body: string; page?: string; website?: string }) => d)
  .handler(async ({ data }) => {
    if (data.website) return { ok: false as const, error: 'Could not start chat.' }
    const name = clip(data.name, 120)
    const body = clip(data.body, 2000)
    const phone = clip(data.phone, 40)
    if (!name || !body) return { ok: false as const, error: 'Please enter your name and a message.' }
    if (!phone && !clip(data.email, 160)) return { ok: false as const, error: 'Please add a phone number or email so we can reach you.' }
    const token = newToken()
    const res = await run(
      'INSERT INTO conversations (source, visitor_token, name, phone, email, page_url) VALUES (?, ?, ?, ?, ?, ?)',
      'chat',
      token,
      name,
      phone || null,
      clip(data.email, 160) || null,
      clip(data.page, 300) || null,
    )
    await addVisitorMessage(Number(res.meta.last_row_id), body)
    return { ok: true as const, token }
  })

async function convByToken(token: string) {
  if (!token || token.length < 20) return null
  return first<{ id: number; name: string; status: string }>('SELECT id, name, status FROM conversations WHERE visitor_token = ?', token)
}

export const chatSend = createServerFn({ method: 'POST' })
  .validator((d: { token: string; body: string }) => d)
  .handler(async ({ data }) => {
    const conv = await convByToken(data.token)
    if (!conv) return { ok: false as const, error: 'expired' }
    const body = clip(data.body, 2000)
    if (!body) return { ok: false as const, error: 'Type a message first.' }
    // Simple flood guard: max 20 visitor messages in the last 10 minutes
    const recent = await first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM conversation_messages WHERE conversation_id = ? AND sender = 'visitor' AND created_at > ?",
      conv.id,
      new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    )
    if ((recent?.n ?? 0) >= 20) return { ok: false as const, error: 'Please wait a moment before sending more messages.' }
    await addVisitorMessage(conv.id, body)
    return { ok: true as const }
  })

export const chatPoll = createServerFn({ method: 'GET' })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const conv = await convByToken(data.token)
    if (!conv) return null
    const messages = await all<ChatMessage>(
      `SELECT m.id, m.sender, m.body, m.created_at, CASE WHEN m.sender = 'staff' THEN u.full_name END AS staff_name
         FROM conversation_messages m LEFT JOIN users u ON u.id = m.staff_id
        WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT 100`,
      conv.id,
    )
    await run('UPDATE conversations SET unread_visitor = 0 WHERE id = ?', conv.id)
    // Only show staff first names to visitors
    return {
      name: conv.name,
      messages: messages.reverse().map((m) => ({ ...m, staff_name: m.staff_name ? m.staff_name.split(' ')[0] : null })),
    }
  })

/* ---------------- Admin inbox ---------------- */

export const unreadMessageCount = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePerm('inbox')
  const r = await first<{ n: number; c: number }>(
    "SELECT COALESCE(SUM(unread_admin),0) AS n, COUNT(*) AS c FROM conversations WHERE unread_admin > 0",
  )
  return { messages: r?.n ?? 0, conversations: r?.c ?? 0 }
})

export const listConversations = createServerFn({ method: 'GET' })
  .validator((d: { status?: 'open' | 'closed' | 'all'; q?: string }) => d)
  .handler(async ({ data }) => {
    await requirePerm('inbox')
    const where: string[] = []
    const params: unknown[] = []
    if (data.status && data.status !== 'all') {
      where.push('c.status = ?')
      params.push(data.status)
    }
    if (data.q?.trim()) {
      const q = `%${data.q.trim()}%`
      where.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.subject LIKE ?)')
      params.push(q, q, q, q)
    }
    return all<Conversation>(
      `SELECT c.id, c.source, c.name, c.phone, c.email, c.subject, c.status, c.unread_admin, c.page_url, c.last_message_at, c.created_at,
              (SELECT body FROM conversation_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body
         FROM conversations c ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY c.last_message_at DESC LIMIT 200`,
      ...params,
    )
  })

export const getConversation = createServerFn({ method: 'GET' })
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    await requirePerm('inbox')
    const conv = await first<Conversation>(
      'SELECT id, source, name, phone, email, subject, status, unread_admin, page_url, last_message_at, created_at FROM conversations WHERE id = ?',
      Number(data.id),
    )
    if (!conv) return null
    const messages = await all<ChatMessage>(
      `SELECT m.id, m.sender, m.body, m.created_at, u.full_name AS staff_name
         FROM conversation_messages m LEFT JOIN users u ON u.id = m.staff_id
        WHERE m.conversation_id = ? ORDER BY m.id`,
      conv.id,
    )
    if (conv.unread_admin) await run('UPDATE conversations SET unread_admin = 0 WHERE id = ?', conv.id)
    return { conv, messages }
  })

export const replyConversation = createServerFn({ method: 'POST' })
  .validator((d: { id: number; body: string }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('inbox')
    const body = clip(data.body, 4000)
    if (!body) return { ok: false as const, error: 'Type a reply first.' }
    const conv = await first<{ id: number }>('SELECT id FROM conversations WHERE id = ?', Number(data.id))
    if (!conv) return { ok: false as const, error: 'Conversation not found.' }
    const now = nowIso()
    await run(
      'INSERT INTO conversation_messages (conversation_id, sender, staff_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
      conv.id,
      'staff',
      me.id,
      body,
      now,
    )
    await run(
      'UPDATE conversations SET unread_visitor = unread_visitor + 1, unread_admin = 0, last_message_at = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?',
      now,
      me.id,
      conv.id,
    )
    return { ok: true as const }
  })

export const setConversationStatus = createServerFn({ method: 'POST' })
  .validator((d: { id: number; status: 'open' | 'closed' }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('inbox')
    const status = data.status === 'closed' ? 'closed' : 'open'
    await run('UPDATE conversations SET status = ?, unread_admin = 0 WHERE id = ?', status, Number(data.id))
    await audit(me.id, `inbox.${status}`, 'conversation', Number(data.id))
    return { ok: true as const }
  })
