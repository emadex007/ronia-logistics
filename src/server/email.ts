// Sends emails through Resend (https://resend.com). Never throws: a failed email must not break the action that triggered it.
// Needs the secret: `npx wrangler secret put RESEND_API_KEY` (live) and RESEND_API_KEY=... in .dev.vars (local).
import { env } from 'cloudflare:workers'
import { all, run } from './db'

type S = Record<string, string>

export async function emailSettings(): Promise<S> {
  const rows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN ('company_name','primary_color','accent_color','logo_key','phone','whatsapp','email','address',
      'site_url','email_from','notify_email','email_office_on','email_customers_on','email_merchants_on')`,
  )
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export const siteUrl = (s: S) => (s.site_url || 'https://ronialogistics.com').replace(/\/+$/, '')
export const emailReady = () => !!env.RESEND_API_KEY?.trim()

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export { esc as escapeHtml }

/** Turns plain text (with line breaks) into safe HTML paragraphs. */
export const textToHtml = (t: string) =>
  esc(t)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

/** Branded email layout. `body` is HTML you have already escaped. */
export function layout(s: S, o: { title: string; body: string; button?: { label: string; url: string }; footerNote?: string }) {
  const brand = /^#[0-9a-f]{6}$/i.test(s.primary_color || '') ? s.primary_color : '#0b2545'
  const accent = /^#[0-9a-f]{6}$/i.test(s.accent_color || '') ? s.accent_color : '#f97316'
  const name = esc(s.company_name || 'Ronia Logistics')
  const logo = !s.logo_key ? '' : /^https?:\/\//i.test(s.logo_key) ? s.logo_key : `${siteUrl(s)}/media/${s.logo_key}`
  const contact = [s.phone && `📞 ${esc(s.phone)}`, s.email && `✉️ ${esc(s.email)}`, s.address && `📍 ${esc(s.address)}`].filter(Boolean).join(' &nbsp;·&nbsp; ')
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:#000;padding:18px 24px">${
    logo ? `<img src="${logo}" alt="${name}" height="40" style="height:40px;max-width:220px;display:block">` : `<span style="color:#fff;font-size:20px;font-weight:700">${name}</span>`
  }</td></tr>
<tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 16px;font-size:20px;color:${brand}">${esc(o.title)}</h1>
<div style="font-size:15px;line-height:1.6">${o.body}</div>
${
  o.button
    ? `<p style="margin:22px 0 8px"><a href="${esc(o.button.url)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${esc(o.button.label)}</a></p>`
    : ''
}
${o.footerNote ? `<p style="margin:18px 0 0;font-size:12px;color:#64748b">${o.footerNote}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 24px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">${name}${contact ? `<br>${contact}` : ''}<br><a href="${siteUrl(s)}" style="color:#64748b">${esc(siteUrl(s).replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`
}

export type EmailInput = {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  /** For the notifications log */
  shipmentId?: number
  merchantId?: number
}

/** Send one email. Returns { ok } and logs it in the notifications table either way. */
export async function sendEmail(s: S, e: EmailInput): Promise<{ ok: boolean; error?: string }> {
  const to = (Array.isArray(e.to) ? e.to : e.to.split(/[,;\s]+/)).map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
  if (!to.length) return { ok: false, error: 'No valid email address.' }
  const key = env.RESEND_API_KEY?.trim()
  const from = s.email_from?.trim() || `${s.company_name || 'Ronia Logistics'} <onboarding@resend.dev>`
  let ok = false
  let error: string | undefined
  if (!key) error = 'RESEND_API_KEY is not set.'
  else {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: e.subject, html: e.html, ...(e.replyTo ? { reply_to: e.replyTo } : {}) }),
      })
      ok = res.ok
      if (!ok) {
        const j = (await res.json().catch(() => null)) as { message?: string } | null
        error = j?.message || `Resend error ${res.status}`
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Network error'
    }
  }
  try {
    await run(
      "INSERT INTO notifications (channel, recipient, shipment_id, merchant_id, title, message, status, error) VALUES ('email', ?, ?, ?, ?, ?, ?, ?)",
      to.join(', '),
      e.shipmentId ?? null,
      e.merchantId ?? null,
      e.subject,
      e.subject,
      ok ? 'sent' : 'failed',
      error ?? null,
    )
  } catch {
    /* logging must never break sending */
  }
  if (!ok) console.warn('Email failed:', error)
  return { ok, error }
}

/** Email the office inbox(es) set in Website → Emails, if switched on. */
export async function notifyOffice(o: { subject: string; title: string; body: string; button?: { label: string; url: string }; replyTo?: string }) {
  try {
    const s = await emailSettings()
    if (s.email_office_on === '0') return
    const to = s.notify_email?.trim() || s.email?.trim()
    if (!to) return
    await sendEmail(s, { to, subject: o.subject, replyTo: o.replyTo, html: layout(s, { title: o.title, body: o.body, button: o.button }) })
  } catch (err) {
    console.warn('notifyOffice failed', err)
  }
}

/** Email a customer or merchant if that kind of email is switched on. */
export async function notifyPerson(
  kind: 'customers' | 'merchants',
  o: { to: string | null | undefined; subject: string; title: string; body: string; button?: { label: string; url: string }; shipmentId?: number; merchantId?: number; footerNote?: string },
) {
  try {
    if (!o.to) return
    const s = await emailSettings()
    if (s[`email_${kind}_on`] === '0') return
    await sendEmail(s, {
      to: o.to,
      subject: o.subject,
      shipmentId: o.shipmentId,
      merchantId: o.merchantId,
      replyTo: s.email || undefined,
      html: layout(s, { title: o.title, body: o.body, button: o.button, footerNote: o.footerNote }),
    })
  } catch (err) {
    console.warn('notifyPerson failed', err)
  }
}
