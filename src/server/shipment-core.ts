// Server-only shipment helpers shared by staff, riders and online bookings.
import { first, run, audit, nowIso, todayLagos, db } from './db'
import { statusLabel } from '~/lib/format'
import { emailSettings, escapeHtml, notifyPerson, siteUrl } from './email'
import type { SessionUser, Shipment, ShipmentStatus } from '~/lib/types'

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export async function newTrackingCode() {
  const prefix = (await first<{ value: string }>("SELECT value FROM settings WHERE key = 'tracking_prefix'"))?.value || 'RL'
  const ymd = todayLagos().slice(2).replace(/-/g, '')
  for (let attempt = 0; attempt < 6; attempt++) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
    const code = `${prefix}-${ymd}-${rand}`
    const exists = await first('SELECT 1 FROM shipments WHERE tracking_code = ?', code)
    if (!exists) return code
  }
  throw new Error('Could not generate a tracking code, please try again.')
}

export type NotifyShipment = Pick<Shipment, 'id' | 'tracking_code' | 'sender_phone' | 'receiver_phone' | 'sender_email' | 'receiver_email'> &
  Partial<Pick<Shipment, 'sender_name' | 'receiver_name' | 'destination_city'>>

const STATUS_LINES: Partial<Record<ShipmentStatus, string>> = {
  pending: 'Your shipment has been booked and is waiting for pickup.',
  received: 'We have received your package at our office and it is registered for delivery.',
  in_transit: 'Your package is on its way.',
  arrived_hub: 'Your package has arrived at our hub.',
  out_for_delivery: 'Your package is out for delivery today — please keep your phone close.',
  delivered: 'Your package has been delivered. Thank you for choosing us!',
  returned: 'This package is being returned to the sender.',
  cancelled: 'This shipment has been cancelled. Please contact us if you have any questions.',
}

/** Email sender & receiver about a status change, queue SMS for later, and add a dashboard alert. */
export async function queueNotifications(
  s: NotifyShipment,
  status: ShipmentStatus,
  location?: string | null,
  isNew = false,
  pod?: { receivedBy?: string | null; photoKey?: string | null },
) {
  const title = `${s.tracking_code}: ${statusLabel(status)}`
  const message = `Ronia Logistics: your package ${s.tracking_code} is now "${statusLabel(status)}"${location ? ` — ${location}` : ''}. Track it on our website.`
  await db().batch([
    db().prepare('INSERT INTO notifications (channel, recipient, shipment_id, title, message) VALUES (?, ?, ?, ?, ?)').bind('sms', s.receiver_phone, s.id, title, message),
    db().prepare('INSERT INTO notifications (channel, recipient, shipment_id, title, message) VALUES (?, ?, ?, ?, ?)').bind('sms', s.sender_phone, s.id, title, message),
    db().prepare("INSERT INTO notifications (channel, shipment_id, title, message, status) VALUES ('dashboard', ?, ?, ?, 'queued')").bind(s.id, title, message),
  ])

  const emails = [...new Set([s.sender_email, s.receiver_email].map((e) => e?.trim().toLowerCase()).filter(Boolean) as string[])]
  if (!emails.length) return
  const st = await emailSettings()
  const url = `${siteUrl(st)}/track?code=${encodeURIComponent(s.tracking_code)}`
  const rows = [
    ['Tracking number', `<b style="font-family:monospace;font-size:16px">${escapeHtml(s.tracking_code)}</b>`],
    ['Status', `<b>${escapeHtml(statusLabel(status))}</b>`],
    location ? ['Location', escapeHtml(location)] : null,
    s.sender_name ? ['From', escapeHtml(s.sender_name)] : null,
    s.receiver_name ? ['To', escapeHtml(s.receiver_name) + (s.destination_city ? `, ${escapeHtml(s.destination_city)}` : '')] : null,
    pod?.receivedBy ? ['Received by', escapeHtml(pod.receivedBy)] : null,
  ].filter(Boolean) as string[][]
  const body =
    `<p style="margin:0 0 14px">${escapeHtml(STATUS_LINES[status] ?? `Your package is now "${statusLabel(status)}".`)}</p>` +
    `<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:10px;font-size:14px">${rows
      .map(([k, v]) => `<tr><td style="padding:8px 12px;color:#64748b;width:40%">${k}</td><td style="padding:8px 12px">${v}</td></tr>`)
      .join('')}</table>` +
    (pod?.photoKey
      ? `<p style="margin:16px 0 6px;font-size:13px;color:#64748b">Photo taken at delivery:</p><img src="${siteUrl(st)}/media/${pod.photoKey}" alt="Proof of delivery" style="max-width:100%;border-radius:10px">`
      : '')
  for (const to of emails) {
    await notifyPerson('customers', {
      to,
      subject: isNew ? `Your package ${s.tracking_code} has been booked` : `${s.tracking_code}: ${statusLabel(status)}`,
      title: isNew ? 'Package booked ✅' : `Update: ${statusLabel(status)}`,
      body,
      button: { label: 'Track your package', url },
      shipmentId: s.id,
      footerNote: 'You are getting this because your email was added to this shipment.',
    })
  }
}


