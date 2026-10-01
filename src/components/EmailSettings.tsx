import { useEffect, useState } from 'react'
import { getEmailStatus, sendTestEmail } from '~/fns/site'
import { Section, TextField } from './SiteEditorFields'
import { dateTime } from '~/lib/format'

type Status = Awaited<ReturnType<typeof getEmailStatus>>

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-accent-500)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  )
}

export function EmailSettings({ v, set, unsaved }: { v: (k: string) => string; set: (k: string) => (x: string) => void; unsaved: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = () => getEmailStatus().then(setStatus).catch(() => setStatus(null))
  useEffect(() => {
    load()
  }, [])

  const on = (k: string) => v(k) !== '0'
  const flip = (k: string) => (x: boolean) => set(k)(x ? '1' : '0')

  return (
    <>
      <Section title="Email notifications" hint="Sent through Resend. Customers get updates about their packages; the office gets alerts for new messages.">
        {status && !status.keySet && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The Resend key is not set yet, so no emails are sent. Ask your developer to run <code className="rounded bg-white px-1">npx wrangler secret put RESEND_API_KEY</code>.
          </div>
        )}
        {status?.keySet && <p className="text-sm font-medium text-emerald-700">✓ Resend is connected.</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Office email(s) for alerts"
            value={v('notify_email')}
            onChange={set('notify_email')}
            placeholder={v('email') || 'office@ronialogistics.com'}
            hint="Where new chats, contact messages, merchant applications and online payments are sent. Separate several with commas. Empty = the contact email."
          />
          <TextField
            label="Send emails from"
            value={v('email_from')}
            onChange={set('email_from')}
            placeholder="Ronia Logistics <updates@ronialogistics.com>"
            hint="Must use a domain you verified in Resend. Leave empty while testing (Resend then only delivers to your own Resend login email)."
          />
          <TextField label="Website address (for links in emails)" value={v('site_url')} onChange={set('site_url')} placeholder="https://ronialogistics.com" />
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
          <Toggle checked={on('email_office_on')} onChange={flip('email_office_on')} label="Email the office" hint="New chats, contact-form messages, merchant applications, online payments." />
          <Toggle
            checked={on('email_customers_on')}
            onChange={flip('email_customers_on')}
            label="Email customers about their packages"
            hint="When a shipment is booked and every time its status changes (if the sender or receiver has an email)."
          />
          <Toggle
            checked={on('email_merchants_on')}
            onChange={flip('email_merchants_on')}
            label="Email merchants"
            hint="Application received, approved or declined, and when you record a payment to them."
          />
        </div>
        {unsaved && <p className="text-xs font-semibold text-amber-700">Click “Save changes” before sending a test so the new settings are used.</p>}
      </Section>

      <Section
        title="Receive emails in Messages"
        hint="Emails sent to your contact address (e.g. info@ronialogistics.com) appear in Admin → Messages, where staff can read and reply."
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Cloudflare dashboard → your domain → <b>Email</b> → <b>Email Routing</b> → turn it on (Cloudflare adds the records).
          </li>
          <li>
            <b>Routing rules</b> → <b>Create address</b> → <code className="rounded bg-slate-100 px-1">{(v('email') || 'info@ronialogistics.com').split('@')[0]}</code> →
            action <b>Send to a Worker</b> → <b>ronia-logistics</b>.
          </li>
          <li>Send an email to that address from your Gmail — it shows up in Messages within seconds.</li>
        </ol>
        <TextField
          label="Also forward a copy to (optional)"
          value={v('forward_email_to')}
          onChange={set('forward_email_to')}
          placeholder="you@gmail.com"
          hint="Keeps a backup copy in a normal inbox. Add it first under Email Routing → Destination addresses and click the confirmation link Cloudflare emails you."
        />
        <p className="text-xs text-slate-500">
          Replies you send from Messages come from your “Send emails from” address with your contact email as the reply address, so the customer's answer comes back into
          Messages too.
        </p>
      </Section>

      <Section title="Send a test email">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <TextField label="Send to" value={to} onChange={setTo} placeholder={v('notify_email') || v('email') || 'you@example.com'} />
          </div>
          <button
            className="btn btn-accent"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setMsg(null)
              const res = await sendTestEmail({ data: { to } }).catch((e) => ({ ok: false as const, error: String(e?.message ?? e) }))
              setBusy(false)
              setMsg(res.ok ? { ok: true, text: `Sent to ${res.to}. Check the inbox (and spam folder).` } : { ok: false, text: res.error })
              load()
            }}
          >
            {busy ? 'Sending…' : 'Send test email'}
          </button>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
      </Section>

      {status && status.recent.length > 0 && (
        <Section title="Recent emails" hint="The last 15 emails the website tried to send.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {status.recent.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{dateTime(r.created_at)}</td>
                    <td className="py-2 pr-3">{r.title}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{r.recipient}</td>
                    <td className="py-2 text-xs">
                      {r.status === 'sent' ? <span className="text-emerald-700">Sent</span> : <span className="text-rose-700" title={r.error ?? ''}>Failed{r.error ? `: ${r.error}` : ''}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  )
}
