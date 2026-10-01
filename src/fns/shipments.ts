import { createServerFn } from '@tanstack/react-start'
import { all, first, run, audit, nowIso, todayLagos, db } from '~/server/db'
import { requirePerm } from '~/server/auth'
import { statusLabel } from '~/lib/format'
import { emailSettings, escapeHtml, notifyPerson, siteUrl } from '~/server/email'
import type { Shipment, ShipmentEvent, ShipmentStatus } from '~/lib/types'

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

async function newTrackingCode() {
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

type NotifyShipment = Pick<Shipment, 'id' | 'tracking_code' | 'sender_phone' | 'receiver_phone' | 'sender_email' | 'receiver_email'> &
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
async function queueNotifications(s: NotifyShipment, status: ShipmentStatus, location?: string | null, isNew = false) {
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
  ].filter(Boolean) as string[][]
  const body =
    `<p style="margin:0 0 14px">${escapeHtml(STATUS_LINES[status] ?? `Your package is now "${statusLabel(status)}".`)}</p>` +
    `<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:10px;font-size:14px">${rows
      .map(([k, v]) => `<tr><td style="padding:8px 12px;color:#64748b;width:40%">${k}</td><td style="padding:8px 12px">${v}</td></tr>`)
      .join('')}</table>`
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

export type ShipmentFilters = { q?: string; status?: string; page?: number }

export const listShipments = createServerFn({ method: 'GET' })
  .validator((d: ShipmentFilters) => d)
  .handler(async ({ data }) => {
    await requirePerm('shipments')
    const where: string[] = []
    const params: unknown[] = []
    if (data.q?.trim()) {
      const q = `%${data.q.trim()}%`
      where.push('(tracking_code LIKE ? OR sender_name LIKE ? OR receiver_name LIKE ? OR sender_phone LIKE ? OR receiver_phone LIKE ? OR destination_city LIKE ?)')
      params.push(q, q, q, q, q, q)
    }
    if (data.status) {
      where.push('status = ?')
      params.push(data.status)
    }
    const page = Math.max(1, data.page ?? 1)
    const perPage = 25
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (await first<{ n: number }>(`SELECT COUNT(*) AS n FROM shipments ${whereSql}`, ...params))?.n ?? 0
    const rows = await all<Shipment>(
      `SELECT id, tracking_code, sender_name, receiver_name, receiver_phone, destination_city, destination_country,
              service_type, status, payment_status, shipping_fee, created_at
         FROM shipments ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      perPage,
      (page - 1) * perPage,
    )
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / perPage)) }
  })

export const getShipment = createServerFn({ method: 'GET' })
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    await requirePerm('shipments')
    const shipment = await first<Shipment>(
      `SELECT s.*, cb.full_name AS created_by_name, rb.full_name AS received_by_name,
              db.full_name AS dispatched_by_name, dl.full_name AS delivered_by_name
         FROM shipments s
         LEFT JOIN users cb ON cb.id = s.created_by
         LEFT JOIN users rb ON rb.id = s.received_by
         LEFT JOIN users db ON db.id = s.dispatched_by
         LEFT JOIN users dl ON dl.id = s.delivered_by
        WHERE s.id = ?`,
      Number(data.id),
    )
    if (!shipment) return null
    const events = await all<ShipmentEvent>(
      `SELECT e.id, e.status, e.location, e.note, e.created_at, u.full_name AS staff_name
         FROM shipment_events e LEFT JOIN users u ON u.id = e.staff_id
        WHERE e.shipment_id = ? ORDER BY e.created_at DESC, e.id DESC`,
      shipment.id,
    )
    return { shipment, events }
  })

export type NewShipmentInput = {
  sender_name: string
  sender_phone: string
  sender_email?: string
  sender_address?: string
  receiver_name: string
  receiver_phone: string
  receiver_email?: string
  receiver_address: string
  origin_city?: string
  destination_city: string
  destination_country?: string
  service_type: string
  description?: string
  quantity?: number
  weight_kg?: number | null
  declared_value?: number // kobo
  shipping_fee?: number // kobo
  cod_amount?: number // kobo
  payment_status: 'unpaid' | 'paid' | 'cod'
  payment_method?: string
  estimated_delivery?: string
  status?: ShipmentStatus
  merchant_id?: number | null
}

export const createShipment = createServerFn({ method: 'POST' })
  .validator((d: NewShipmentInput) => d)
  .handler(async ({ data }) => {
    const user = await requirePerm('shipments')
    const required: (keyof NewShipmentInput)[] = ['sender_name', 'sender_phone', 'receiver_name', 'receiver_phone', 'receiver_address', 'destination_city']
    for (const k of required) {
      if (!String(data[k] ?? '').trim()) return { ok: false as const, error: `Please fill in ${k.replace(/_/g, ' ')}.` }
    }
    const code = await newTrackingCode()
    const status: ShipmentStatus = data.status ?? 'received'
    const origin = data.origin_city?.trim() || 'Abuja'
    const t = nowIso()

    const res = await run(
      `INSERT INTO shipments (tracking_code, sender_name, sender_phone, sender_email, sender_address,
          receiver_name, receiver_phone, receiver_email, receiver_address, origin_city, destination_city, destination_country,
          service_type, description, quantity, weight_kg, declared_value, shipping_fee, cod_amount, payment_status, payment_method,
          status, current_location, created_by, received_by, estimated_delivery, created_at, updated_at, merchant_id)
       VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?)`,
      code,
      data.sender_name.trim(),
      data.sender_phone.trim(),
      data.sender_email?.trim() || null,
      data.sender_address?.trim() || null,
      data.receiver_name.trim(),
      data.receiver_phone.trim(),
      data.receiver_email?.trim() || null,
      data.receiver_address.trim(),
      origin,
      data.destination_city.trim(),
      data.destination_country?.trim() || 'Nigeria',
      data.service_type || 'standard',
      data.description?.trim() || null,
      Math.max(1, Number(data.quantity) || 1),
      data.weight_kg ? Number(data.weight_kg) : null,
      Number(data.declared_value) || 0,
      Number(data.shipping_fee) || 0,
      Number(data.cod_amount) || 0,
      data.payment_status,
      data.payment_status === 'paid' ? data.payment_method || 'cash' : null,
      status,
      `${origin} office`,
      user.id,
      status === 'pending' ? null : user.id,
      data.estimated_delivery || null,
      t,
      t,
      data.merchant_id ? Number(data.merchant_id) : null,
    )
    const id = Number(res.meta.last_row_id)

    // If the sender has a customer account with this email, the shipment appears in their account
    if (data.sender_email?.trim()) {
      await run(
        "UPDATE shipments SET customer_id = (SELECT id FROM users WHERE role = 'customer' AND email = ?) WHERE id = ?",
        data.sender_email.trim().toLowerCase(),
        id,
      )
    }

    await run(
      'INSERT INTO shipment_events (shipment_id, status, location, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      status,
      `${origin} office`,
      status === 'pending' ? 'Shipment booked, awaiting pickup.' : 'Package received and registered.',
      user.id,
      t,
    )

    // Paid at the counter → record the income automatically
    if (data.payment_status === 'paid' && Number(data.shipping_fee) > 0) {
      await run(
        `INSERT INTO transactions (type, category, amount, description, method, reference, shipment_id, handled_by, txn_date)
         VALUES ('income', 'Shipping fee', ?, ?, ?, ?, ?, ?, ?)`,
        Number(data.shipping_fee),
        `Shipping fee for ${code}`,
        data.payment_method || 'cash',
        code,
        id,
        user.id,
        todayLagos(),
      )
    }

    await queueNotifications(
      {
        id,
        tracking_code: code,
        sender_name: data.sender_name,
        receiver_name: data.receiver_name,
        destination_city: data.destination_city,
        sender_phone: data.sender_phone,
        receiver_phone: data.receiver_phone,
        sender_email: data.sender_email || null,
        receiver_email: data.receiver_email || null,
      },
      status,
      `${origin} office`,
      true,
    )
    await audit(user.id, 'shipment.create', 'shipment', id, { code })
    return { ok: true as const, id, code }
  })

export const updateShipmentStatus = createServerFn({ method: 'POST' })
  .validator((d: { id: number; status: ShipmentStatus; location?: string; note?: string }) => d)
  .handler(async ({ data }) => {
    const user = await requirePerm('shipments')
    const s = await first<Shipment>('SELECT * FROM shipments WHERE id = ?', Number(data.id))
    if (!s) return { ok: false as const, error: 'Shipment not found.' }
    const t = nowIso()
    const location = data.location?.trim() || s.current_location

    // Record which staff handled each stage
    const who: string[] = []
    if (data.status === 'received') who.push('received_by = ?')
    if (data.status === 'in_transit' || data.status === 'out_for_delivery') who.push('dispatched_by = ?')
    if (data.status === 'delivered') who.push('delivered_by = ?')

    await run(
      `UPDATE shipments SET status = ?, current_location = ?, updated_at = ?${data.status === 'delivered' ? ', delivered_at = ?' : ''}${who.length ? ', ' + who.join(', ') : ''} WHERE id = ?`,
      data.status,
      location,
      t,
      ...(data.status === 'delivered' ? [t] : []),
      ...who.map(() => user.id),
      s.id,
    )
    await run(
      'INSERT INTO shipment_events (shipment_id, status, location, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      s.id,
      data.status,
      location,
      data.note?.trim() || null,
      user.id,
      t,
    )
    await queueNotifications(s, data.status, location)
    await audit(user.id, 'shipment.status', 'shipment', s.id, { from: s.status, to: data.status })
    return { ok: true as const }
  })

export const markShipmentPaid = createServerFn({ method: 'POST' })
  .validator((d: { id: number; method: string }) => d)
  .handler(async ({ data }) => {
    const user = await requirePerm('shipments')
    const s = await first<Shipment>('SELECT * FROM shipments WHERE id = ?', Number(data.id))
    if (!s) return { ok: false as const, error: 'Shipment not found.' }
    if (s.payment_status === 'paid') return { ok: false as const, error: 'This shipment is already marked as paid.' }
    await run('UPDATE shipments SET payment_status = ?, payment_method = ?, updated_at = ? WHERE id = ?', 'paid', data.method, nowIso(), s.id)
    const amount = s.shipping_fee + (s.payment_status === 'cod' ? s.cod_amount : 0)
    if (s.shipping_fee > 0) {
      await run(
        `INSERT INTO transactions (type, category, amount, description, method, reference, shipment_id, handled_by, txn_date)
         VALUES ('income', 'Shipping fee', ?, ?, ?, ?, ?, ?, ?)`,
        s.shipping_fee,
        `Shipping fee for ${s.tracking_code}`,
        data.method,
        s.tracking_code,
        s.id,
        user.id,
        todayLagos(),
      )
    }
    await audit(user.id, 'shipment.paid', 'shipment', s.id, { method: data.method, amount })
    return { ok: true as const }
  })
