// Price list + online booking from the website.
import { createServerFn } from '@tanstack/react-start'
import { all, first, run, audit, nowIso } from '~/server/db'
import { getSessionUser, requirePerm } from '~/server/auth'
import { findRate, newTrackingCode, priceFor, queueNotifications, type Rate } from '~/server/shipment-core'
import { emailSettings, escapeHtml, notifyOffice, siteUrl } from '~/server/email'
import { serviceLabel } from '~/lib/format'

export type PublicRate = Omit<Rate, 'active'>

/** Everything the booking page needs: active prices + booking settings. */
export const getPriceList = createServerFn({ method: 'GET' }).handler(async () => {
  const [rates, settings] = await Promise.all([
    all<PublicRate>(
      'SELECT id, origin, destination, service_type, base_fee, included_kg, extra_per_kg, eta FROM rates WHERE active = 1 ORDER BY origin, destination, base_fee',
    ),
    all<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key IN ('booking_enabled','booking_note')"),
  ])
  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]))
  return { rates, enabled: s.booking_enabled !== '0', note: s.booking_note || '' }
})

export type BookingInput = {
  origin: string
  destination: string
  service_type: string
  weight_kg: number
  quantity: number
  description?: string
  declared_value?: number
  sender_name: string
  sender_phone: string
  sender_email?: string
  sender_address?: string
  pickup: boolean
  receiver_name: string
  receiver_phone: string
  receiver_email?: string
  receiver_address: string
  website?: string // honeypot
}

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

export const bookShipment = createServerFn({ method: 'POST' })
  .validator((d: BookingInput) => d)
  .handler(async ({ data }) => {
    if (data.website) return { ok: false as const, error: 'Could not book. Please call us.' }
    const enabled = (await first<{ value: string }>("SELECT value FROM settings WHERE key = 'booking_enabled'"))?.value !== '0'
    if (!enabled) return { ok: false as const, error: 'Online booking is paused. Please call or WhatsApp us.' }

    const rate = await findRate(clip(data.origin, 80), clip(data.destination, 80), clip(data.service_type, 30))
    if (!rate) return { ok: false as const, error: 'We do not have a price for that route yet. Please call us for a quote.' }
    const weight = Math.min(1000, Math.max(0.1, Number(data.weight_kg) || 1))
    const quantity = Math.min(50, Math.max(1, Math.floor(Number(data.quantity) || 1)))
    const fee = priceFor(rate, weight, quantity)

    const f = {
      sender_name: clip(data.sender_name, 120),
      sender_phone: clip(data.sender_phone, 40),
      sender_email: clip(data.sender_email, 160).toLowerCase(),
      sender_address: clip(data.sender_address, 300),
      receiver_name: clip(data.receiver_name, 120),
      receiver_phone: clip(data.receiver_phone, 40),
      receiver_email: clip(data.receiver_email, 160).toLowerCase(),
      receiver_address: clip(data.receiver_address, 300),
      description: clip(data.description, 300),
    }
    if (!f.sender_name || !f.sender_phone) return { ok: false as const, error: 'Enter your name and phone number.' }
    if (!f.receiver_name || !f.receiver_phone || !f.receiver_address) return { ok: false as const, error: "Enter the receiver's name, phone and address." }
    if (data.pickup && !f.sender_address) return { ok: false as const, error: 'Enter the pickup address.' }
    if (f.sender_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.sender_email)) return { ok: false as const, error: 'Check your email address.' }

    // Simple flood guard: max 5 online bookings per phone number per hour
    const recent = await first<{ n: number }>(
      'SELECT COUNT(*) AS n FROM shipments WHERE booked_online = 1 AND sender_phone = ? AND created_at > ?',
      f.sender_phone,
      new Date(Date.now() - 3600 * 1000).toISOString(),
    )
    if ((recent?.n ?? 0) >= 5) return { ok: false as const, error: 'Too many bookings from this number. Please call us.' }

    const me = await getSessionUser().catch(() => null)
    const code = await newTrackingCode()
    const t = nowIso()
    const res = await run(
      `INSERT INTO shipments (tracking_code, sender_name, sender_phone, sender_email, sender_address,
          receiver_name, receiver_phone, receiver_email, receiver_address, origin_city, destination_city, destination_country,
          service_type, description, quantity, weight_kg, declared_value, shipping_fee, cod_amount, payment_status,
          status, current_location, booked_online, pickup_requested, customer_id, created_at, updated_at)
       VALUES (?,?,?,?,?, ?,?,?,?,?,?,'Nigeria', ?,?,?,?,?,?,0,'unpaid', 'pending', ?, 1, ?, ?, ?, ?)`,
      code,
      f.sender_name,
      f.sender_phone,
      f.sender_email || null,
      f.sender_address || null,
      f.receiver_name,
      f.receiver_phone,
      f.receiver_email || null,
      f.receiver_address,
      rate.origin,
      rate.destination,
      rate.service_type,
      f.description || null,
      quantity,
      weight,
      Math.max(0, Math.round(Number(data.declared_value) || 0)),
      fee,
      data.pickup ? 'Awaiting pickup' : `Awaiting drop-off at ${rate.origin} office`,
      data.pickup ? 1 : 0,
      me?.role === 'customer' ? me.id : null,
      t,
      t,
    )
    const id = Number(res.meta.last_row_id)
    if (!me && f.sender_email) {
      await run("UPDATE shipments SET customer_id = (SELECT id FROM users WHERE role = 'customer' AND email = ?) WHERE id = ?", f.sender_email, id)
    }
    await run(
      'INSERT INTO shipment_events (shipment_id, status, location, note, created_at) VALUES (?, ?, ?, ?, ?)',
      id,
      'pending',
      data.pickup ? `${rate.origin} (pickup address)` : `${rate.origin} office`,
      data.pickup ? 'Booked online — we will call to arrange pickup.' : 'Booked online — please bring the package to our office.',
      t,
    )
    await run(
      "INSERT INTO notifications (channel, shipment_id, title, message) VALUES ('dashboard', ?, ?, ?)",
      id,
      `New online booking: ${code}`,
      `${f.sender_name} → ${f.receiver_name}, ${rate.destination} (${data.pickup ? 'pickup' : 'drop-off'})`,
    )
    await queueNotifications(
      { id, tracking_code: code, sender_name: f.sender_name, receiver_name: f.receiver_name, destination_city: rate.destination, sender_phone: f.sender_phone, receiver_phone: f.receiver_phone, sender_email: f.sender_email || null, receiver_email: null },
      'pending',
      data.pickup ? 'Awaiting pickup' : `${rate.origin} office`,
      true,
    )
    const st = await emailSettings()
    await notifyOffice({
      subject: `📦 New online booking ${code}${data.pickup ? ' — PICKUP needed' : ''}`,
      title: 'New online booking',
      body:
        `<p style="margin:0 0 10px"><b>${escapeHtml(f.sender_name)}</b> (${escapeHtml(f.sender_phone)}) booked a delivery to <b>${escapeHtml(f.receiver_name)}</b>, ${escapeHtml(rate.destination)}.</p>` +
        `<p style="margin:0 0 10px">${escapeHtml(serviceLabel(rate.service_type))} · ${quantity} item(s) · ${weight} kg · ₦${(fee / 100).toLocaleString('en-NG')}</p>` +
        (data.pickup ? `<p style="margin:0"><b>Pickup from:</b> ${escapeHtml(f.sender_address)}</p>` : '<p style="margin:0">Customer will drop it at the office.</p>'),
      button: { label: 'Open booking', url: `${siteUrl(st)}/admin/shipments/${id}` },
      replyTo: f.sender_email || undefined,
    })
    await audit(me?.id ?? null, 'shipment.book_online', 'shipment', id, { code, fee })
    return { ok: true as const, code, fee }
  })

