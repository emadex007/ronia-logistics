// Paystack online payments for shipping fees.
// Needs the secret key: `npx wrangler secret put PAYSTACK_SECRET_KEY` (live) and a `.dev.vars` file (local).
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { first, run, audit, nowIso, todayLagos } from '~/server/db'
import type { Shipment } from '~/lib/types'

const API = 'https://api.paystack.co'

function secret() {
  return env.PAYSTACK_SECRET_KEY?.trim() || ''
}

export const onlinePaymentEnabled = createServerFn({ method: 'GET' }).handler(async () => Boolean(secret()))

export const startOnlinePayment = createServerFn({ method: 'POST' })
  .validator((d: { code: string; email: string; origin: string }) => d)
  .handler(async ({ data }) => {
    const key = secret()
    if (!key) return { ok: false as const, error: 'Online payment is not switched on yet. Please pay at the office or by transfer.' }
    const email = (data.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: 'Enter a valid email address for your receipt.' }
    let origin: URL
    try {
      origin = new URL(data.origin)
      if (!/^https?:$/.test(origin.protocol)) throw new Error()
    } catch {
      return { ok: false as const, error: 'Invalid page address.' }
    }

    const s = await first<Shipment>('SELECT * FROM shipments WHERE tracking_code = ?', (data.code ?? '').trim().toUpperCase())
    if (!s) return { ok: false as const, error: 'Shipment not found.' }
    if (s.payment_status === 'paid') return { ok: false as const, error: 'This shipment has already been paid for.' }
    if (s.status === 'cancelled') return { ok: false as const, error: 'This shipment was cancelled.' }
    if (s.shipping_fee <= 0) return { ok: false as const, error: 'There is no fee to pay on this shipment.' }

    const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('')
    const reference = `${s.tracking_code}-${rand}`.toUpperCase()

    const res = await fetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: s.shipping_fee, // kobo
        currency: 'NGN',
        reference,
        callback_url: `${origin.origin}/pay/callback`,
        metadata: { tracking_code: s.tracking_code, shipment_id: s.id, purpose: 'shipping_fee' },
      }),
    })
    const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: { authorization_url: string } } | null
    if (!res.ok || !body?.status || !body.data?.authorization_url) {
      return { ok: false as const, error: body?.message ?? 'Could not start the payment. Please try again.' }
    }
    await run(
      "INSERT INTO payments (shipment_id, provider, reference, amount, email, status) VALUES (?, 'paystack', ?, ?, ?, 'pending')",
      s.id,
      reference,
      s.shipping_fee,
      email,
    )
    return { ok: true as const, url: body.data.authorization_url }
  })

export const verifyOnlinePayment = createServerFn({ method: 'GET' })
  .validator((d: { reference: string }) => d)
  .handler(async ({ data }) => {
    const reference = (data.reference ?? '').trim()
    const payment = await first<{ id: number; shipment_id: number; amount: number; status: string }>(
      'SELECT id, shipment_id, amount, status FROM payments WHERE reference = ?',
      reference,
    )
    if (!payment) return { ok: false as const, error: 'Payment not found.', code: null }
    const shipment = await first<Shipment>('SELECT * FROM shipments WHERE id = ?', payment.shipment_id)
    const code = shipment?.tracking_code ?? null
    if (payment.status === 'success') return { ok: true as const, code, amount: payment.amount }

    const key = secret()
    if (!key) return { ok: false as const, error: 'Online payment is not configured.', code }
    const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${key}` } })
    const body = (await res.json().catch(() => null)) as { status?: boolean; data?: { status: string; amount: number; currency: string; paid_at?: string } } | null
    const tx = body?.data
    if (!res.ok || !body?.status || !tx) return { ok: false as const, error: 'Could not confirm the payment yet. Refresh in a minute.', code }
    if (tx.status !== 'success') {
      await run("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'", payment.id)
      return { ok: false as const, error: `Payment was not completed (${tx.status}).`, code }
    }
    if (tx.amount !== payment.amount || tx.currency !== 'NGN') {
      return { ok: false as const, error: 'Payment amount does not match. Please contact us.', code }
    }

    // Mark success once — the `status != 'success'` guard stops double-counting if the page is refreshed.
    const paidAt = tx.paid_at ?? nowIso()
    const upd = await run("UPDATE payments SET status = 'success', paid_at = ? WHERE id = ? AND status != 'success'", paidAt, payment.id)
    if ((upd.meta.changes ?? 0) > 0 && shipment) {
      if (shipment.payment_status !== 'paid') {
        await run("UPDATE shipments SET payment_status = 'paid', payment_method = 'paystack', updated_at = ? WHERE id = ?", nowIso(), shipment.id)
      }
      await run(
        `INSERT INTO transactions (type, category, amount, description, method, reference, shipment_id, merchant_id, handled_by, txn_date)
         VALUES ('income', 'Shipping fee', ?, ?, 'paystack', ?, ?, ?, NULL, ?)`,
        payment.amount,
        `Online payment for ${shipment.tracking_code}`,
        reference,
        shipment.id,
        shipment.merchant_id,
        todayLagos(),
      )
      await run(
        "INSERT INTO notifications (channel, shipment_id, title, message) VALUES ('dashboard', ?, ?, ?)",
        shipment.id,
        `Online payment: ${shipment.tracking_code}`,
        `₦${(payment.amount / 100).toLocaleString('en-NG')} received via Paystack.`,
      )
      await audit(null, 'payment.paystack_success', 'shipment', shipment.id, { reference, amount: payment.amount })
    }
    return { ok: true as const, code, amount: payment.amount }
  })