/** Change a shipment's status: records who did it, adds a tracking event and notifies the customer. */
export async function applyStatus(
  user: SessionUser,
  s: Shipment,
  status: ShipmentStatus,
  opts: { location?: string | null; note?: string | null; pod?: { receivedBy?: string | null; photoKey?: string | null; signatureKey?: string | null } } = {},
) {
  const t = nowIso()
  const location = opts.location?.trim() || s.current_location
  const sets = ['status = ?', 'current_location = ?', 'updated_at = ?']
  const params: unknown[] = [status, location, t]
  if (status === 'received') sets.push('received_by = ?'), params.push(user.id)
  if (status === 'in_transit' || status === 'out_for_delivery') sets.push('dispatched_by = ?'), params.push(user.id)
  if (status === 'delivered') {
    sets.push('delivered_by = ?', 'delivered_at = ?')
    params.push(user.id, t)
    if (opts.pod?.receivedBy !== undefined) sets.push('signed_by = ?'), params.push(opts.pod.receivedBy || null)
    if (opts.pod?.photoKey) sets.push('proof_image_key = ?'), params.push(opts.pod.photoKey)
    if (opts.pod?.signatureKey) sets.push('recipient_signature = ?'), params.push(opts.pod.signatureKey)
  }
  await run(`UPDATE shipments SET ${sets.join(', ')} WHERE id = ?`, ...params, s.id)
  await run(
    'INSERT INTO shipment_events (shipment_id, status, location, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    s.id,
    status,
    location,
    opts.note?.trim() || null,
    user.id,
    t,
  )
  await queueNotifications(s, status, location, false, opts.pod)
  await audit(user.id, 'shipment.status', 'shipment', s.id, { from: s.status, to: status })
}

/** Record that the shipping fee was paid (adds it to income once). */
export async function recordShipmentPayment(user: SessionUser | null, s: Shipment, method: string) {
  if (s.payment_status === 'paid') return
  await run('UPDATE shipments SET payment_status = ?, payment_method = ?, updated_at = ? WHERE id = ?', 'paid', method, nowIso(), s.id)
  if (s.shipping_fee > 0) {
    await run(
      `INSERT INTO transactions (type, category, amount, description, method, reference, shipment_id, handled_by, txn_date)
       VALUES ('income', 'Shipping fee', ?, ?, ?, ?, ?, ?, ?)`,
      s.shipping_fee,
      `Shipping fee for ${s.tracking_code}`,
      method,
      s.tracking_code,
      s.id,
      user?.id ?? null,
      todayLagos(),
    )
  }
  await audit(user?.id ?? null, 'shipment.paid', 'shipment', s.id, { method, amount: s.shipping_fee })
}

export type Rate = {
  id: number
  origin: string
  destination: string
  service_type: string
  base_fee: number
  included_kg: number
  extra_per_kg: number
  eta: string | null
  active: number
}

/** Price in kobo for a rate and weight. */
export function priceFor(rate: Pick<Rate, 'base_fee' | 'included_kg' | 'extra_per_kg'>, weightKg: number, quantity = 1) {
  const extra = Math.max(0, Math.ceil(Math.max(0, weightKg) - rate.included_kg))
  return (rate.base_fee + extra * rate.extra_per_kg) * Math.max(1, Math.floor(quantity) || 1)
}

export async function findRate(origin: string, destination: string, service: string) {
  return first<Rate>(
    'SELECT * FROM rates WHERE active = 1 AND lower(origin) = lower(?) AND lower(destination) = lower(?) AND service_type = ? LIMIT 1',
    origin.trim(),
    destination.trim(),
    service,
  )
}