/* ───────────── Admin: price list ───────────── */

export const listRates = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePerm('finance')
  const [rates, settings] = await Promise.all([
    all<Rate>('SELECT * FROM rates ORDER BY origin, destination, service_type'),
    all<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key IN ('booking_enabled','booking_note')"),
  ])
  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]))
  return { rates, enabled: s.booking_enabled !== '0', note: s.booking_note || '' }
})

export const saveRate = createServerFn({ method: 'POST' })
  .validator((d: Omit<Rate, 'id'> & { id?: number }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('finance')
    const origin = clip(data.origin, 80) || 'Abuja'
    const destination = clip(data.destination, 80)
    if (!destination) return { ok: false as const, error: 'Enter the destination city.' }
    const base = Math.round(Number(data.base_fee))
    if (!(base > 0)) return { ok: false as const, error: 'Enter a price greater than zero.' }
    const vals = [
      origin,
      destination,
      clip(data.service_type, 30) || 'standard',
      base,
      Math.max(0, Number(data.included_kg) || 0),
      Math.max(0, Math.round(Number(data.extra_per_kg) || 0)),
      clip(data.eta, 60) || null,
      data.active ? 1 : 0,
    ]
    const dup = await first<{ id: number }>(
      'SELECT id FROM rates WHERE lower(origin) = lower(?) AND lower(destination) = lower(?) AND service_type = ? AND id != ?',
      vals[0],
      vals[1],
      vals[2],
      data.id ?? 0,
    )
    if (dup) return { ok: false as const, error: 'There is already a price for this route and service. Edit that one instead.' }
    if (data.id) {
      await run(
        'UPDATE rates SET origin = ?, destination = ?, service_type = ?, base_fee = ?, included_kg = ?, extra_per_kg = ?, eta = ?, active = ? WHERE id = ?',
        ...vals,
        Number(data.id),
      )
    } else {
      await run('INSERT INTO rates (origin, destination, service_type, base_fee, included_kg, extra_per_kg, eta, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ...vals)
    }
    await audit(me.id, data.id ? 'rate.update' : 'rate.create', 'rate', data.id, { origin, destination, base })
    return { ok: true as const }
  })

export const deleteRate = createServerFn({ method: 'POST' })
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('finance')
    await run('DELETE FROM rates WHERE id = ?', Number(data.id))
    await audit(me.id, 'rate.delete', 'rate', Number(data.id))
    return { ok: true as const }
  })

export const saveBookingSettings = createServerFn({ method: 'POST' })
  .validator((d: { enabled: boolean; note: string }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('finance')
    await run("INSERT INTO settings (key, value) VALUES ('booking_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", data.enabled ? '1' : '0')
    await run("INSERT INTO settings (key, value) VALUES ('booking_note', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", clip(data.note, 500))
    await audit(me.id, 'booking.settings', 'settings', undefined, data)
    return { ok: true as const }
  })

/** Staff "New shipment" form: price from the list. */
export const quotePrice = createServerFn({ method: 'GET' })
  .validator((d: { origin: string; destination: string; service: string; weight: number; quantity: number }) => d)
  .handler(async ({ data }) => {
    await requirePerm('shipments')
    const rate = await findRate(data.origin || 'Abuja', data.destination || '', data.service || 'standard')
    if (!rate) return null
    return { fee: priceFor(rate, Number(data.weight) || 0, Number(data.quantity) || 1), eta: rate.eta }
  })
