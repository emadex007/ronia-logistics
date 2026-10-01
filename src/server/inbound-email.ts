// Receives emails sent to info@ronialogistics.com (Cloudflare Email Routing → "Send to a Worker")
// and files them in Admin → Messages. Replies from the admin go out through Resend.
import PostalMime from 'postal-mime'

const MAX_ATTACH = 10 * 1024 * 1024
const MAX_FILES = 6

type Env = Cloudflare.Env

function hex(n = 8) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')
}

function htmlToText(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** Drop the quoted older conversation that email apps add under a reply. */
function stripQuoted(text: string) {
  const markers = [
    /\n[^\n]*On [^\n]{0,200}(\n[^\n]{0,200})?wrote:\s*\n/i, // Gmail / Apple Mail
    /\n-{2,}\s*Original Message\s*-{2,}/i, // Outlook
    /\nFrom:\s.+\n(Sent|Date):\s/i, // Outlook (no marker)
    /\n_{10,}\n/, // Outlook web divider
  ]
  let cut = text.length
  for (const m of markers) {
    const i = text.search(m)
    if (i > 0 && i < cut) cut = i
  }
  const top = text.slice(0, cut)
  // Remove leftover "> quoted" lines at the end
  const cleaned = top.replace(/(\n>.*)+\s*$/g, '').trim()
  return cleaned || text.trim()
}

/** Keep a copy in a normal mailbox (Gmail etc.) if set — it must be a verified destination address in Email Routing. */
export async function forwardCopy(message: ForwardableEmailMessage, env: Env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'forward_email_to'").first<{ value: string }>()
  const to = row?.value?.trim()
  if (!to) return
  try {
    await message.forward(to)
  } catch (e) {
    console.warn('Forward failed', e)
  }
}

export async function handleIncomingEmail(message: ForwardableEmailMessage, env: Env) {
  const settings = Object.fromEntries(
    (
      await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('site_url','email','email_from')").all<{ key: string; value: string }>()
    ).results.map((r) => [r.key, r.value]),
  ) as Record<string, string>

  // 2) Parse
  const raw = await new Response(message.raw).arrayBuffer()
  const mail = await PostalMime.parse(raw)
  const fromAddr = (mail.from?.address || message.from || '').trim().toLowerCase()
  const fromName = (mail.from?.name || fromAddr.split('@')[0] || 'Unknown').trim().slice(0, 120)
  if (!fromAddr) return

  // Ignore bounces, auto-replies and anything sent from our own domain (stops email loops)
  const ownDomain = (() => {
    try {
      return new URL(settings.site_url || 'https://ronialogistics.com').hostname.replace(/^www\./, '')
    } catch {
      return 'ronialogistics.com'
    }
  })()
  const auto = (message.headers.get('auto-submitted') || 'no').toLowerCase() !== 'no' || /^(mailer-daemon|postmaster|no-?reply)@/i.test(fromAddr)
  if (auto || fromAddr.endsWith('@' + ownDomain) || fromAddr.endsWith('.resend.dev') || fromAddr === 'onboarding@resend.dev') return

  const subject = (mail.subject || '(no subject)').trim().slice(0, 200)
  let body = mail.text?.trim() || (mail.html ? htmlToText(mail.html) : '')
  body = stripQuoted(body.replace(/\r\n/g, '\n')).slice(0, 20000) || '(empty message)'
  const now = new Date().toISOString()

  // 3) Same person writing again within 90 days → same conversation; otherwise start a new one
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const existing = await env.DB.prepare(
    "SELECT id FROM conversations WHERE lower(email) = ? AND source != 'chat' AND last_message_at > ? ORDER BY last_message_at DESC LIMIT 1",
  )
    .bind(fromAddr, since)
    .first<{ id: number }>()

  let convId: number
  if (existing) {
    convId = existing.id
  } else {
    const res = await env.DB.prepare('INSERT INTO conversations (source, name, email, subject, page_url) VALUES (?, ?, ?, ?, ?)')
      .bind('email', fromName, fromAddr, subject.replace(/^((re|fwd?|aw):\s*)+/i, ''), `email to ${message.to}`)
      .run()
    convId = Number(res.meta.last_row_id)
  }

  // 4) Attachments → R2
  const files: { name: string; key: string; size: number; type: string }[] = []
  for (const a of (mail.attachments ?? []).slice(0, MAX_FILES)) {
    const content = a.content as ArrayBuffer | string
    const size = typeof content === 'string' ? content.length : content.byteLength
    if (!size || size > MAX_ATTACH || a.disposition === 'inline') continue
    const name = (a.filename || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 80)
    const key = `mail/${hex()}/${name}`
    await env.MEDIA.put(key, content, { httpMetadata: { contentType: a.mimeType || 'application/octet-stream', contentDisposition: `attachment; filename="${name}"` } })
    files.push({ name, key, size, type: a.mimeType || '' })
  }

  const text = existing && !/^((re|fwd?|aw):\s*)+/i.test(subject) && subject !== '(no subject)' ? `Subject: ${subject}\n\n${body}` : body
  await env.DB.batch([
    env.DB.prepare('INSERT INTO conversation_messages (conversation_id, sender, body, attachments, created_at) VALUES (?, ?, ?, ?, ?)').bind(
      convId,
      'visitor',
      text,
      files.length ? JSON.stringify(files) : null,
      now,
    ),
    env.DB.prepare(
      "UPDATE conversations SET unread_admin = unread_admin + 1, last_message_at = ?, status = 'open', email_message_id = COALESCE(?, email_message_id), name = CASE WHEN source = 'email' THEN ? ELSE name END WHERE id = ?",
    ).bind(now, mail.messageId || null, fromName, convId),
  ])
}
